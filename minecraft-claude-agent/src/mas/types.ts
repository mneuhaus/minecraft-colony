export type IntentType =
  | 'NAVIGATE'
  | 'STAIRS_TO_SURFACE'
  | 'STAIRS_DOWN_TO_Y'
  | 'TUNNEL_FORWARD'
  | 'BRANCH_MINE'
  | 'HARVEST_TREE'
  | 'RUN_CRAFTSCRIPT'
  | 'GATHER_RESOURCE';

export type JobKind = 'intent' | 'program';
export type JobPhase = 'plan' | 'exec' | 'done' | 'failed' | 'canceled' | 'paused';
export type JobState = 'queued' | 'leased' | 'running' | 'paused' | 'success' | 'fail' | 'canceled';

export interface IntentPayload {
  type: IntentType;
  args: Record<string, any>;
  constraints?: Record<string, any>;
  target?: any;
  stop_conditions?: string | null;
}

export interface EnqueueIntentRequest {
  bot_id?: string; // default current bot
  priority?: 'high' | 'normal' | 'low';
  intent: IntentPayload;
}

export interface JobRecord {
  id: string;
  bot_id: string;
  priority: 'high' | 'normal' | 'low';
  kind: JobKind;
  phase: JobPhase;
  state: JobState;
  created_at: number;
  started_at?: number | null;
  updated_at: number;
  ended_at?: number | null;
  lease_until?: number | null;
  error?: string | null;
}

export interface JobPayloadRecord {
  job_id: string;
  intent_type?: IntentType | null;
  intent_args?: any | null;
  constraints?: any | null;
  target?: any | null;
  stop_conditions?: string | null;
  plan_script?: string | null;
  plan_summary?: any | null;
}

export interface JobStepRecord {
  id?: number;
  job_id: string;
  i: number;
  ts: number;
  op: string;
  outcome: 'ok' | 'warn' | 'fail';
  ms: number;
  details?: any;
}

export interface JobStatus extends JobRecord {
  payload: JobPayloadRecord;
}
