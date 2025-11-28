import { MinecraftBot } from '../bot/MinecraftBot.js';
import { JavaScriptExecutor } from '../craftscript/jsExecutor.js';
import { ActivityWriter } from '../utils/activityWriter.js';
import { SqlMemoryStore } from '../utils/sqlMemoryStore.js';
import { ColonyDatabase } from '../database/ColonyDatabase.js';

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
  activityWriter?: ActivityWriter;
  botName?: string;
  abortController?: AbortController;
}

const JOBS = new Map<string, Job>();

export type CraftscriptEvent = {
  id: string;
  state: JobState;
  script: string;
  error?: any;
  botName?: string;
};

type CraftscriptListener = (event: CraftscriptEvent) => void;

const craftscriptListeners = new Set<CraftscriptListener>();

function emitCraftscriptEvent(event: CraftscriptEvent) {
  for (const listener of craftscriptListeners) {
    try {
      listener(event);
    } catch (error: any) {
      console.error('[CraftScript] Event listener error:', error?.message || error);
    }
  }
}

export function onCraftscriptEvent(listener: CraftscriptListener): () => void {
  craftscriptListeners.add(listener);
  return () => craftscriptListeners.delete(listener);
}

function craftscriptErrorChatEnabled(): boolean {
  const env = process.env.CRAFTSCRIPT_ERROR_CHAT_ENABLED ?? process.env.CRAFTSCRIPT_CHAT_ENABLED ?? 'false';
  return env.toLowerCase() !== 'false';
}

function chatCraftscriptError(minecraftBot: MinecraftBot, jobId: string, type: string, message: string, line?: number, column?: number) {
  if (!craftscriptErrorChatEnabled()) return;
  const location = typeof line === 'number' ? `Zeile ${line}${typeof column === 'number' ? `:${column}` : ''}` : '';
  const detail = [location?.trim(), message?.trim()].filter(Boolean).join(' – ') || 'Unbekannter Fehler';
  const prefix = type === 'compile_error' ? 'CraftScript-Syntaxfehler' : 'CraftScript-Fehler';
  const text = `${prefix} (${jobId}): ${detail}`.slice(0, 240);
  try {
    minecraftBot.chat(text);
  } catch {}
}

function uid(): string {
  return 'cs_' + Math.random().toString(36).slice(2, 10);
}

export function createCraftscriptJob(minecraftBot: MinecraftBot, script: string, activityWriter?: ActivityWriter, botName?: string, memoryStore?: SqlMemoryStore | null, getSessionId?: () => string | null): string {
  const id = uid();
  const job: Job = { id, state: 'queued', script, memoryStore: memoryStore || null, getSessionId, activityWriter, botName };
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

  // Abort the running script
  if (job.abortController) {
    job.abortController.abort();
  }

  job.state = 'canceled';
  job.endedAt = Date.now();
  // Emit a canceled status so UI can update the originating card
  try {
    const st: any = { id: job.id, state: 'canceled', script: job.script, duration_ms: (job.endedAt - (job.startedAt || job.endedAt)) };
    if (job.activityWriter) {
      job.activityWriter.addActivity({
        type: 'tool',
        message: 'Tool: craftscript_status',
        details: { name: 'craftscript_status', tool_name: 'craftscript_status', input: { job_id: job.id }, params_summary: { job_id: job.id }, output: JSON.stringify(st), duration_ms: 0 },
        role: 'tool',
        speaker: job.botName || 'bot'
      });
    }
    if (job.memoryStore) {
      const sid = (job.getSessionId && job.getSessionId()) || job.memoryStore.getLastActiveSessionId();
      if (sid) job.memoryStore.addActivity(sid, 'tool', 'craftscript_status', st);
    }
  } catch {}
}

