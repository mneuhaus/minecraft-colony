import { MasDatabase, now } from './db.js';
import { EnqueueIntentRequest, IntentPayload, JobPayloadRecord, JobPhase, JobRecord, JobState, JobStatus } from './types.js';
import crypto from 'crypto';

type LeaseTarget = 'tactician' | 'executor';

export class JobQueue {
  constructor(private db: MasDatabase) {}

  enqueueIntent(req: EnqueueIntentRequest, defaultBotId: string): string {
    const botId = req.bot_id || defaultBotId;
    const id = this.generateId();
    const created = now();
    const priority = req.priority || 'normal';
    const intent: IntentPayload = req.intent;

    const db = this.db.handle();
    const insertJob = db.prepare(
      `INSERT INTO jobs (id, bot_id, priority, kind, phase, state, created_at, updated_at)
       VALUES (@id, @bot_id, @priority, 'intent', 'plan', 'queued', @created_at, @created_at)`
    );
    const insertPayload = db.prepare(
      `INSERT INTO jobs_payloads (job_id, intent_type, intent_args, constraints, target, stop_conditions)
       VALUES (@job_id, @intent_type, @intent_args, @constraints, @target, @stop_conditions)`
    );

    const tx = db.transaction(() => {
      insertJob.run({ id, bot_id: botId, priority, created_at: created });
      insertPayload.run({
        job_id: id,
        intent_type: intent.type,
        intent_args: JSON.stringify(intent.args || {}),
        constraints: JSON.stringify(intent.constraints || {}),
        target: JSON.stringify(intent.target || null),
        stop_conditions: intent.stop_conditions || null,
      });
    });

    tx();
    return id;
  }

  getJobStatus(jobId: string): JobStatus | null {
    const db = this.db.handle();
    const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as JobRecord | undefined;
    if (!job) return null;
    const payloadRow = db.prepare(`SELECT * FROM jobs_payloads WHERE job_id = ?`).get(jobId) as any;
    const payload: JobPayloadRecord = payloadRow
      ? {
          job_id: payloadRow.job_id,
          intent_type: payloadRow.intent_type || null,
          intent_args: payloadRow.intent_args ? JSON.parse(payloadRow.intent_args) : null,
          constraints: payloadRow.constraints ? JSON.parse(payloadRow.constraints) : null,
          // @ts-ignore
          target: payloadRow.target ? JSON.parse(payloadRow.target) : null,
          stop_conditions: payloadRow.stop_conditions || null,
          plan_mcrn: payloadRow.plan_mcrn || null,
          plan_summary: payloadRow.plan_summary ? JSON.parse(payloadRow.plan_summary) : null,
        }
      : { job_id: jobId } as any;
    return { ...job, payload } as JobStatus;
  }

  pauseJob(jobId: string) {
    this.updateState(jobId, 'paused');
  }
  resumeJob(jobId: string) {
    // Resume keeps phase; set state to queued
    this.setState(jobId, 'queued');
  }
  cancelJob(jobId: string) {
    const db = this.db.handle();
    db.prepare(`UPDATE jobs SET state='canceled', phase='canceled', ended_at=@t, updated_at=@t WHERE id=@id`).run({ id: jobId, t: now() });
  }

  private updateState(jobId: string, state: JobState) {
    const db = this.db.handle();
    db.prepare(`UPDATE jobs SET state=@state, updated_at=@t WHERE id=@id`).run({ id: jobId, state, t: now() });
  }

  private setState(jobId: string, state: JobState) {
    this.updateState(jobId, state);
  }

  leaseNextJob(target: LeaseTarget, botId?: string): JobRecord | null {
    const db = this.db.handle();
    const t = now();
    const leaseMs = 15000; // 15s
    const newLease = t + leaseMs;

    let phase: JobPhase = target === 'tactician' ? 'plan' : 'exec';

    const select = db.prepare(
      `SELECT * FROM jobs
       WHERE phase=@phase
         AND state IN ('queued','leased')
         AND (lease_until IS NULL OR lease_until < @t)
         ${botId ? 'AND bot_id=@botId' : ''}
       ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, created_at ASC
       LIMIT 1`
    );

    const job = select.get({ phase, t, botId }) as JobRecord | undefined;
    if (!job) return null;

    const update = db.prepare(
      `UPDATE jobs SET state='leased', lease_until=@lease, updated_at=@t WHERE id=@id`
    );
    update.run({ id: job.id, lease: newLease, t });
    return { ...job, state: 'leased', lease_until: newLease } as JobRecord;
  }

  startJob(jobId: string) {
    const db = this.db.handle();
    db.prepare(`UPDATE jobs SET state='running', started_at=@t, updated_at=@t WHERE id=@id`).run({ id: jobId, t: now() });
  }

  completePhase(jobId: string, nextPhase?: JobPhase) {
    const db = this.db.handle();
    const t = now();
    if (nextPhase) {
      db.prepare(`UPDATE jobs SET phase=@nextPhase, state='queued', lease_until=NULL, updated_at=@t WHERE id=@id`).run({ id: jobId, nextPhase, t });
    } else {
      db.prepare(`UPDATE jobs SET phase='done', state='success', ended_at=@t, updated_at=@t WHERE id=@id`).run({ id: jobId, t });
    }
  }

  failJob(jobId: string, error: string) {
    const db = this.db.handle();
    const t = now();
    db.prepare(`UPDATE jobs SET phase='failed', state='fail', error=@error, ended_at=@t, updated_at=@t WHERE id=@id`).run({ id: jobId, error, t });
  }

  savePlan(jobId: string, plan_mcrn: string, plan_summary?: any) {
    const db = this.db.handle();
    db.prepare(`UPDATE jobs_payloads SET plan_mcrn=@plan, plan_summary=@summary WHERE job_id=@id`).run({ id: jobId, plan: plan_mcrn, summary: plan_summary ? JSON.stringify(plan_summary) : null });
  }

  appendStep(step: { job_id: string; i: number; op: string; outcome: 'ok' | 'warn' | 'fail'; ms: number; details?: any }) {
    const db = this.db.handle();
    db.prepare(`INSERT INTO job_steps (job_id,i,ts,op,outcome,ms,details) VALUES (@job_id,@i,@ts,@op,@outcome,@ms,@details)`).run({
      job_id: step.job_id,
      i: step.i,
      ts: now(),
      op: step.op,
      outcome: step.outcome,
      ms: step.ms,
      details: step.details ? JSON.stringify(step.details) : null,
    });
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
