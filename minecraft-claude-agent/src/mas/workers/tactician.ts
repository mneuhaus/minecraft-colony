import { JobQueue } from '../queue.js';
import { IntentPayload, JobRecord } from '../types.js';

function compileIntentToMcrn(intent: IntentPayload): { plan: string; summary: any } {
  // Very small initial compiler supporting NAVIGATE to WAYPOINT or HARVEST_TREE → NAVIGATE to nearest waypoint named 'trees' (placeholder)
  switch (intent.type) {
    case 'NAVIGATE': {
      const target = intent.target;
      if (target?.type === 'WAYPOINT' && typeof target.name === 'string') {
        const tol = intent.args?.tolerance ?? 1;
        return {
          plan: `GOTO @ WAYPOINT("${target.name}") tol=${tol};\nLOOK_AT @ WAYPOINT("${target.name}");`,
          summary: { est_steps: 1, materials: [], risks: [] },
        };
      }
      if (target?.type === 'WORLD' && Number.isFinite(target.x) && Number.isFinite(target.y) && Number.isFinite(target.z)) {
        const tol = intent.args?.tolerance ?? 1;
        return {
          plan: `GOTO @ WORLD(${Math.floor(target.x)}, ${Math.floor(target.y)}, ${Math.floor(target.z)}) tol=${tol};\nLOOK_AT @ WORLD(${Math.floor(target.x)}, ${Math.floor(target.y)}, ${Math.floor(target.z)});`,
          summary: { est_steps: 1, materials: [], risks: [] },
        };
      }
      break;
    }
    case 'HARVEST_TREE': {
      // For now just navigate to a waypoint the user must set ("trees")
      return {
        plan: `GOTO @ WAYPOINT("trees") tol=2;`,
        summary: { est_steps: 1, materials: ['axe?'], risks: ['hostiles at night'] },
      };
    }
  }

  // Default: no-op plan
  return { plan: '', summary: { est_steps: 0, materials: [], risks: ['uncompiled_intent'] } };
}

export class TacticianWorker {
  private timer?: NodeJS.Timeout;

  constructor(private queue: JobQueue) {}

  start() {
    this.timer = setInterval(() => this.tick(), 500);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  private tick() {
    const leased = this.queue.leaseNextJob('tactician');
    if (!leased) return;
    this.handleJob(leased);
  }

  private handleJob(job: JobRecord) {
    try {
      this.queue.startJob(job.id);
      const status = this.queue.getJobStatus(job.id)!;
      const intent: IntentPayload | null = status.payload.intent_type
        ? {
            type: status.payload.intent_type as any,
            args: status.payload.intent_args || {},
            constraints: status.payload.constraints || {},
            target: status.payload.target,
            stop_conditions: status.payload.stop_conditions || undefined,
          }
        : null;
      if (!intent) {
        this.queue.failJob(job.id, 'Missing intent payload');
        return;
      }
      const { plan, summary } = compileIntentToMcrn(intent);
      this.queue.savePlan(job.id, plan, summary);
      this.queue.completePhase(job.id, 'exec');
    } catch (err: any) {
      this.queue.failJob(job.id, `Tactician error: ${err.message}`);
    }
  }
}