async function runJob(minecraftBot: MinecraftBot, job: Job, activityWriter?: ActivityWriter, botName?: string): Promise<void> {
  try {
    const bot = minecraftBot.getBot();
    job.state = 'running';
    job.startedAt = Date.now();

    // Create AbortController for cancellation support
    job.abortController = new AbortController();

    console.log('[JavaScript] Executing script:', job.script.substring(0, 100) + (job.script.length > 100 ? '...' : ''));

    // Get database connection and bot ID
    const colonyDb = ColonyDatabase.getInstance();
    const db = colonyDb.getDb();
    const botId = colonyDb.getBotId(botName || minecraftBot.getBot().username || 'bot');

    const exec = new JavaScriptExecutor();
    await exec.initialize();

    const result = await exec.execute(job.script, bot, {
      db,
      botId: botId || undefined,
      jobId: job.id,
      abortSignal: job.abortController.signal,
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

    console.log('[JavaScript] Execution result:', {
      ok: result.ok,
      duration_ms: result.duration_ms,
      hasError: !!result.error
    });

    if (!result.ok && result.error) {
      console.error('[JavaScript] Execution failed:', result.error);
      job.state = 'failed';
      job.error = result.error.message || 'javascript_failed';
      job.endedAt = Date.now();

      // Emit a fail step
      try {
        const step = { ok: false, error: result.error.type, message: result.error.message, op_index: 0, ts: Date.now() };
        if (activityWriter) activityWriter.addActivity({ type: 'tool', message: 'Tool: craftscript_step', details: { name: 'craftscript_step', tool_name: 'craftscript_step', input: {}, params_summary: {}, output: JSON.stringify({ ...step, job_id: job.id }), duration_ms: 0 }, role: 'tool', speaker: botName || minecraftBot.getBot().username || 'bot' });
        if (job.memoryStore) {
          const sid = (job.getSessionId && job.getSessionId()) || job.memoryStore.getLastActiveSessionId();
          if (sid) job.memoryStore.addActivity(sid, 'tool', 'craftscript_step', { job_id: job.id, step });
        }
      } catch {}

      // Emit a status row
      try {
        const status = {
          id: job.id,
          state: 'failed',
          script: job.script,
          duration_ms: result.duration_ms,
          error: result.error
        } as any;
        if (activityWriter) activityWriter.addActivity({ type: 'tool', message: 'Tool: craftscript_status', details: { name: 'craftscript_status', tool_name: 'craftscript_status', input: { job_id: job.id }, params_summary: { job_id: job.id }, output: JSON.stringify(status), duration_ms: 0 }, role: 'tool', speaker: botName || minecraftBot.getBot().username || 'bot' });
        if (job.memoryStore) {
          const sid = (job.getSessionId && job.getSessionId()) || job.memoryStore.getLastActiveSessionId();
          if (sid) job.memoryStore.addActivity(sid, 'tool', 'craftscript_status', status);
        }
      } catch {}

      chatCraftscriptError(minecraftBot, job.id, result.error.type, result.error.message, result.error.line, result.error.column);
      emitCraftscriptEvent({
        id: job.id,
        state: 'failed',
        script: job.script,
        error: result.error,
        botName,
      });
      return;
    }

    // Success
    job.state = 'completed';
    job.endedAt = Date.now();

    // Emit success status
    try {
      const status = {
        id: job.id,
        state: 'completed',
        script: job.script,
        duration_ms: result.duration_ms,
      } as any;
      if (activityWriter) activityWriter.addActivity({ type: 'tool', message: 'Tool: craftscript_status', details: { name: 'craftscript_status', tool_name: 'craftscript_status', input: { job_id: job.id }, params_summary: { job_id: job.id }, output: JSON.stringify(status), duration_ms: 0 }, role: 'tool', speaker: botName || minecraftBot.getBot().username || 'bot' });
      if (job.memoryStore) {
        const sid = (job.getSessionId && job.getSessionId()) || job.memoryStore.getLastActiveSessionId();
        if (sid) job.memoryStore.addActivity(sid, 'tool', 'craftscript_status', status);
      }
    } catch {}

    emitCraftscriptEvent({
      id: job.id,
      state: 'completed',
      script: job.script,
      botName,
    });

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
    // Emit fail step + status for visibility
    try {
      const step = { ok: false, error: 'runtime_error', message: job.error, op_index: 0, ts: Date.now() };
      if (activityWriter) activityWriter.addActivity({ type: 'tool', message: 'Tool: craftscript_step', details: { name: 'craftscript_step', tool_name: 'craftscript_step', input: {}, params_summary: {}, output: JSON.stringify({ ...step, job_id: job.id }), duration_ms: 0 }, role: 'tool', speaker: botName || minecraftBot.getBot().username || 'bot' });
      if (job.memoryStore) {
        const sid = (job.getSessionId && job.getSessionId()) || job.memoryStore.getLastActiveSessionId();
        if (sid) job.memoryStore.addActivity(sid, 'tool', 'craftscript_step', { job_id: job.id, step });
        const st = { id: job.id, state: 'failed', script: job.script, duration_ms: (job.endedAt - (job.startedAt || job.endedAt)), error: { type: 'runtime_error', message: job.error } } as any;
        job.memoryStore.addActivity(sid!, 'tool', 'craftscript_status', st);
      }
    } catch {}
    chatCraftscriptError(minecraftBot, job.id, 'runtime_error', job.error || 'Unbekannter Fehler');
    emitCraftscriptEvent({
      id: job.id,
      state: 'failed',
      script: job.script,
      error: { type: 'runtime_error', message: job.error },
      botName
    });
  }
}
