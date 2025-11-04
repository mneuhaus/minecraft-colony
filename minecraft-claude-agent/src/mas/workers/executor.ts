import { JobQueue } from '../queue.js';
import { JobRecord } from '../types.js';
import { parseMcrn, parseOffsetTokens, McrnOp } from '../mcrn.js';
import { MinecraftBot } from '../../bot/MinecraftBot.js';

export class ExecutorWorker {
  private timer?: NodeJS.Timeout;
  private stepCounter: Record<string, number> = {};

  constructor(private queue: JobQueue, private minecraftBot: MinecraftBot) {}

  start() {
    this.timer = setInterval(() => this.tick(), 500);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  private tick() {
    const leased = this.queue.leaseNextJob('executor');
    if (!leased) return;
    this.handleJob(leased);
  }

  private async handleJob(job: JobRecord) {
    try {
      this.queue.startJob(job.id);
      const status = this.queue.getJobStatus(job.id)!;
      const plan = status.payload.plan_mcrn || '';
      const ops = parseMcrn(plan);
      this.stepCounter[job.id] = 0;
      const runOps = async (opList: McrnOp[]) => {
        for (const op of opList) {
          const i = ++this.stepCounter[job.id];
          const started = Date.now();
          try {
            if (op.type === 'REPEAT') {
              for (let k = 0; k < op.times; k++) {
                await runOps(op.body);
              }
              continue;
            }
            if (op.type === 'GOTO_WAYPOINT') {
              const wp = await this.getWaypoint(op.name);
              if (!wp) throw new Error(`Waypoint ${op.name} not found`);
              await this.goto(wp.x, wp.y, wp.z, op.tol ?? 1);
              this.queue.appendStep({ job_id: job.id, i, op: 'GOTO', outcome: 'ok', ms: Date.now() - started, details: { waypoint: op.name } });
            } else if (op.type === 'LOOK_AT_WAYPOINT') {
              const wp = await this.getWaypoint(op.name);
              if (!wp) throw new Error(`Waypoint ${op.name} not found`);
              await this.lookAt(wp.x, wp.y, wp.z);
              this.queue.appendStep({ job_id: job.id, i, op: 'LOOK_AT', outcome: 'ok', ms: Date.now() - started, details: { waypoint: op.name } });
            } else if (op.type === 'GOTO_WORLD') {
              await this.goto(op.x, op.y, op.z, op.tol ?? 1);
              this.queue.appendStep({ job_id: job.id, i, op: 'GOTO_WORLD', outcome: 'ok', ms: Date.now() - started, details: { x: op.x, y: op.y, z: op.z } });
            } else if (op.type === 'LOOK_AT_WORLD') {
              await this.lookAt(op.x, op.y, op.z);
              this.queue.appendStep({ job_id: job.id, i, op: 'LOOK_AT_WORLD', outcome: 'ok', ms: Date.now() - started, details: { x: op.x, y: op.y, z: op.z } });
            } else if (op.type === 'TURN') {
              await this.turn(op.dir);
              this.queue.appendStep({ job_id: job.id, i, op: 'TURN', outcome: 'ok', ms: Date.now() - started, details: { dir: op.dir } });
            } else if (op.type === 'MOVE') {
              const t = this.resolveOffset(op.offset);
              await this.goto(t.x, t.y, t.z, 1);
              this.queue.appendStep({ job_id: job.id, i, op: 'MOVE', outcome: 'ok', ms: Date.now() - started, details: { offset: op.offset, x: t.x, y: t.y, z: t.z } });
            } else if (op.type === 'PLACE') {
              const t = this.resolveOffset(op.offset);
              const msg = await this.safePlace(op.block, t.x, t.y, t.z);
              const ok = msg.startsWith('Placed');
              this.queue.appendStep({ job_id: job.id, i, op: 'PLACE', outcome: ok ? 'ok' : 'warn', ms: Date.now() - started, details: { offset: op.offset, block: op.block, message: msg } });
              if (!ok) throw new Error(msg);
            } else if (op.type === 'DIG') {
              const t = this.resolveOffset(op.offset);
              const msg = await this.safeDig(t.x, t.y, t.z);
              const ok = !/^Failed/i.test(msg);
              this.queue.appendStep({ job_id: job.id, i, op: 'DIG', outcome: ok ? 'ok' : 'warn', ms: Date.now() - started, details: { offset: op.offset, message: msg } });
              if (!ok) throw new Error(msg);
            }
          } catch (e: any) {
            this.queue.appendStep({ job_id: job.id, i, op: (op as any).type, outcome: 'fail', ms: Date.now() - started, details: { error: e.message } });
            this.queue.failJob(job.id, e.message);
            throw e;
          }
        }
      };
      await runOps(ops);
      this.queue.completePhase(job.id, undefined);
    } catch (err: any) {
      this.queue.failJob(job.id, `Executor error: ${err.message}`);
    }
  }

  private async getWaypoint(name: string): Promise<{ x: number; y: number; z: number } | null> {
    // Waypoints are stored by existing tools in JSON under logs/waypoints/<bot>.json (see tools/navigation/waypoints)
    // Reuse that module to fetch
    const bot = this.minecraftBot.getBot();
    const mod = await import('../../tools/navigation/waypoints.js');
    const wp = await mod.get_waypoint(bot.username, name);
    return wp ? { x: wp.x, y: wp.y, z: wp.z } : null;
  }

  private async goto(x: number, y: number, z: number, range: number) {
    const bot = this.minecraftBot.getBot();
    const pathfinderPkg = await import('mineflayer-pathfinder');
    const lib: any = (pathfinderPkg as any).default || (pathfinderPkg as any);
    const goals = lib.goals;
    const goal = new goals.GoalNear(x, y, z, range);
    await bot.pathfinder.goto(goal);
  }

  private async lookAt(x: number, y: number, z: number) {
    const bot = this.minecraftBot.getBot();
    const { Vec3 } = await import('vec3');
    await bot.lookAt(new Vec3(x, y, z), true);
  }

  // TURN helper
  private async turn(dir: 'R90' | 'L90' | '180') {
    const bot = this.minecraftBot.getBot();
    let yaw = bot.entity.yaw;
    if (dir === 'R90') yaw -= Math.PI / 2;
    if (dir === 'L90') yaw += Math.PI / 2;
    if (dir === '180') yaw += Math.PI;
    await bot.look(yaw, bot.entity.pitch, true);
  }

  // Resolve relative offsets like F1+U1 against current bot orientation
  private resolveOffset(offset: string): { x: number; y: number; z: number } {
    const bot = this.minecraftBot.getBot();
    const base = bot.entity.position;
    const tokens = parseOffsetTokens(offset);
    // Compute forward unit from yaw
    const yaw = bot.entity.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const F = { x: Math.round(fx), z: Math.round(fz) };
    const R = { x: -F.z, z: F.x };
    let dx = 0, dy = 0, dz = 0;
    for (const t of tokens) {
      if (t.axis === 'F') { dx += F.x * t.n; dz += F.z * t.n; }
      if (t.axis === 'B') { dx -= F.x * t.n; dz -= F.z * t.n; }
      if (t.axis === 'R') { dx += R.x * t.n; dz += R.z * t.n; }
      if (t.axis === 'L') { dx -= R.x * t.n; dz -= R.z * t.n; }
      if (t.axis === 'U') { dy += t.n; }
      if (t.axis === 'D') { dy -= t.n; }
    }
    return { x: Math.floor(base.x) + dx, y: Math.floor(base.y) + dy, z: Math.floor(base.z) + dz };
  }

  // PLACE implementation with helpful warnings
  private async safePlace(blockName: string, x: number, y: number, z: number): Promise<string> {
    const bot = this.minecraftBot.getBot();
    const { Vec3 } = await import('vec3');
    const targetPos = new Vec3(x, y, z);
    const floor = (v: number) => Math.floor(v);
    const dist = bot.entity.position.distanceTo(targetPos);
    if (dist > 4.5) return `Cannot place ${blockName} at (${x},${y},${z}): out of reach (${dist.toFixed(1)}). Move closer.`;

    // Occupancy checks
    const selfAt = floor(bot.entity.position.x) === x && floor(bot.entity.position.y) === y && floor(bot.entity.position.z) === z;
    if (selfAt) return `Cannot place ${blockName} at (${x},${y},${z}): bot is standing on the target.`;
    const occ = Object.values(bot.entities).find((e: any) => e && e.position && e !== bot.entity && floor(e.position.x) === x && floor(e.position.y) === y && floor(e.position.z) === z);
    if (occ) return `Cannot place ${blockName} at (${x},${y},${z}): occupied by ${occ.username || occ.name || occ.type}.`;

    // Ensure block in hand
    const item = bot.inventory.items().find((i) => i.name.toLowerCase() === blockName.toLowerCase());
    if (!item) return `Cannot place ${blockName}: not in inventory.`;
    await bot.equip(item, 'hand');

    // Find a solid reference around target to place against
    const neighbors = [new Vec3(0,-1,0), new Vec3(0,1,0), new Vec3(1,0,0), new Vec3(-1,0,0), new Vec3(0,0,1), new Vec3(0,0,-1)];
    let ref: any = null; let face: any = null;
    for (const n of neighbors) {
      const cand = bot.blockAt(targetPos.plus(n));
      if (cand && cand.name !== 'air') { ref = cand; face = n.scaled(-1); break; }
    }
    if (!ref) return `Cannot place ${blockName} at (${x},${y},${z}): no adjacent support block to place against.`;

    try {
      await Promise.race([
        bot.placeBlock(ref, face),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
      ]);
      return `Placed ${blockName} at (${x}, ${y}, ${z})`;
    } catch (e: any) {
      await new Promise((r) => setTimeout(r, 100));
      const verify = bot.blockAt(targetPos);
      if (verify && verify.name !== 'air') return `Placed ${blockName} at (${x}, ${y}, ${z})`;
      return e?.message?.includes('Timeout')
        ? `Timeout while placing ${blockName} at (${x}, ${y}, ${z}). Target may be obstructed or out of reach.`
        : `Failed to place ${blockName} at (${x}, ${y}, ${z}): ${e?.message || 'unknown error'}`;
    }
  }

  // DIG implementation with basic safety
  private async safeDig(x: number, y: number, z: number): Promise<string> {
    const bot = this.minecraftBot.getBot();
    const { Vec3 } = await import('vec3');
    const pos = new Vec3(x, y, z);
    const block = bot.blockAt(pos);
    if (!block || block.name === 'air') return `Failed to dig: no block at (${x},${y},${z})`;
    // Avoid digging overhead sand/gravel without mitigation
    const above = bot.blockAt(pos.offset(0, 1, 0));
    if (above && (above.name.includes('sand') || above.name.includes('gravel'))) {
      return `Failed to dig: gravity block above (${above.name}) — use top‑down mitigation first.`;
    }
    await bot.dig(block);
    return `Dug ${block.name} at (${x}, ${y}, ${z})`;
  }
}
