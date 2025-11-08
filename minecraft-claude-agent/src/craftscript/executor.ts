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
  type CustomFunction,
} from './types.js';
import { selectorToOffset, yawToHeadingRadians } from './selector.js';
import { can_stand, detect_hazards, get_vox, is_air, safe_step_down, safe_step_up } from './env.js';
import { get_waypoint } from '../tools/navigation/waypoints.js';
import { parse as parseCraft } from './parser.js';

const { goals } = pathfinderPkg as any;

export class CraftscriptExecutor {
  private bot: Bot;
  private ops = 0;
  private macros = new Map<string, Block>();
  private options: Required<Omit<ExecutorOptions, 'onStep' | 'onTrace' | 'db' | 'botId' | 'jobId'>> & { onStep?: (result: CraftscriptResult) => void; onTrace?: (t:any)=>void; db?: any; botId?: number; jobId?: string };
  private vars = new Map<string, any>();
  private openContainer: any = null; // Currently open chest/furnace/etc
  private functionCallDepth = 0; // Track recursion depth
  private readonly MAX_FUNCTION_DEPTH = 10; // Prevent infinite recursion

  constructor(bot: Bot, options?: ExecutorOptions) {
    this.bot = bot;
    this.options = {
      opLimit: options?.opLimit ?? 10000,
      defaultScanRadius: options?.defaultScanRadius ?? 2,
      autoScanBeforeOps: options?.autoScanBeforeOps ?? true,
      ...(options?.onStep ? { onStep: options.onStep } : {}),
      ...(options?.onTrace ? { onTrace: options.onTrace } : {}),
      ...(options?.db ? { db: options.db } : {}),
      ...(options?.botId ? { botId: options.botId } : {}),
      ...(options?.jobId ? { jobId: options.jobId } : {}),
    };
  }

  private trace(kind: string, data: any) {
    try { this.options.onTrace?.({ kind, ts: Date.now(), ...data }); } catch {}
  }

