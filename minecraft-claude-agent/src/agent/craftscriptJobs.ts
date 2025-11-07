import { MinecraftBot } from '../bot/MinecraftBot.js';
import { CraftscriptExecutor } from '../craftscript/executor.js';
import { parse as parseCraft } from '../craftscript/parser.js';
import { ActivityWriter } from '../utils/activityWriter.js';
import { SqlMemoryStore } from '../utils/sqlMemoryStore.js';

type JobState = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

interface Job {
  id: string;
  state: JobState;
  script: string;
  startedAt?: number;
  endedAt?: number;
  lastStep?: any;
  error?: string;
  memoryStore?: SqlMemoryStore | null;
  getSessionId?: () => string | null;
}

const JOBS = new Map<string, Job>();

function uid(): string {
  return 'cs_' + Math.random().toString(36).slice(2, 10);
}

export function createCraftscriptJob(minecraftBot: MinecraftBot, script: string, activityWriter?: ActivityWriter, botName?: string, memoryStore?: SqlMemoryStore | null, getSessionId?: () => string | null): string {
  const id = uid();
  const job: Job = { id, state: 'queued', script, memoryStore: memoryStore || null, getSessionId };
  JOBS.set(id, job);
  runJob(minecraftBot, job, activityWriter, botName).catch(() => {});
  return id;
}

export function getCraftscriptStatus(id: string): Job | null {
  return JOBS.get(id) || null;
}

export function cancelCraftscriptJob(id: string): void {
  const job = JOBS.get(id);
  if (!job) return;
  if (job.state === 'completed' || job.state === 'failed' || job.state === 'canceled') return;
  job.state = 'canceled';
  job.endedAt = Date.now();
}

async function runJob(minecraftBot: MinecraftBot, job: Job, activityWriter?: ActivityWriter, botName?: string): Promise<void> {
  try {
    const bot = minecraftBot.getBot();
    job.state = 'running';
    job.startedAt = Date.now();

    console.log('[CraftScript] Parsing script:', job.script.substring(0, 100) + (job.script.length > 100 ? '...' : ''));
    const ast = parseCraft(job.script);
    console.log('[CraftScript] Parsed successfully, executing...');

    const exec = new CraftscriptExecutor(bot, {
      onStep: (r) => {
        try {
          if (!activityWriter) return;
          activityWriter.addActivity({
            type: 'tool',
            message: 'Tool: craftscript_step',
            details: {
              name: 'craftscript_step',
              tool_name: 'craftscript_step',
              input: {},
              params_summary: {},
              output: JSON.stringify({ ...r, job_id: job.id }),
              duration_ms: (r as any).ms ?? 0
            },
            role: 'tool',
            speaker: botName || minecraftBot.getBot().username || 'bot'
          });
          // Persist in memory store for dashboard broadcasting via DB
          try {
            if (job.memoryStore) {
              const sid = (job.getSessionId && job.getSessionId()) || job.memoryStore.getLastActiveSessionId();
              if (sid) job.memoryStore.addActivity(sid, 'tool', 'craftscript_step', { job_id: job.id, step: r });
            }
          } catch {}
        } catch {}
      },
      onTrace: (t) => {
        try {
          if (!activityWriter) return;
          activityWriter.addActivity({
            type: 'tool',
            message: 'Tool: craftscript_trace',
            details: {
              name: 'craftscript_trace',
              tool_name: 'craftscript_trace',
              input: {},
              params_summary: {},
              output: JSON.stringify({ ...t, job_id: job.id }),
              duration_ms: 0
            },
            role: 'tool',
            speaker: botName || minecraftBot.getBot().username || 'bot'
          });
          try {
            if (job.memoryStore) {
              const sid = (job.getSessionId && job.getSessionId()) || job.memoryStore.getLastActiveSessionId();
              if (sid) job.memoryStore.addActivity(sid, 'tool', 'craftscript_trace', { job_id: job.id, trace: t });
            }
          } catch {}
        } catch {}
      }
    });
    const result = await exec.run(ast as any);

    console.log('[CraftScript] Execution completed:', {
      ok: result.ok,
      totalResults: result.results.length,
      failed: result.results.filter(r => !r.ok).length
    });

    // Steps were already streamed via onStep callback above.

    for (const r of result.results) {
      job.lastStep = r;
      if (!r.ok) {
        console.error('[CraftScript] Step failed:', {
          error: r.error,
          message: r.message,
          op_index: r.op_index
        });
        job.state = 'failed';
        job.error = r.message || 'craftscript_failed';
        job.endedAt = Date.now();
        return;
      }
      if (JOB_CANCELLED(job)) return;
    }
    if (JOB_CANCELLED(job)) return;
    job.state = 'completed';
    job.endedAt = Date.now();
    console.log('[CraftScript] Job completed successfully');
  } catch (e: any) {
    if (job.state === 'canceled') return;
    console.error('[CraftScript] Job failed with exception:', e);
    job.state = 'failed';
    job.error = e?.message || String(e);
    job.endedAt = Date.now();
    try {
      if (activityWriter) {
        activityWriter.addActivity({ type: 'error', message: 'CraftScript error', details: { error: job.error, stack: e?.stack }, role: 'system', speaker: botName || minecraftBot.getBot().username || 'bot' });
      }
    } catch {}
  }
}

function JOB_CANCELLED(job: Job): boolean {
  return job.state === 'canceled';
}
