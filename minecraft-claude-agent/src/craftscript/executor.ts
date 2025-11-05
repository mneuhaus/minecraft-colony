import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import pathfinderPkg from 'mineflayer-pathfinder';
import {
  type Program,
  type Statement,
  type CommandStmt,
  type Block,
  type Expr,
  type NamedArg,
  type Selector as SelAst,
  type NumberLiteral,
  type StringLiteral,
  type BooleanLiteral,
  type PredicateCall,
  type World,
  type Waypoint,
  type IdentifierExpr,
  type CraftscriptResult,
  type ExecutorOptions,
} from './types.js';
import { selectorToOffset, yawToHeadingRadians } from './selector.js';
import { can_stand, detect_hazards, get_vox, is_air, safe_step_down, safe_step_up } from './env.js';
import { get_waypoint } from '../tools/navigation/waypoints.js';

const { goals } = pathfinderPkg as any;

export class CraftscriptExecutor {
  private bot: Bot;
  private ops = 0;
  private macros = new Map<string, Block>();
  private options: Required<ExecutorOptions>;

  constructor(bot: Bot, options?: ExecutorOptions) {
    this.bot = bot;
    this.options = {
      opLimit: options?.opLimit ?? 10000,
      defaultScanRadius: options?.defaultScanRadius ?? 2,
      autoScanBeforeOps: options?.autoScanBeforeOps ?? true,
    };
  }

  async run(program: Program): Promise<{ ok: boolean; results: CraftscriptResult[] }> {
    this.ops = 0;
    // collect macros
    for (const st of program.body) {
      if (st.type === 'MacroDecl') this.macros.set(st.name, st.body);
    }

    const results: CraftscriptResult[] = [];
    try {
      for (const st of program.body) {
        if (st.type === 'MacroDecl') continue; // skip declarations
        const res = await this.execStatement(st);
        if (res) {
          results.push(res);
          if (!res.ok) return { ok: false, results };
        }
      }
      return { ok: true, results };
    } catch (e: any) {
      results.push({ ok: false, error: 'runtime_error', message: e.message || String(e), op_index: this.ops, ts: Date.now() });
      return { ok: false, results };
    }
  }

  private async execStatement(st: Statement): Promise<CraftscriptResult | null> {
    this.bumpOps();
    switch (st.type) {
      case 'Empty':
        return null;
      case 'Block':
        for (const s of st.body) {
          const r = await this.execStatement(s);
          if (r && !r.ok) return r;
        }
        return null;
      case 'AssertStmt': {
        const val = await this.evalExpr(st.test);
        const ok = Boolean(val);
        if (!ok) throw new Error(st.message?.value || 'assertion_failed');
        return { ok: true, op: 'assert', ms: 0 };
      }
      case 'IfStmt': {
        const test = Boolean(await this.evalExpr(st.test));
        if (test) return await this.execStatement(st.consequent);
        if (st.alternate) return await this.execStatement(st.alternate);
        return null;
      }
      case 'RepeatStmt': {
        const n = Math.max(0, Number(await this.evalExpr(st.count)) | 0);
        for (let i = 0; i < n; i++) {
          const r = await this.execStatement(st.body);
          if (r && !r.ok) return r;
        }
        return null;
      }
      case 'WhileStmt': {
        let guard = 0;
        while (Boolean(await this.evalExpr(st.test))) {
          const r = await this.execStatement(st.body);
          if (r && !r.ok) return r;
          guard++;
          if (guard > this.options.opLimit) throw new Error('loop_limit_exceeded');
        }
        return null;
      }
      case 'Command':
        return await this.execCommand(st);
      default:
        return null;
    }
  }