  async run(program: Program): Promise<{ ok: boolean; results: CraftscriptResult[] }> {
    this.ops = 0;

    // Set pathfinder movements to disallow digging by default (for clean block tracking)
    try {
      const pathfinderPkg = await import('mineflayer-pathfinder');
      const { Movements } = pathfinderPkg as any;
      const movements = new Movements(this.bot);
      (movements as any).canDig = false; // Prevent pathfinder from breaking blocks
      this.bot.pathfinder.setMovements(movements);
    } catch (error: any) {
      console.warn('[CraftScript] Could not set pathfinder movements:', error.message);
    }

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
        // Block scope: snapshot and restore variables
        const snapshot = new Map(this.vars);
        try {
          for (const s of st.body) {
            const r = await this.execStatement(s);
            if (r && !r.ok) return r;
          }
          return null;
        } finally {
          this.vars = snapshot;
        }
      case 'AssertStmt': {
        const val = await this.evalExpr(st.test);
        const ok = Boolean(val);
        if (!ok) throw new Error(st.message?.value || 'assertion_failed');
        return { ok: true, op: 'assert', ms: 0 };
      }
      case 'IfStmt': {
        const raw = await this.evalExpr(st.test);
        const test = Boolean(raw);
        this.trace('if', { value: test, exprType: (st.test as any)?.type, loc: (st.loc as any)?.start });
        if (test) return await this.execStatement(st.consequent);
        if (st.alternate) return await this.execStatement(st.alternate);
        return null;
      }
      case 'RepeatStmt': {
        if ((st as any).varName || (st as any).start || (st as any).end) {
          this.trace('repeat_init', { var: (st as any).varName, count: (st as any).count ? this.evalExprSync((st as any).count) : undefined, start: (st as any).start ? this.evalExprSync((st as any).start) : undefined, end: (st as any).end ? this.evalExprSync((st as any).end) : undefined, step: (st as any).step ? this.evalExprSync((st as any).step) : undefined, loc: (st.loc as any)?.start });
        } else {
          this.trace('repeat_init', { count: this.evalExprSync((st as any).count), loc: (st.loc as any)?.start });
        }
        // Three forms: legacy count, var with limit (0..N-1), var with range (start..end[:step])
        if ((st as any).varName) {
          const name = (st as any).varName as string;
          const prev = this.vars.has(name) ? this.vars.get(name) : undefined;
          const hasPrev = this.vars.has(name);
          try {
            if ((st as any).start && (st as any).end) {
              const start = Number(this.evalExprSync((st as any).start));
              const end = Number(this.evalExprSync((st as any).end));
              let step = (st as any).step ? Number(this.evalExprSync((st as any).step)) : (start <= end ? 1 : -1);
              if (step === 0) step = 1;
              if (step > 0) {
                for (let i = start; i <= end; i += step) {
                  this.vars.set(name, i);
                  this.trace('repeat_iter', { var: name, value: i });
                  const r = await this.execStatement((st as any).body);
                  if (r && !r.ok) return r;
                }
              } else {
                for (let i = start; i >= end; i += step) {
                  this.vars.set(name, i);
                  this.trace('repeat_iter', { var: name, value: i });
                  const r = await this.execStatement((st as any).body);
                  if (r && !r.ok) return r;
                }
              }
            } else {
              const limit = Math.max(0, Number(this.evalExprSync((st as any).count)) | 0);
              for (let i = 0; i < limit; i++) {
                this.vars.set(name, i);
                this.trace('repeat_iter', { var: name, value: i });
                const r = await this.execStatement((st as any).body);
                if (r && !r.ok) return r;
              }
            }
            this.trace('repeat_end', { var: name });
            return null;
          } finally {
            if (hasPrev) this.vars.set(name, prev);
            else this.vars.delete(name);
          }
        } else {
          const n = Math.max(0, Number(this.evalExprSync((st as any).count)) | 0);
          for (let i = 0; i < n; i++) {
            this.trace('repeat_iter', { value: i });
            const r = await this.execStatement((st as any).body);
            if (r && !r.ok) return r;
          }
          this.trace('repeat_end', {});
          return null;
        }
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
      case 'LetStmt': {
        const value = this.evalExprSync(st.value as any);
        this.vars.set((st as any).name, value);
        this.trace('var_set', { name: (st as any).name, value });
        return { ok: true, op: 'let', ms: 0 } as any;
      }
      case 'AssignStmt': {
        const value = this.evalExprSync(st.value as any);
        this.vars.set((st as any).name, value);
        this.trace('var_set', { name: (st as any).name, value });
        return { ok: true, op: 'set', ms: 0 } as any;
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
        const arg0 = cmd.args[0];
        if ((arg0 as any)?.type === 'World') {
          const w = arg0 as World;
          const named = this.namedArgs(cmd.args.slice(1));
          const tol = named.tol ? Math.max(0, Number(this.evalExprSync(named.tol))) : 0;
          try {
            await this.bot.pathfinder.goto(new goals.GoalNear(w.x, w.y, w.z, tol));
            return this.ok('move', t0, { world: [w.x, w.y, w.z], tol });
          } catch (e: any) {
            return this.fail('no_path', `cannot reach world(${w.x},${w.y},${w.z})`, cmd);
          }
        } else {
          const sel = this.requireSelectorArg(arg0);
          // Invariants relaxed: rely on pathfinder
          await this.gotoSelector(sel, 0);
          return this.ok('move', t0, { selector: 'rel' });
        }
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
      if (name === 'dig' || name === 'break') {
        const arg0 = cmd.args[0];
        let worldPos = this.tryEvalWorldCoords(cmd.args);
        if (!worldPos) {
          worldPos = this.selectorToWorld(this.requireSelectorArg(arg0));
        }
        // Prevent digging upwards if gravity blocks overhead
        const above1 = this.bot.blockAt(worldPos.offset(0, 1, 0));
        const above2 = this.bot.blockAt(worldPos.offset(0, 2, 0));
        const grav = (b: any) => b && (b.name.includes('gravel') || b.name.includes('sand'));
        if (grav(above1) || grav(above2)) return this.fail('invariant_violation', 'gravity_block_overhead', cmd);
        const target = this.bot.blockAt(worldPos);
        if (!target || target.name === 'air') return this.fail('no_target', 'no block to dig', cmd);
        if (this.bot.entity.position.distanceTo(worldPos) > 4.5) return this.fail('out_of_reach', 'target beyond reach (4.5)', cmd);
        try {
          await this.safeDigBlock(target, name);
          return this.ok(name, t0, { world: [worldPos.x, worldPos.y, worldPos.z], id: target.name });
        } catch (e: any) {
          return this.fail('runtime_error', e?.message || `${name}_failed`, cmd);
        }
      }
      if (name === 'place') {
        const id = this.requireString(cmd.args[0]).value;
        const arg1 = cmd.args[1];
        let namedStartIdx = 2;
        let worldPos = this.tryEvalWorldCoords(cmd.args.slice(1));
        if (worldPos) {
          namedStartIdx = 4;
        } else {
          worldPos = this.selectorToWorld(this.requireSelectorArg(arg1));
        }

        const named = this.namedArgs(cmd.args.slice(namedStartIdx));
        const face = (named.face && this.exprToString(named.face)) || 'up';
        // Equip
        const itemName = id.replace('minecraft:', '');
        const item = this.bot.inventory.items().find((i) => i.name === itemName);
        if (!item) return this.fail('unavailable', `no ${id} in inventory`, cmd);
        await this.bot.equip(item, 'hand');
        // place against reference block: in Mineflayer, placement occurs at reference.position + faceVector.
        // To place at worldPos, choose the block at worldPos - faceVector as the reference.
        const faceVector = faceToVec(face);
        const reference = this.bot.blockAt(worldPos.minus(faceVector));
        if (!reference || reference.name === 'air') return this.fail('blocked', 'no reference to place against', cmd);
        if (this.bot.entity.position.distanceTo(reference.position) > 4.5) return this.fail('out_of_reach', 'reference beyond reach (4.5)', cmd);
        // Target cell must be empty
        const occupied = this.bot.blockAt(worldPos);
        if (occupied && occupied.name !== 'air') {
          return this.fail('occupied', `target not empty: minecraft:${occupied.name}`, cmd, { target: [worldPos.x, worldPos.y, worldPos.z], id: occupied.name });
        }
        try {
          await this.safePlaceBlock(reference, faceVector, 'place');
          return this.ok('place', t0, { id, world: [worldPos.x, worldPos.y, worldPos.z], face });
        } catch (e: any) {
          const msg = String(e?.message || 'place_failed');
          const code = /timeout/i.test(msg) ? 'place_timeout' : 'runtime_error';
          return this.fail(code, msg, cmd, { id, world: [worldPos.x, worldPos.y, worldPos.z], face });
        }
      }
      if (name === 'equip') {
        const id = this.requireString(cmd.args[0]).value.replace('minecraft:', '');
        const item = this.bot.inventory.items().find((i) => i.name === id);
        if (!item) return this.fail('unavailable', `no ${id} in inventory`, cmd);
        await this.bot.equip(item, 'hand');
        return this.ok('equip', t0, { id });
      }
      if (name === 'build_up') {
        // Build one block upward by jumping and placing beneath
        // Optional block ID argument, otherwise uses any available building material
        const blockId = cmd.args[0] ? this.requireString(cmd.args[0]).value.replace('minecraft:', '') : null;

        // Find suitable building material
        let buildingMaterial;
        if (blockId) {
          buildingMaterial = this.bot.inventory.items().find((i) => i.name === blockId);
          if (!buildingMaterial) return this.fail('unavailable', `no ${blockId} in inventory`, cmd);
        } else {
          buildingMaterial = this.bot.inventory.items().find(item =>
            item.name.includes('dirt') ||
            item.name.includes('cobblestone') ||
            item.name.includes('stone') ||
            item.name.includes('planks') ||
            item.name.includes('log')
          );
          if (!buildingMaterial) return this.fail('unavailable', 'no building blocks (dirt/cobblestone/stone/planks/log)', cmd);
        }

        const startY = this.bot.entity.position.y;

        try {
          // Equip building material
          await this.bot.equip(buildingMaterial, 'hand');

          // Reference is the block directly under current feet
          const referenceBlock = this.bot.blockAt(this.bot.entity.position.offset(0, -1, 0));
          if (!referenceBlock) return this.fail('blocked', 'no reference block beneath', cmd);

          // Face down to make placement more reliable
          await this.bot.look(0, Math.PI / 2, true);

          // Set a jump target height and attempt placement once we are high enough
          const jumpY = Math.floor(this.bot.entity.position.y) + 1.0;
          let tryCount = 0;
          let placed = false;
          let lastError: any = null;

          const placeIfHighEnough = async () => {
            if (this.bot.entity.position.y > jumpY && !placed) {
              try {
                await this.bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
                placed = true;
                this.bot.setControlState('jump', false);
                (this.bot as any).removeListener('move', placeIfHighEnough);
              } catch (err: any) {
                lastError = err;
                tryCount++;
                if (tryCount > 10) {
                  this.bot.setControlState('jump', false);
                  (this.bot as any).removeListener('move', placeIfHighEnough);
                }
              }
            }
          };

          // Start jump and attach listener
          this.bot.setControlState('jump', true);
          (this.bot as any).on('move', placeIfHighEnough);

          // Wait until either placed or retries exhausted
          await new Promise<void>((resolve) => {
            const check = () => {
              if (placed || tryCount > 10) resolve();
              else setTimeout(check, 50);
            };
            setTimeout(check, 50);
          });

          // Ensure jump is off and listener removed
          this.bot.setControlState('jump', false);
          try { (this.bot as any).removeListener('move', placeIfHighEnough); } catch {}

          if (!placed) {
            // Diagnose state at failure
            const targetPos = referenceBlock.position.offset(0, 1, 0);
            const tgt = this.bot.blockAt(targetPos);
            const reason = tgt && tgt.name !== 'air' ? 'occupied' : (/timeout|timed out/i.test(String(lastError?.message)) ? 'place_timeout' : 'place_failed');
            return this.fail(reason, String(lastError?.message || `build_up_failed (${reason})`), cmd, {
              ref_id: referenceBlock.name,
              target: [targetPos.x, targetPos.y, targetPos.z],
              target_id: tgt?.name || 'air',
              held: buildingMaterial.name,
              try_count: tryCount,
              jumpY,
            });
          }

          const finalY = this.bot.entity.position.y;
          const heightGained = Math.floor(finalY - startY);
          return this.ok('build_up', t0, { block: buildingMaterial.name, height_gained: heightGained, y: Math.floor(finalY) });
        } catch (e: any) {
          this.bot.setControlState('jump', false);
          return this.fail('runtime_error', e?.message || 'build_up_failed', cmd);
        }
      }
      if (name === 'pickup_blocks') {
        // Pickup dropped items within radius
        const radius = cmd.args[0] ? Number(this.evalExprSync(cmd.args[0] as Expr)) : 8;

        if (radius < 1 || radius > 32) {
          return this.fail('invalid_arg', 'radius must be between 1 and 32', cmd);
        }

        // Find all dropped item entities within radius
        const itemEntities = Object.values(this.bot.entities).filter((entity: any) => {
          if (!entity || !entity.position) return false;
          if (entity.type !== 'object' || entity.objectType !== 'Item') return false;
          const distance = this.bot.entity.position.distanceTo(entity.position);
          return distance <= radius;
        });

        if (itemEntities.length === 0) {
          return this.ok('pickup_blocks', t0, { collected: 0, radius });
        }

        // Count inventory before
        const invBefore: { [key: string]: number } = {};
        this.bot.inventory.items().forEach(item => {
          invBefore[item.name] = (invBefore[item.name] || 0) + item.count;
        });

        // Move toward items to collect them
        const timeout = 5000; // 5 second timeout
        const startTime = Date.now();

        for (const itemEntity of itemEntities) {
          if (Date.now() - startTime > timeout) break;

          try {
            // Move close to item (items auto-pickup at ~1 block range)
            const goal = new goals.GoalNear(itemEntity.position.x, itemEntity.position.y, itemEntity.position.z, 1);
            await this.bot.pathfinder.goto(goal);

            // Wait briefly for pickup
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch {
            // Couldn't reach this item, continue to next
            continue;
          }
        }

        // Stop pathfinding
        this.bot.pathfinder.setGoal(null as any);

        // Count inventory after
        const invAfter: { [key: string]: number } = {};
        this.bot.inventory.items().forEach(item => {
          invAfter[item.name] = (invAfter[item.name] || 0) + item.count;
        });

        // Calculate what was collected
        const collected: { [key: string]: number } = {};
        for (const itemName in invAfter) {
          const before = invBefore[itemName] || 0;
          const after = invAfter[itemName];
          if (after > before) {
            collected[itemName] = after - before;
          }
        }

        const totalCollected = Object.values(collected).reduce((sum, count) => sum + count, 0);

        return this.ok('pickup_blocks', t0, {
          collected: totalCollected,
          items: collected,
          found: itemEntities.length,
          radius
        });
      }
      if (name === 'scan') {
        const named = this.namedArgs(cmd.args);
        const r = (named.r && Number(this.evalExprSync(named.r))) || this.options.defaultScanRadius;
        const snap = await get_vox(this.bot, r, false);
        return this.ok('scan', t0, { size: snap.window });
      }
      if (name === 'goto') {
        // Accept direct coordinates (x,y,z), world(), waypoint(), or selector
        const arg = cmd.args[0];

        // Capture starting position
        const fromPos = {
          x: Math.floor(this.bot.entity.position.x),
          y: Math.floor(this.bot.entity.position.y),
          z: Math.floor(this.bot.entity.position.z)
        };

        // Check if we have three coordinate arguments (x, y, z)
        if (cmd.args.length >= 3 &&
            (arg as any).type !== 'World' &&
            (arg as any).type !== 'Waypoint' &&
            (arg as any).type !== 'Selector') {
          // Direct coordinates: goto(x, y, z, tol:1)
          const x = Number(this.evalExprSync(cmd.args[0] as Expr));
          const y = Number(this.evalExprSync(cmd.args[1] as Expr));
          const z = Number(this.evalExprSync(cmd.args[2] as Expr));
          const named = this.namedArgs(cmd.args.slice(3));
          const tol = named.tol ? Number(this.evalExprSync(named.tol)) : 1;

          this.trace('movement', { cmd: 'goto', from: fromPos, to: { x, y, z } });
          await this.bot.pathfinder.goto(new goals.GoalNear(x, y, z, tol));

          const toPos = {
            x: Math.floor(this.bot.entity.position.x),
            y: Math.floor(this.bot.entity.position.y),
            z: Math.floor(this.bot.entity.position.z)
          };
          this.trace('movement', { cmd: 'goto', arrived: toPos });

          return this.ok('goto', t0, { world: [x, y, z] });
        }

        // Single argument cases
        const named = this.namedArgs(cmd.args.slice(1));
        const tol = named.tol ? Number(this.evalExprSync(named.tol)) : 1;
        if ((arg as any).type === 'World') {
          const w = arg as World;
          this.trace('movement', { cmd: 'goto', from: fromPos, to: { x: w.x, y: w.y, z: w.z } });
          await this.bot.pathfinder.goto(new goals.GoalNear(w.x, w.y, w.z, tol));

          const toPos = {
            x: Math.floor(this.bot.entity.position.x),
            y: Math.floor(this.bot.entity.position.y),
            z: Math.floor(this.bot.entity.position.z)
          };
          this.trace('movement', { cmd: 'goto', arrived: toPos });

          return this.ok('goto', t0, { world: [w.x, w.y, w.z] });
        } else if ((arg as any).type === 'Waypoint') {
          const name = (arg as Waypoint).name.value;
          const wp = await get_waypoint(this.bot.username, name);
          if (!wp) return this.fail('no_path', `unknown waypoint ${name}`, cmd);

          this.trace('movement', { cmd: 'goto', from: fromPos, to: { x: wp.x, y: wp.y, z: wp.z }, waypoint: name });
          await this.bot.pathfinder.goto(new goals.GoalNear(wp.x, wp.y, wp.z, tol));

          const toPos = {
            x: Math.floor(this.bot.entity.position.x),
            y: Math.floor(this.bot.entity.position.y),
            z: Math.floor(this.bot.entity.position.z)
          };
          this.trace('movement', { cmd: 'goto', arrived: toPos });

          return this.ok('goto', t0, { world: [wp.x, wp.y, wp.z] });
        } else if ((arg as any).type === 'Selector') {
          const pos = this.selectorToWorld(arg as SelAst);

          this.trace('movement', { cmd: 'goto', from: fromPos, to: { x: pos.x, y: pos.y, z: pos.z } });
          await this.bot.pathfinder.goto(new goals.GoalNear(pos.x, pos.y, pos.z, tol));

          const toPos = {
            x: Math.floor(this.bot.entity.position.x),
            y: Math.floor(this.bot.entity.position.y),
            z: Math.floor(this.bot.entity.position.z)
          };
          this.trace('movement', { cmd: 'goto', arrived: toPos });

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
      if (name === 'wait') {
        // Simple delay/wait command
        const ms = Number(this.evalExprSync(cmd.args[0] as Expr));
        if (ms < 0 || ms > 300000) {
          return this.fail('invalid_arg', 'wait time must be between 0 and 300000ms (5 min)', cmd);
        }
        await new Promise(resolve => setTimeout(resolve, ms));
        return this.ok('wait', t0, { ms });
      }
      if (name === 'craft') {
        // Craft items
        const itemId = this.requireString(cmd.args[0]).value.replace('minecraft:', '');
        const count = cmd.args[1] ? Number(this.evalExprSync(cmd.args[1] as Expr)) : 1;

        if (count < 1 || count > 64) {
          return this.fail('invalid_arg', 'count must be between 1 and 64', cmd);
        }

        const mcData = (this.bot as any).registry;
        const item = mcData.itemsByName[itemId];
        if (!item) return this.fail('invalid_arg', `unknown item: ${itemId}`, cmd);

        const recipes = this.bot.recipesFor(item.id, null, 1, null);
        if (!recipes || recipes.length === 0) {
          return this.fail('no_recipe', `no recipe for ${itemId}`, cmd);
        }

        const recipe = recipes[0];
        let craftingTable = null;

        // Check if crafting table needed
        if (recipe.inShape) {
          const shapeHeight = recipe.inShape.length;
          const shapeWidth = recipe.inShape[0]?.length || 0;
          if (shapeHeight > 2 || shapeWidth > 2) {
            craftingTable = this.bot.findBlock({
              matching: mcData.blocksByName.crafting_table.id,
              maxDistance: 32,
            });
            if (!craftingTable) {
              return this.fail('no_crafting_table', 'recipe requires crafting table', cmd);
            }
          }
        }

        try {
          let crafted = 0;
          for (let i = 0; i < count; i++) {
            await this.bot.craft(recipe, 1, craftingTable || undefined);
            crafted++;
          }
          return this.ok('craft', t0, { item: itemId, count: crafted, used_table: !!craftingTable });
        } catch (e: any) {
          return this.fail('craft_failed', e?.message || 'missing materials', cmd);
        }
      }
      if (name === 'log') {
        // Log arbitrary text to CraftScript logs (for testing/debugging)
        const t0 = Date.now();
        try {
          const parts: string[] = [];
          for (const a of cmd.args as any[]) {
            const val = (a && a.type === 'NamedArg') ? await this.evalExpr((a as any).value) : await this.evalExpr(a as any);
            parts.push(String(val));
          }
          const text = parts.join(' ');
          this.trace('log', { text });
          return this.ok('log', t0, { text });
        } catch (e: any) {
          return this.fail('runtime_error', e?.message || 'log_failed', cmd);
        }
      }
      if (name === 'block_info') {
        // Inspect a block at selector or world coordinates and log summary
        const t0 = Date.now();
        try {
          let pos: Vec3 | null = null;
          if ((cmd.args[0] as any)?.type === 'Selector') {
            pos = this.selectorToWorld(this.requireSelectorArg(cmd.args[0] as any));
          } else {
            const x = Number(this.evalExprSync(cmd.args[0] as any));
            const y = Number(this.evalExprSync(cmd.args[1] as any));
            const z = Number(this.evalExprSync(cmd.args[2] as any));
            if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) pos = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));
          }
          if (!pos) return this.fail('invalid_arg', 'block_info expects selector or x,y,z', cmd);
          const b = this.bot.blockAt(pos);
          if (!b) return this.fail('no_target', 'no block at position', cmd, { pos: [pos.x, pos.y, pos.z] });
          const info = {
            id: b.name,
            display: (b as any).displayName || b.name,
            hardness: (b as any).hardness ?? null,
            diggable: (b as any).diggable ?? null,
          };
          this.trace('block_info', { pos: [pos.x, pos.y, pos.z], ...info });
          return this.ok('block_info', t0, { pos: [pos.x, pos.y, pos.z], ...info });
        } catch (e: any) {
          return this.fail('runtime_error', e?.message || 'block_info_failed', cmd);
        }
      }
      if (name === 'plant') {
        // Plant sapling/crop at position
        const saplingId = this.requireString(cmd.args[0]).value.replace('minecraft:', '');
        const x = Number(this.evalExprSync(cmd.args[1] as Expr));
        const y = Number(this.evalExprSync(cmd.args[2] as Expr));
        const z = Number(this.evalExprSync(cmd.args[3] as Expr));

        const worldPos = new Vec3(x, y, z);
        const targetBlock = this.bot.blockAt(worldPos);

        if (!targetBlock || targetBlock.name !== 'air') {
          return this.fail('blocked', 'target position not air', cmd);
        }

        const item = this.bot.inventory.items().find((i) => i.name === saplingId);
        if (!item) return this.fail('unavailable', `no ${saplingId} in inventory`, cmd);

        try {
          await this.bot.equip(item, 'hand');
          const referenceBlock = this.bot.blockAt(worldPos.offset(0, -1, 0));
          if (!referenceBlock) return this.fail('no_reference', 'no block beneath', cmd);

          await this.safePlaceBlock(referenceBlock, new Vec3(0, 1, 0), 'plant');
          return this.ok('plant', t0, { sapling: saplingId, pos: [x, y, z] });
        } catch (e: any) {
          return this.fail('runtime_error', e?.message || 'plant_failed', cmd);
        }
      }
      if (name === 'open_container') {
        // Open chest/furnace/etc at position
        const x = Number(this.evalExprSync(cmd.args[0] as Expr));
        const y = Number(this.evalExprSync(cmd.args[1] as Expr));
        const z = Number(this.evalExprSync(cmd.args[2] as Expr));

        const worldPos = new Vec3(x, y, z);
        const containerBlock = this.bot.blockAt(worldPos);

        if (!containerBlock) {
          return this.fail('no_target', 'no block at position', cmd);
        }

        const containerTypes = ['chest', 'furnace', 'blast_furnace', 'smoker', 'barrel', 'dispenser', 'dropper', 'hopper'];
        if (!containerTypes.includes(containerBlock.name)) {
          return this.fail('invalid_target', `block is not a container: ${containerBlock.name}`, cmd);
        }

        try {
          this.openContainer = await this.openContainerWithRetry(containerBlock);
          return this.ok('open_container', t0, { type: containerBlock.name, pos: [x, y, z] });
        } catch (e: any) {
          return this.fail('runtime_error', e?.message || 'open_failed', cmd, {
            pos: [x, y, z],
            block: containerBlock?.name || 'unknown',
            hint: 'approach the container and retry',
          });
        }
      }
      if (name === 'open') {
        // Alias for open_container(x,y,z)
        const x = Number(this.evalExprSync(cmd.args[0] as Expr));
        const y = Number(this.evalExprSync(cmd.args[1] as Expr));
        const z = Number(this.evalExprSync(cmd.args[2] as Expr));
        const worldPos = new Vec3(x, y, z);
        const containerBlock = this.bot.blockAt(worldPos);
        if (!containerBlock) return this.fail('no_target', 'no block at position', cmd);
        try {
          this.openContainer = await this.openContainerWithRetry(containerBlock);
          return this.ok('open_container', t0, { type: containerBlock.name, pos: [x, y, z] });
        } catch (e: any) {
          return this.fail('runtime_error', e?.message || 'open_failed', cmd, {
            pos: [x, y, z],
            block: containerBlock?.name || 'unknown',
            hint: 'ensure container is loaded/reachable and not obstructed',
          });
        }
      }
      if (name === 'close_container') {
        // Close currently open container
        if (!this.openContainer) {
          return this.fail('no_container', 'no container currently open', cmd);
        }
        this.openContainer.close();
        this.openContainer = null;
        return this.ok('close_container', t0, {});
      }
      if (name === 'close') {
        if (!this.openContainer) return this.fail('no_container', 'no container currently open', cmd);
        this.openContainer.close();
        this.openContainer = null;
        return this.ok('close_container', t0, {});
      }
      if (name === 'container_put') {
        // Put items into open container
        if (!this.openContainer) {
          return this.fail('no_container', 'no container currently open', cmd);
        }

        const slotName = this.requireString(cmd.args[0]).value.toLowerCase();
        const itemId = this.requireString(cmd.args[1]).value.replace('minecraft:', '');
        const count = cmd.args[2] ? Number(this.evalExprSync(cmd.args[2] as Expr)) : 1;

        const item = this.bot.inventory.items().find((i) => i.name === itemId);
        if (!item) return this.fail('unavailable', `no ${itemId} in inventory`, cmd);

        const mcData = (this.bot as any).registry;
        const itemData = mcData.itemsByName[itemId];
        if (!itemData) return this.fail('invalid_arg', `unknown item: ${itemId}`, cmd);

        try {
          // Handle furnace slots
          if (this.openContainer.putInput) {
            if (slotName === 'input' || slotName === 'raw') {
              await this.openContainer.putInput(itemData.id, null, count);
              return this.ok('container_put', t0, { slot: slotName, item: itemId, count });
            } else if (slotName === 'fuel') {
              await this.openContainer.putFuel(itemData.id, null, count);
              return this.ok('container_put', t0, { slot: slotName, item: itemId, count });
            }
          }

          // Handle regular chest slots by slot number
          const slotNum = parseInt(slotName);
          if (!isNaN(slotNum)) {
            await this.openContainer.deposit(itemData.id, null, count);
            return this.ok('container_put', t0, { slot: slotNum, item: itemId, count });
          }

          return this.fail('invalid_slot', `unknown slot: ${slotName}`, cmd);
        } catch (e: any) {
          return this.fail('runtime_error', e?.message || 'put_failed', cmd);
        }
      }
      if (name === 'deposit') {
        // Convenience: deposit([x,y,z,] itemId, count?)
        let argIdx = 0;
        let mustClose = false;
        if (cmd.args.length >= 4) {
          const ax = this.asNumber(cmd.args[0] as Expr);
          const ay = this.asNumber(cmd.args[1] as Expr);
          const az = this.asNumber(cmd.args[2] as Expr);
          if (ax !== null && ay !== null && az !== null) {
            const x = ax, y = ay, z = az;
          // open-at-position
          const worldPos = new Vec3(x, y, z);
          const containerBlock = this.bot.blockAt(worldPos);
          if (!containerBlock) return this.fail('no_target', 'no block at position', cmd);
          try {
            this.openContainer = await this.openContainerWithRetry(containerBlock);
            mustClose = true;
          } catch (e: any) {
            return this.fail('runtime_error', e?.message || 'open_failed', cmd, {
              pos: [x, y, z],
              block: containerBlock?.name || 'unknown'
            });
          }
            argIdx = 3;
          }
        }

        if (!this.openContainer) return this.fail('no_container', 'no container currently open', cmd);
        const itemId = this.requireString(cmd.args[argIdx++] as any).value.replace('minecraft:', '');
        const mc = (this.bot as any).registry;
        const itemData = mc.itemsByName[itemId];
        if (!itemData) return this.fail('invalid_arg', `unknown item: ${itemId}`, cmd);

        // Determine count: default to all in inventory
        let count = 0;
        const invItem = this.bot.inventory.items().find((i) => i.name === itemId);
        if (!invItem) return this.fail('unavailable', `no ${itemId} in inventory`, cmd);
        if (cmd.args[argIdx]) count = Math.max(1, Number(this.evalExprSync(cmd.args[argIdx] as Expr)) | 0);
        else count = invItem.count;

        try {
          await this.openContainer.deposit(itemData.id, null, count);
          if (mustClose) { this.openContainer.close(); this.openContainer = null; }
          return this.ok('container_put', t0, { item: itemId, count });
        } catch (e: any) {
          return this.fail('runtime_error', e?.message || 'deposit_failed', cmd, {
            item: itemId,
            count,
            container: this.openContainer?.type || 'unknown'
          });
        }
      }
      if (name === 'container_take') {
        // Take items from open container
        if (!this.openContainer) {
          return this.fail('no_container', 'no container currently open', cmd);
        }

        const slotName = this.requireString(cmd.args[0]).value.toLowerCase();
        const count = cmd.args[1] ? Number(this.evalExprSync(cmd.args[1] as Expr)) : 1;

        try {
          // Handle furnace output
          if (this.openContainer.takeOutput && slotName === 'output') {
            const outputItem = this.openContainer.outputItem();
            if (!outputItem || outputItem.count === 0) {
              return this.fail('no_item', 'no items in output slot', cmd);
            }
            await this.openContainer.takeOutput();
            return this.ok('container_take', t0, { slot: slotName, item: outputItem.name, count: outputItem.count });
          }

          // Handle regular chest slots
          const slotNum = parseInt(slotName);
          if (!isNaN(slotNum) && this.openContainer.slots && this.openContainer.slots[slotNum]) {
            const slotItem = this.openContainer.slots[slotNum];
            await this.openContainer.withdraw(slotItem.type, null, Math.min(count, slotItem.count));
            return this.ok('container_take', t0, { slot: slotNum, item: slotItem.name, count: Math.min(count, slotItem.count) });
          }

          return this.fail('invalid_slot', `unknown or empty slot: ${slotName}`, cmd);
        } catch (e: any) {
          return this.fail('runtime_error', e?.message || 'take_failed', cmd);
        }
      }
      if (name === 'withdraw') {
        // Convenience: withdraw([x,y,z,] itemId, count?)
        let argIdx = 0;
        let mustClose = false;
        if (cmd.args.length >= 4) {
          const ax = this.asNumber(cmd.args[0] as Expr);
          const ay = this.asNumber(cmd.args[1] as Expr);
          const az = this.asNumber(cmd.args[2] as Expr);
          if (ax !== null && ay !== null && az !== null) {
            const x = ax, y = ay, z = az;
          // open-at-position
          const worldPos = new Vec3(x, y, z);
          const containerBlock = this.bot.blockAt(worldPos);
          if (!containerBlock) return this.fail('no_target', 'no block at position', cmd);
          try {
            this.openContainer = await this.openContainerWithRetry(containerBlock);
            mustClose = true;
          } catch (e: any) {
            return this.fail('runtime_error', e?.message || 'open_failed', cmd, {
              pos: [x, y, z],
              block: containerBlock?.name || 'unknown'
            });
          }
            argIdx = 3;
          }
        }

        if (!this.openContainer) return this.fail('no_container', 'no container currently open', cmd);
        const itemId = this.requireString(cmd.args[argIdx++] as any).value.replace('minecraft:', '');
        const mc = (this.bot as any).registry;
        const itemData = mc.itemsByName[itemId];
        if (!itemData) return this.fail('invalid_arg', `unknown item: ${itemId}`, cmd);
        // Determine available in container
        let available = 0;
        if (this.openContainer.slots) {
          for (const slot of this.openContainer.slots) if (slot && slot.name === itemId) available += slot.count;
        }
        let count = 0;
        if (cmd.args[argIdx]) count = Math.max(1, Number(this.evalExprSync(cmd.args[argIdx] as Expr)) | 0);
        else count = available || 1;

        try {
          await this.openContainer.withdraw(itemData.id, null, count);
          if (mustClose) { this.openContainer.close(); this.openContainer = null; }
          return this.ok('container_take', t0, { item: itemId, count });
        } catch (e: any) {
          return this.fail('runtime_error', e?.message || 'withdraw_failed', cmd, {
            item: itemId,
            count,
            container: this.openContainer?.type || 'unknown'
          });
        }
      }
      if (name === 'container_items') {
        // List items in open container
        if (!this.openContainer) {
          return this.fail('no_container', 'no container currently open', cmd);
        }

        const items: any = {};

        // Handle furnace
        if (this.openContainer.inputItem) {
          const input = this.openContainer.inputItem();
          const fuel = this.openContainer.fuelItem();
          const output = this.openContainer.outputItem();
          if (input) items.input = { name: input.name, count: input.count };
          if (fuel) items.fuel = { name: fuel.name, count: fuel.count };
          if (output) items.output = { name: output.name, count: output.count };
        }

        // Handle regular containers
        if (this.openContainer.slots) {
          items.slots = {};
          this.openContainer.slots.forEach((slot: any, index: number) => {
            if (slot) {
              items.slots[index] = { name: slot.name, count: slot.count };
            }
          });
        }

        return this.ok('container_items', t0, { items });
      }

      // Custom function invocation: check database for user-defined functions
      const customFunc = await this.resolveCustomFunction(name);
      if (customFunc) {
        return await this.executeCustomFunction(customFunc, cmd.args, cmd);
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
    if ((e as any).type === 'Identifier') {
      const n = (e as IdentifierExpr).name;
      if (this.vars.has(n)) return String(this.vars.get(n));
      return n;
    }
    if ((e as any).type === 'Number') return String((e as NumberLiteral).value);
    throw new Error('string-like required');
  }

  private evalExprSync(e: Expr): any {
    if ((e as any).type === 'Number') return (e as NumberLiteral).value;
    if ((e as any).type === 'Boolean') return (e as BooleanLiteral).value;
    if ((e as any).type === 'String') return (e as StringLiteral).value;
    if ((e as any).type === 'Identifier') {
      const n = (e as IdentifierExpr).name;
      return this.vars.has(n) ? this.vars.get(n) : n;
    }
    if ((e as any).type === 'BinaryExpr') {
      const be = e as any;
      const l = Number(this.evalExprSync(be.left));
      const r = Number(this.evalExprSync(be.right));
      switch (be.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return r === 0 ? Infinity : l / r;
      }
    }
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
        const n = (e as IdentifierExpr).name;
        return this.vars.has(n) ? this.vars.get(n) : n;
      case 'BinaryExpr':
        return this.evalExprSync(e);
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
    if (n === 'block_is') {
      // block_is(selector|x,y,z, id)
      const idArg = p.args[p.args.length - 1];
      const want = this.requireString(idArg as any).value.replace('minecraft:', '');
      try {
        if ((p.args[0] as any).type === 'Selector') {
          const pos = this.selectorToWorld(this.requireSelectorArg(p.args[0] as any));
          const b = this.bot.blockAt(pos);
          return !!b && b.name === want;
        } else {
          const x = Number(this.evalExprSync(p.args[0] as any));
          const y = Number(this.evalExprSync(p.args[1] as any));
          const z = Number(this.evalExprSync(p.args[2] as any));
          const b = this.bot.blockAt(new Vec3(Math.floor(x), Math.floor(y), Math.floor(z)));
          return !!b && b.name === want;
        }
      } catch (err: any) {
        throw new Error(`block_is_eval_failed: ${err?.message || String(err)}`);
      }
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
    const res = { ok: true, op, ms: Date.now() - t0, notes } as CraftscriptResult;
    try { this.options.onStep?.(res); } catch {}
    this.trace('ok', { op, notes });
    return res;
  }
  private fail(error: string, message: string, cmd: CommandStmt, details?: any): CraftscriptResult {
    const res = {
      ok: false,
      error,
      message,
      loc: (cmd.loc as any)?.start || undefined,
      op_index: this.ops,
      op: (cmd as any)?.name || undefined,
      ts: Date.now(),
      ...(details ? { notes: details } : {}),
    } as CraftscriptResult;
    try { this.options.onStep?.(res); } catch {}
    this.trace('fail', { error, message, details });
    return res;
  }

  // === Helpers ===
  private asNumber(expr: Expr): number | null {
    try { const v = Number(this.evalExprSync(expr)); return Number.isFinite(v) ? v : null; } catch { return null; }
  }

  /**
   * Log a block change to the database
   */
  private logBlockChange(action: 'placed' | 'destroyed', x: number, y: number, z: number, blockId: string, previousBlockId: string | null, command: string) {
    if (!this.options.db || !this.options.botId || !this.options.jobId) return;

    try {
      this.options.db.prepare(`
        INSERT INTO craftscript_block_changes (job_id, bot_id, timestamp, action, x, y, z, block_id, previous_block_id, command)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        this.options.jobId,
        this.options.botId,
        Math.floor(Date.now() / 1000),
        action,
        x,
        y,
        z,
        blockId,
        previousBlockId,
        command
      );
    } catch (error: any) {
      console.error(`[CraftScript] Error logging block change:`, error.message);
    }
  }

  private async safePlaceBlock(reference: any, face: Vec3, command: string, retries = 4): Promise<void> {
    const targetPos = reference.position.plus(face);
    const previousBlock = this.bot.blockAt(targetPos);
    const previousBlockId = previousBlock?.name || 'air';

    let lastErr: any = null;
    for (let i = 0; i < retries; i++) {
      try {
        await this.bot.placeBlock(reference, face);

        // Log the block change
        const placedBlock = this.bot.blockAt(targetPos);
        if (placedBlock) {
          this.logBlockChange('placed', targetPos.x, targetPos.y, targetPos.z, placedBlock.name, previousBlockId, command);
        }
        return;
      } catch (e: any) {
        lastErr = e;
        if (/timeout/i.test(String(e?.message || ''))) {
          await new Promise(r => setTimeout(r, 400 + i * 200));
          continue;
        }
        throw e;
      }
    }
    throw lastErr || new Error('place_timeout');
  }

  private async safeDigBlock(block: any, command: string): Promise<void> {
    const pos = block.position;
    const blockId = block.name;

    await this.bot.dig(block);

    // Log the block change
    this.logBlockChange('destroyed', pos.x, pos.y, pos.z, blockId, null, command);
  }
  private async openContainerWithRetry(block: any, retries = 3): Promise<any> {
    let lastErr: any = null;
    for (let i = 0; i < retries; i++) {
      try {
        if (block.name?.includes('furnace') || block.name === 'smoker') return await (this.bot as any).openFurnace(block);
        return await (this.bot as any).openContainer(block);
      } catch (e: any) {
        lastErr = e;
        if (/timeout|windowopen|timed out/i.test(String(e?.message || ''))) {
          await new Promise(r => setTimeout(r, 500 + i * 300));
          continue;
        }
        throw e;
      }
    }
    throw lastErr || new Error('container_timeout');
  }
  private bumpOps() {
    this.ops++;
    if (this.ops > this.options.opLimit) throw new Error('op_limit_exceeded');
  }

  /**
   * Resolve a custom function from the database
   */
  private async resolveCustomFunction(name: string): Promise<CustomFunction | null> {
    if (!this.options.db || !this.options.botId) return null;

    try {
      const row = this.options.db.prepare(
        'SELECT * FROM craftscript_functions WHERE bot_id = ? AND name = ?'
      ).get(this.options.botId, name);

      if (!row) return null;

      return {
        ...row,
        args: JSON.parse(row.args),
      } as CustomFunction;
    } catch (error: any) {
      console.error(`[CraftScript] Error resolving custom function "${name}":`, error.message);
      return null;
    }
  }

  /**
   * Execute a custom function with named arguments
   */
  private async executeCustomFunction(func: CustomFunction, callArgs: any[], cmd: CommandStmt): Promise<CraftscriptResult> {
    const t0 = Date.now();

    // Check recursion depth
    if (this.functionCallDepth >= this.MAX_FUNCTION_DEPTH) {
      return this.fail('runtime_error', `Maximum function call depth (${this.MAX_FUNCTION_DEPTH}) exceeded`, cmd);
    }

    try {
      // Extract named arguments from call
      const named = this.namedArgs(callArgs);

      // Validate and bind arguments
      const argValues = new Map<string, any>();
      for (const argDef of func.args) {
        const argName = argDef.name;

        if (named[argName]) {
          // Argument provided
          argValues.set(argName, await this.evalExpr(named[argName]));
        } else if (argDef.optional && argDef.default !== undefined) {
          // Use default value
          argValues.set(argName, argDef.default);
        } else if (!argDef.optional) {
          // Required argument missing
          return this.fail('compile_error', `Missing required argument "${argName}" for function "${func.name}"`, cmd);
        }
      }

      // Parse function body
      let ast: Program;
      try {
        ast = parseCraft(func.body);
      } catch (e: any) {
        return this.fail('compile_error', `Failed to parse custom function "${func.name}": ${e.message}`, cmd);
      }

      // Save current variable state
      const savedVars = new Map(this.vars);

      // Set function arguments as variables
      for (const [name, value] of argValues) {
        this.vars.set(name, value);
      }

      // Increment depth and execute function body
      this.functionCallDepth++;
      try {
        for (const st of ast.body) {
          if (st.type === 'Command') {
            const result = await this.execStatement(st);
            if (result && !result.ok) {
              // Restore state and return error
              this.vars = savedVars;
              this.functionCallDepth--;
              return result;
            }
          } else {
            await this.execStatement(st);
          }
        }
      } finally {
        // Restore variable state and depth
        this.vars = savedVars;
        this.functionCallDepth--;
      }

      return this.ok('custom_function', t0, { name: func.name, version: func.current_version });
    } catch (e: any) {
      return this.fail('runtime_error', `Error executing custom function "${func.name}": ${e.message}`, cmd);
    }
  }

  private tryEvalWorldCoords(args: any[]): Vec3 | null {
    if (!args || args.length < 3) return null;
    try {
      const x = Number(this.evalExprSync(args[0] as Expr));
      const y = Number(this.evalExprSync(args[1] as Expr));
      const z = Number(this.evalExprSync(args[2] as Expr));
      if ([x, y, z].some((v) => Number.isNaN(v))) return null;
      return new Vec3(x, y, z);
    } catch {
      return null;
    }
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
