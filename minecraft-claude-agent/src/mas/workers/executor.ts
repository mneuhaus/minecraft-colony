import { JobQueue } from '../queue.js';
import { JobRecord } from '../types.js';
import { parseMcrn } from '../mcrn.js';
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
      for (const op of ops) {
        const i = ++this.stepCounter[job.id];
        const started = Date.now();
        try {
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
          }
        } catch (e: any) {
          this.queue.appendStep({ job_id: job.id, i, op: op.type, outcome: 'fail', ms: Date.now() - started, details: { error: e.message } });
          this.queue.failJob(job.id, e.message);
          return;
        }
      }
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
    const goals = (pathfinderPkg as any).goals;
    const goal = new goals.GoalNear(x, y, z, range);
    await bot.pathfinder.goto(goal);
  }

  private async lookAt(x: number, y: number, z: number) {
    const bot = this.minecraftBot.getBot();
    const { Vec3 } = await import('vec3');
    await bot.lookAt(new Vec3(x, y, z), true);
  }
}