  private async execCommand(cmd: CommandStmt): Promise<CraftscriptResult> {
    const t0 = Date.now();
    const name = cmd.name;
    // Auto-scan before risky ops
    if (this.options.autoScanBeforeOps && ['dig', 'place', 'move'].includes(name)) {
      await get_vox(this.bot, this.options.defaultScanRadius);
    }

    try {
      if (name === 'move') {
        const sel = this.requireSelectorArg(cmd.args[0]);
        // If move includes u/d segment "^/_" already parsed, evaluate invariants based on delta y
        const delta = this.selectorToWorld(sel).minus(this.bot.entity.position.floored());
        if (delta.y > 0 && !safe_step_up(this.bot, sel)) return this.fail('invariant_violation', 'unsafe step up', cmd);
        if (delta.y < 0 && !safe_step_down(this.bot, sel)) return this.fail('invariant_violation', 'unsafe step down', cmd);
        await this.gotoSelector(sel, 0);
        return this.ok('move', t0, { selector: '...' });
      }
      if (name === 'turn') {
        const arg = cmd.args[0];
        const token = this.exprToString(arg as any);
        await this.turnToken(token);
        return this.ok('turn', t0);
      }
      if (name === 'turn_face') {
        const dir = this.requireString(cmd.args[0]);
        await this.turnFace(dir.value);
        return this.ok('turn_face', t0, { face: dir.value });
      }
      if (name === 'dig') {
        const sel = this.requireSelectorArg(cmd.args[0]);
        // Prevent digging upwards if gravity blocks overhead
        const worldPos = this.selectorToWorld(sel);
        const above1 = this.bot.blockAt(worldPos.offset(0, 1, 0));
        const above2 = this.bot.blockAt(worldPos.offset(0, 2, 0));
        const grav = (b: any) => b && (b.name.includes('gravel') || b.name.includes('sand'));
        if (grav(above1) || grav(above2)) return this.fail('invariant_violation', 'gravity_block_overhead', cmd);
        const target = this.bot.blockAt(worldPos);
        if (!target || target.name === 'air') return this.fail('move_blocked', 'no block to dig', cmd);
        if (this.bot.entity.position.distanceTo(worldPos) > 4.5) return this.fail('move_blocked', 'out of reach', cmd);
        await this.bot.dig(target);
        return this.ok('dig', t0, { selector: sel });
      }
      if (name === 'place') {
        const id = this.requireString(cmd.args[0]).value;
        const sel = this.requireSelectorArg(cmd.args[1]);
        const named = this.namedArgs(cmd.args.slice(2));
        const face = (named.face && this.exprToString(named.face)) || 'up';
        const worldPos = this.selectorToWorld(sel);
        // Equip
        const itemName = id.replace('minecraft:', '');
        const item = this.bot.inventory.items().find((i) => i.name === itemName);
        if (!item) return this.fail('unavailable', `no ${id} in inventory`, cmd);
        await this.bot.equip(item, 'hand');
        // place against reference block
        const faceVector = faceToVec(face);
        const reference = this.bot.blockAt(worldPos.plus(faceVector));
        if (!reference || reference.name === 'air') return this.fail('blocked', 'no reference to place against', cmd);
        if (this.bot.entity.position.distanceTo(reference.position) > 4.5) return this.fail('move_blocked', 'out of reach', cmd);
        await this.bot.placeBlock(reference, faceVector);
        return this.ok('place', t0, { id, selector: sel, face });
      }
      if (name === 'equip') {
        const id = this.requireString(cmd.args[0]).value.replace('minecraft:', '');
        const item = this.bot.inventory.items().find((i) => i.name === id);
        if (!item) return this.fail('unavailable', `no ${id} in inventory`, cmd);
        await this.bot.equip(item, 'hand');
        return this.ok('equip', t0, { id });
      }
      if (name === 'scan') {
        const named = this.namedArgs(cmd.args);
        const r = (named.r && Number(this.evalExprSync(named.r))) || this.options.defaultScanRadius;
        const snap = await get_vox(this.bot, r, false);
        return this.ok('scan', t0, { size: snap.window });
      }
      if (name === 'goto') {
        // Accept world(), waypoint(), or selector
        const arg = cmd.args[0];
        const named = this.namedArgs(cmd.args.slice(1));
        const tol = named.tol ? Number(this.evalExprSync(named.tol)) : 1;
        if ((arg as any).type === 'World') {
          const w = arg as World;
          await this.bot.pathfinder.goto(new goals.GoalNear(w.x, w.y, w.z, tol));
          return this.ok('goto', t0, { world: [w.x, w.y, w.z] });
        } else if ((arg as any).type === 'Waypoint') {
          const name = (arg as Waypoint).name.value;
          const wp = await get_waypoint(this.bot.username, name);
          if (!wp) return this.fail('no_path', `unknown waypoint ${name}`, cmd);
          await this.bot.pathfinder.goto(new goals.GoalNear(wp.x, wp.y, wp.z, tol));
          return this.ok('goto', t0, { world: [wp.x, wp.y, wp.z] });
        } else if ((arg as any).type === 'Selector') {
          const pos = this.selectorToWorld(arg as SelAst);
          await this.bot.pathfinder.goto(new goals.GoalNear(pos.x, pos.y, pos.z, tol));
          return this.ok('goto', t0, { world: [pos.x, pos.y, pos.z] });
        } else {
          return this.fail('no_path', 'unsupported goto arg', cmd);
        }
      }
      if (name === 'drop') {
        const id = this.requireString(cmd.args[0]).value.replace('minecraft:', '');
        const named = this.namedArgs(cmd.args.slice(1));
        const count = named.count ? Number(this.evalExprSync(named.count)) : undefined;
        const item = this.bot.inventory.items().find((i) => i.name === id);
        if (!item) return this.fail('unavailable', `no ${id} in inventory`, cmd);
        await this.bot.toss(item.type, null as any, count ?? item.count);
        return this.ok('drop', t0, { id, count: count ?? item.count });
      }
      if (name === 'eat') {
        const id = this.requireString(cmd.args[0]).value.replace('minecraft:', '');
        const item = this.bot.inventory.items().find((i) => i.name === id);
        if (!item) return this.fail('unavailable', `no ${id} in inventory`, cmd);
        await this.bot.equip(item, 'hand');
        await this.bot.consume();
        return this.ok('eat', t0, { id });
      }

      // Macro invocation: treat unknown commands matching macro names as body exec
      if (this.macros.has(name)) {
        const body = this.macros.get(name)!;
        await this.execStatement(body);
        return this.ok('macro', t0, { name });
      }

      return this.fail('compile_error', `unknown command: ${name}`, cmd);
    } catch (e: any) {
      return this.fail('runtime_error', e.message || String(e), cmd);
    }
  }

