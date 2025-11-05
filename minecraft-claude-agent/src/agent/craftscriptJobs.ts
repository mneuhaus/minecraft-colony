import { MinecraftBot } from '../bot/MinecraftBot.js';
import { CraftscriptExecutor } from '../craftscript/executor.js';
import { parse as parseCraft } from '../craftscript/parser.js';

type JobState = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

interface Job {
  id: string;
  state: JobState;
  script: string;
  startedAt?: number;
  endedAt?: number;
  lastStep?: any;
  error?: string;
}

const JOBS = new Map<string, Job>();

function uid(): string {
  return 'cs_' + Math.random().toString(36).slice(2, 10);
}

export function createCraftscriptJob(minecraftBot: MinecraftBot, script: string): string {
  const id = uid();
  const job: Job = { id, state: 'queued', script };
  JOBS.set(id, job);
  runJob(minecraftBot, job).catch(() => {});
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

async function runJob(minecraftBot: MinecraftBot, job: Job): Promise<void> {
  try {
    const bot = minecraftBot.getBot();
    job.state = 'running';
    job.startedAt = Date.now();
    const ast = parseCraft(job.script);
    const exec = new CraftscriptExecutor(bot);
    const result = await exec.run(ast as any);
    for (const r of result.results) {
      job.lastStep = r;
      if (!r.ok) {
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
  } catch (e: any) {
    if (job.state === 'canceled') return;
    job.state = 'failed';
    job.error = e?.message || String(e);
    job.endedAt = Date.now();
  }
}

function JOB_CANCELLED(job: Job): boolean {
  return job.state === 'canceled';
}

