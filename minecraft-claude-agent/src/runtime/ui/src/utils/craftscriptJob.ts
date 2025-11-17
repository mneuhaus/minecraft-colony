import type { TimelineItem } from '../main';

export interface CraftscriptSnapshot {
  jobId: string | null;
  script: string;
  statuses: Array<{ ts: number; state: string; duration_ms?: number; error?: any }>;
  steps: Array<{ ts: number; ok: boolean; summary: string; raw: any }>;
  traces: Array<{ ts: number; kind: string; data: any }>;
  voxWindows: Array<{ ts: number; vox: any; target?: any; label?: string; source?: string }>;
  logs: Array<{ ts: number; kind: string; data: any }>;
}

export function deriveJobIdFromEvent(event: any): string | null {
  if (!event) return null;
  const payload = event.payload || {};
  const candidates: any[] = [
    payload.job_id,
    payload.jobId,
    payload.input?.job_id,
    payload.input?.jobId,
    payload.params_summary?.job_id,
    payload.params_summary?.id,
    payload.details?.job_id,
    event.details?.job_id,
    event.job_id,
  ];
  const parsedOutput = parseJson(payload.output);
  if (parsedOutput) {
    candidates.push(
      parsedOutput.job_id,
      parsedOutput.id,
      parsedOutput.payload?.job_id,
      parsedOutput.payload?.id
    );
  }
  for (const candidate of candidates) {
    if (candidate) return String(candidate);
  }
  return null;
}

function ingestVoxEntries(snapshot: CraftscriptSnapshot, data: any, ts: number, source: string) {
  if (!data) return;
  const pushEntry = (vox: any, target?: any, label?: string) => {
    if (!vox) return;
    snapshot.voxWindows.push({ ts, vox, target, label, source });
  };
  const inspectNode = (node: any, labelHint?: string) => {
    if (!node) return;
    if (node.vox) {
      pushEntry(node.vox, node.world || node.target, labelHint || node.label || source);
    }
    const path = node.vox_path;
    if (Array.isArray(path)) {
      path.forEach((segment: any, idx: number) => {
        pushEntry(segment.vox, segment.pos || segment.target, segment.label || labelHint || `${source}-path-${idx}`);
      });
    }
    if (node.notes) inspectNode(node.notes, labelHint || 'notes');
    if (node.debug) inspectNode(node.debug, labelHint || 'debug');
  };
  inspectNode(data, data.label || source);
}

export function collectCraftscriptSnapshot(items: TimelineItem[], targetJobId?: string | null): CraftscriptSnapshot {
  const snapshot: CraftscriptSnapshot = {
    jobId: targetJobId ?? null,
    script: '',
    statuses: [],
    steps: [],
    traces: [],
    voxWindows: [],
    logs: [],
  };

  for (const item of items) {
    const payload = item?.payload || {};
    const toolName = String(payload.tool_name || payload.name || '').toLowerCase();
    if (!isCraftscriptTool(toolName)) continue;
    const data = parseJson(payload.output) ?? payload.output ?? {};
    const jobId = String(data?.job_id || data?.id || payload?.params_summary?.job_id || payload?.input?.job_id || '').trim();
    if (snapshot.jobId && jobId && snapshot.jobId !== jobId) continue;
    if (!snapshot.jobId && jobId) snapshot.jobId = jobId;

    if (toolName === 'craftscript_start') {
      const script = extractScriptFromPayload(payload);
      if (script) snapshot.script = script;
      continue;
    }

    if (toolName === 'craftscript_logs') {
      const logs = Array.isArray(data?.logs) ? data.logs : [];
      for (const entry of logs) {
        const ts = entry.ts || item.ts || Date.now();
        snapshot.logs.push({ ts, kind: entry.kind || 'log', data: entry });
        ingestVoxEntries(snapshot, entry.data, ts, 'log');
      }
      continue;
    }

    if (toolName === 'craftscript_status') {
      const ts = item.ts || Date.now();
      snapshot.statuses.push({
        ts,
        state: data?.state || 'unknown',
        duration_ms: data?.duration_ms,
        error: data?.error,
      });
      ingestVoxEntries(snapshot, data, ts, 'status');
      continue;
    }

    if (toolName === 'craftscript_step') {
      const step = data?.step || data;
      if (!step) continue;
      const ts = item.ts || step.ts || Date.now();
      snapshot.steps.push({
        ts,
        ok: Boolean(step.ok),
        summary: summarizeStep(step),
        raw: step,
      });
      ingestVoxEntries(snapshot, step, ts, 'step');
      continue;
    }

    if (toolName === 'craftscript_trace') {
      if (data?.trace) {
        const ts = data.trace.ts || item.ts || Date.now();
        snapshot.traces.push({ ts, kind: data.trace.kind || 'trace', data: data.trace });
        ingestVoxEntries(snapshot, data.trace, ts, 'trace');
      } else {
        const ts = item.ts || Date.now();
        snapshot.traces.push({ ts, kind: 'changes', data });
        ingestVoxEntries(snapshot, data, ts, 'trace');
      }
      continue;
    }
  }

  return snapshot;
}

function isCraftscriptTool(tool: string): boolean {
  return /craftscript_/.test(tool);
}

function parseJson(value: any): any {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  if (typeof value === 'object') return value;
  return null;
}

export function extractScriptFromEvent(event: any): string {
  if (!event) return '';
  return extractScriptFromPayload(event.payload);
}

function extractScriptFromPayload(payload: any): string {
  if (!payload) return '';
  const candidates = [
    payload?.input?.script,
    payload?.params_summary?.script,
    payload?.params_summary?.input?.script,
    payload?.output?.script,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  const parsed = parseJson(payload?.output);
  if (parsed?.script) return parsed.script;
  return '';
}

function summarizeStep(step: any): string {
  if (!step) return '';
  if (step.ok) return `ok ${step.op ?? ''}`.trim();
  const err = step.error || step.message || 'unknown error';
  return `fail ${err}`;
}