  private async turnToken(token: string) {
    token = token.toLowerCase();
    const currentYaw = this.bot.entity.yaw;
    let delta = 0;
    if (token === 'r90') delta = -Math.PI / 2;
    else if (token === 'l90') delta = Math.PI / 2;
    else if (token === '180') delta = Math.PI;
    else throw new Error(`invalid turn token: ${token}`);
    await this.bot.look(currentYaw + delta, this.bot.entity.pitch, true);
  }

  private async turnFace(face: string) {
    face = face.toLowerCase();
    const dirYaw: Record<string, number> = {
      north: Math.PI, // +Z
      south: 0, // -Z
      east: (3 * Math.PI) / 2,
      west: Math.PI / 2,
    };
    const yaw = dirYaw[face];
    if (yaw === undefined) throw new Error(`invalid face: ${face}`);
    await this.bot.look(yaw, this.bot.entity.pitch, true);
  }

  private requireSelectorArg(arg: any): SelAst {
    if (!arg || arg.type !== 'Selector') throw new Error('selector required');
    return arg as SelAst;
  }

  private requireString(arg: any): StringLiteral {
    if (!arg || arg.type !== 'String') throw new Error('string required');
    return arg as StringLiteral;
  }

  private namedArgs(args: any[]): Record<string, Expr> {
    const out: Record<string, Expr> = {};
    for (const a of args) if (a.type === 'NamedArg') out[(a as NamedArg).key] = (a as NamedArg).value;
    return out;
  }

  private exprToString(e: Expr): string {
    if ((e as any).type === 'String') return (e as StringLiteral).value;
    if ((e as any).type === 'Identifier') return (e as IdentifierExpr).name;
    if ((e as any).type === 'Number') return String((e as NumberLiteral).value);
    throw new Error('string-like required');
  }

  private evalExprSync(e: Expr): any {
    if ((e as any).type === 'Number') return (e as NumberLiteral).value;
    if ((e as any).type === 'Boolean') return (e as BooleanLiteral).value;
    if ((e as any).type === 'String') return (e as StringLiteral).value;
    if ((e as any).type === 'Identifier') return (e as IdentifierExpr).name;
    throw new Error('unsupported sync expr');
  }

  private async evalExpr(e: Expr): Promise<any> {
    switch (e.type) {
      case 'Number':
        return (e as NumberLiteral).value;
      case 'Boolean':
        return (e as BooleanLiteral).value;
      case 'String':
        return (e as StringLiteral).value;
      case 'Identifier':
        return (e as IdentifierExpr).name;
      case 'LogicalExpr': {
        const left = Boolean(await this.evalExpr(e.left));
        if (e.op === '&&') return left && Boolean(await this.evalExpr(e.right));
        else return left || Boolean(await this.evalExpr(e.right));
      }
      case 'UnaryExpr':
        if (e.op === '!') return !Boolean(await this.evalExpr(e.arg));
        throw new Error('unsupported unary');
      case 'PredicateCall':
        return await this.evalPredicate(e as PredicateCall);
      case 'Selector':
        return e; // pass through
      case 'World':
        return e as World;
      case 'Waypoint':
        return e as Waypoint;
      default:
        throw new Error(`unsupported expr type ${e.type}`);
    }
  }

  private async evalPredicate(p: PredicateCall): Promise<boolean> {
    const n = p.name.toLowerCase();
    if (n === 'safe_step_up') return safe_step_up(this.bot, this.requireSelectorArg(p.args[0] as any));
    if (n === 'safe_step_down') return safe_step_down(this.bot, this.requireSelectorArg(p.args[0] as any));
    if (n === 'can_stand') return can_stand(this.bot, this.requireSelectorArg(p.args[0] as any));
    if (n === 'is_air') return is_air(this.bot, this.requireSelectorArg(p.args[0] as any));
    if (n === 'has_item') {
      const id = this.requireString(p.args[0] as any).value.replace('minecraft:', '');
      return !!this.bot.inventory.items().find((i) => i.name === id);
    }
    if (n === 'is_hazard') {
      const tag = this.requireString(p.args[0] as any).value;
      return detect_hazards(this.bot, 2).includes(tag);
    }
    throw new Error(`unknown predicate ${n}`);
  }

  private selectorToWorld(sel: SelAst): Vec3 {
    const heading = yawToHeadingRadians(this.bot.entity.yaw);
    return this.bot.entity.position.floored().plus(selectorToOffset(sel, heading));
  }

  private async gotoSelector(sel: SelAst, tol = 0) {
    const p = this.selectorToWorld(sel);
    await this.bot.pathfinder.goto(new goals.GoalNear(p.x, p.y, p.z, Math.max(0, tol)));
  }

  private ok(op: string, t0: number, notes?: any): CraftscriptResult {
    return { ok: true, op, ms: Date.now() - t0, notes } as any;
  }
  private fail(error: string, message: string, cmd: CommandStmt): CraftscriptResult {
    return {
      ok: false,
      error,
      message,
      loc: (cmd.loc as any)?.start || undefined,
      op_index: this.ops,
      ts: Date.now(),
    } as any;
  }
  private bumpOps() {
    this.ops++;
    if (this.ops > this.options.opLimit) throw new Error('op_limit_exceeded');
  }
}

function faceToVec(face: string): Vec3 {
  switch (face) {
    case 'up':
      return new Vec3(0, 1, 0);
    case 'down':
      return new Vec3(0, -1, 0);
    case 'north':
      return new Vec3(0, 0, -1);
    case 'south':
      return new Vec3(0, 0, 1);
    case 'west':
      return new Vec3(-1, 0, 0);
    case 'east':
      return new Vec3(1, 0, 0);
    default:
      throw new Error(`invalid face: ${face}`);
  }
}
