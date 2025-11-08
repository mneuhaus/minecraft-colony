<template>
  <MessageBlock
    eyebrow="CraftScript"
    title="Script"
    :tone="tone"
    padding="lg"
    :shadow="true"
  >
    <template #meta>
      <span v-if="activeJobId" class="cs-chip cs-chip--muted">job {{ activeJobId }}</span>
      <span class="cs-chip" :class="[`cs-chip--${status.state || 'unknown'}`]">{{ status.state }}</span>
      <span class="cs-chip cs-chip--muted">{{ lineCount }} lines</span>
    </template>
    <template #actions>
      <button class="cs-btn" :disabled="running" @click="runAgain">{{ running ? 'Running…' : 'Run Again' }}</button>
      <button class="cs-btn" @click="showLogs = !showLogs">{{ showLogs ? 'Hide Logs' : 'Show Logs' }}</button>
      <button class="cs-btn" :disabled="!activeJobId" @click="toggleTrace">{{ showTrace ? 'Hide Trace' : 'View Trace' }}</button>
    </template>

    <pre class="tool-output"><code class="language-javascript hljs" v-html="highlightedCode"></code></pre>

    <section v-if="showLogs" class="cs-panel">
      <header class="cs-panel__header">
        <span>Logs</span>
        <span class="cs-panel__meta" v-if="activeJobId">job {{ activeJobId }}</span>
      </header>
      <p v-if="logs.length === 0" class="cs-panel__empty">
        No logs yet for this script (status: {{ status.state }}).
      </p>
      <div v-else class="cs-logs__list">
        <div v-for="log in logs" :key="log.id" class="cs-log">
          <span class="cs-log__time">{{ fmtTs(log.ts) }}</span>
          <span class="cs-log__kind" :data-kind="log.kind">{{ log.kind }}</span>
          <span class="cs-log__msg">{{ log.msg }}</span>
        </div>
      </div>
    </section>

    <section v-if="showTrace" class="cs-panel">
      <header class="cs-panel__header">
        <span>Block Changes</span>
        <span class="cs-panel__meta" v-if="traceData">{{ traceData.total_changes || 0 }} changes</span>
      </header>
      <p v-if="loadingTrace" class="cs-panel__empty">Loading trace data...</p>
      <p v-else-if="!traceData || !traceData.changes || traceData.changes.length === 0" class="cs-panel__empty">
        No block changes recorded for this script execution.
      </p>
      <div v-else class="cs-trace__list">
        <div v-for="(change, idx) in traceData.changes" :key="idx" class="cs-trace-item">
          <span class="cs-trace-item__action" :data-action="change.action">{{ change.action }}</span>
          <span class="cs-trace-item__block">{{ change.block_id }}</span>
          <span class="cs-trace-item__pos">@ {{ change.x }}, {{ change.y }}, {{ change.z }}</span>
          <span v-if="change.command" class="cs-trace-item__cmd">{{ change.command }}</span>
        </div>
      </div>
    </section>
  </MessageBlock>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import MessageBlock from '../../MessageBlock.vue';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import 'highlight.js/styles/github-dark-dimmed.css';

// Register JavaScript language
hljs.registerLanguage('javascript', javascript);

const props = defineProps<{ item: any }>();
const store = inject<any>('store');
const running = ref(false);
const showLogs = ref(false);
const showTrace = ref(false);
const loadingTrace = ref(false);
const traceData = ref<any>(null);

const payload = computed(() => props.item.payload || {});

// Find job id from tool output (craftscript_start returns { job_id })
const jobIdFromCard = computed(() => {
  try {
    const out = payload.value?.output;
    const o = typeof out === 'string' ? JSON.parse(out) : out;
    return o?.job_id || null;
  } catch { return null; }
});
const botId = computed(()=> props.item?.bot_id || null);
const latestJobIdForBot = computed(()=> {
  const items = store.items || [];
  const ids: Array<{id:string, ts:number}> = [];
  for (const it of items) {
    if (botId.value && it.bot_id && it.bot_id !== botId.value) continue;
    const name = String(it?.payload?.tool_name || it?.tool_name || '').toLowerCase();
    if (!/craftscript_(trace|step|status)/.test(name)) continue;
    try {
      const raw = it?.payload?.output;
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const jobId = data?.job_id || data?.id;
      if (jobId) ids.push({ id: jobId, ts: it.ts || 0 });
    } catch {}
  }
  if (!ids.length) return null;
  ids.sort((a,b)=> (b.ts||0)-(a.ts||0));
  return ids[0].id;
});
const activeJobId = computed(()=> jobIdFromCard.value || latestJobIdForBot.value);

// Track latest status for this job (running/completed/failed)
const status = computed(() => {
  const id = activeJobId.value;
  const items = store.items || [];
  let latest: any = null;
  for (const it of items) {
    const name = String(it?.payload?.tool_name || it?.tool_name || '').toLowerCase();
    if (name !== 'craftscript_status') continue;
    try {
      const raw = it?.payload?.output;
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const jid = data?.id || data?.job_id;
      if (jid && (!id || jid === id)) {
        if (!latest || (it.ts || 0) > (latest.ts || 0)) latest = { ts: it.ts || 0, state: data?.state || 'unknown', duration_ms: data?.duration_ms ?? 0, error: data?.error || null };
      }
    } catch {}
  }
  return latest || { state: (jobIdFromCard.value ? 'queued' : 'unknown'), duration_ms: 0, error: null };
});

const tone = computed(() => {
  const state = String(status.value.state || '').toLowerCase();
  if (status.value.error || state === 'failed' || state === 'error') return 'danger';
  if (state === 'completed' || state === 'ok') return 'success';
  if (state === 'running' || state === 'queued') return 'info';
  return 'neutral';
});

// Extract script from various possible locations
const script = computed(() => {
  const data = payload.value;
  if (typeof data?.input?.script === 'string' && data.input.script.trim()) return data.input.script;
  if (typeof data?.params_summary?.script === 'string' && data.params_summary.script.trim()) return data.params_summary.script;
  if (typeof data?.params_summary?.input?.script === 'string' && data.params_summary.input.script.trim()) return data.params_summary.input.script;
  if (typeof data?.output?.script === 'string' && data.output.script.trim()) return data.output.script;
  return '';
});

const lines = computed(() => script.value ? script.value.split(/\r?\n/) : []);
const lineCount = computed(() => lines.value.filter(l => l.length > 0).length);

// Generate highlighted HTML
const highlightedCode = computed(() => {
  try {
    const full = script.value || '';
    console.log('[ToolCraftScript] Highlighting code, length:', full.length);
    const result = hljs.highlight(full, { language: 'javascript' });
    console.log('[ToolCraftScript] Highlight result:', result.value.substring(0, 100));
    return result.value;
  } catch (e) {
    console.error('[ToolCraftScript] Failed to highlight code:', e);
    return script.value;
  }
});

async function runAgain(){
  if (!script.value.trim()) return;
  running.value = true;
  try {
    // Resolve bot name from event's bot_id when available, else use active bot name
    let botName: any = store?.activeBot;
    const bid = props.item?.bot_id;
    try {
      if (bid && Array.isArray(store?.bots)) {
        const b = store.bots.find((x:any)=> x.id === bid);
        if (b?.name) botName = b.name;
      }
    } catch {}
    if (!botName) throw new Error('no_bot_selected');
    const res = await fetch(`/api/bots/${encodeURIComponent(botName)}/craftscript`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script: script.value })
    });
    if (!res.ok) {
      let data: any = null; try { data = await res.json(); } catch {}
      const msg = (data && (data.error || data.hint)) ? `${data.error}${data.hint? ` — ${data.hint}`:''}` : 'request_failed';
      throw new Error(msg);
    }
    // The agent will report back via timeline (tool + status). No-op here.
  } catch (e: any) {
    alert(`Failed to start CraftScript: ${e?.message || e}`);
  } finally {
    running.value = false;
  }
}

async function toggleTrace() {
  showTrace.value = !showTrace.value;

  if (showTrace.value && !traceData.value) {
    const job = activeJobId.value;
    if (!job) {
      console.warn('[toggleTrace] No active job ID');
      showTrace.value = false;
      return;
    }

    loadingTrace.value = true;
    try {
      console.log('[toggleTrace] Fetching trace for job:', job);
      const res = await fetch(`/api/craftscript/${encodeURIComponent(job)}/trace`);

      if (!res.ok) {
        const text = await res.text();
        console.error('[toggleTrace] Failed to fetch trace:', text);
        alert(`Failed to load trace data: ${text}`);
        showTrace.value = false;
        return;
      }

      traceData.value = await res.json();
      console.log('[toggleTrace] Loaded trace data:', traceData.value);
    } catch (error: any) {
      console.error('[toggleTrace] Error fetching trace:', error);
      alert(`Error loading trace data: ${error.message || error}`);
      showTrace.value = false;
    } finally {
      loadingTrace.value = false;
    }
  }
}

// Consolidated logs under the CraftScript card
const logs = computed(() => {
  const id = activeJobId.value; if (!id) return [] as any[];
  const items = store.items || [];
  const out: any[] = [];
  for (const it of items) {
    const name = String(it?.payload?.tool_name || it?.tool_name || '').toLowerCase();
    if (!/craftscript_(trace|step|status)/.test(name)) continue;
    let data: any = null;
    try {
      const raw = it?.payload?.output;
      data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {}
    if (!data) continue;
    const jid = data.job_id || data.id || it?.payload?.params_summary?.job_id;
    if (jid !== id) continue;

    if (/trace/.test(name)) {
      const t = data.trace || data; // DB shape vs stream shape
      const kind = t.kind || 'trace';
      const msg = summarizeTrace(t);
      out.push({ id: it.id || `${name}-${it.ts}`, ts: it.ts || Date.now(), kind, msg });
      continue;
    }

    if (/step/.test(name)) {
      const s = data.step || data; // DB shape vs stream shape
      const msg = summarizeStep(s);
      out.push({ id: it.id || `${name}-${it.ts}`, ts: it.ts || Date.now(), kind: s.ok ? 'ok' : 'fail', msg });
      continue;
    }

    if (/status/.test(name)) {
      const st = data; // status has shape { id, state, script, duration_ms }
      const msg = summarizeStatus(st);
      const k = st.state === 'completed' ? 'ok' : (st.state === 'failed' ? 'fail' : 'status');
      out.push({ id: it.id || `${name}-${it.ts}`, ts: it.ts || Date.now(), kind: k, msg });
      continue;
    }
  }
  out.sort((a,b)=> (a.ts||0)-(b.ts||0));
  return out;
});

function summarizeTrace(t:any): string {
  switch (t.kind) {
    case 'log': return String(t.text || '');
    case 'block_info': return `block_info ${t.id || ''} @ ${Array.isArray(t.pos)? t.pos.join(',') : ''}`;
    case 'if': return `if → ${t.value ? 'true' : 'false'}`;
    case 'repeat_init': return `repeat init ${t.var ? `${t.var}=`:''}${t.count ?? `${t.start}..${t.end}${t.step?':'+t.step:''}`}`;
    case 'repeat_iter': return `repeat iter ${t.var??'i'}=${t.value}`;
    case 'repeat_end': return `repeat end`;
    case 'var_set': return `${t.name} = ${t.value}`;
    case 'predicate': return `predicate ${t.name} → ${t.result}`;
    case 'ok': return `ok ${t.op}`;
    case 'fail': return `fail ${t.error}`;
  }
  return '';
}
function summarizeStep(s:any): string {
  if (s.ok) return `✓ ${s.op}${s.notes? ' '+JSON.stringify(s.notes):''}`;
  const notes = s.notes ? ` ${JSON.stringify(s.notes)}` : '';
  return `✗ ${s.error}${s.message? ' — '+s.message:''}${notes}`;
}
function summarizeStatus(st:any): string {
  const d = typeof st.duration_ms === 'number' ? ` in ${st.duration_ms}ms` : '';
  return `status ${st.state}${d}`;
}
function fmtTs(ts:number){
  const d = new Date(ts||Date.now());
  return d.toLocaleTimeString();
}
</script>

<style scoped>
.cs-btn {
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--font-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  transition: border-color var(--transition-base), color var(--transition-base);
}
.cs-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
.cs-btn:not([disabled]):hover { border-color: var(--color-accent); color: var(--color-accent); }

.cs-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-xs);
  border: 1px solid var(--color-border-subtle);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.cs-chip--muted { color: var(--color-text-muted); }
.cs-chip--completed { border-color: rgba(52,211,153,0.4); color: var(--color-success); }
.cs-chip--failed { border-color: rgba(248,113,113,0.4); color: var(--color-danger); }
.cs-chip--running { border-color: rgba(74,158,255,0.4); color: var(--color-accent); }

.tool-output {
  margin-top: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-muted);
  padding: var(--spacing-sm);
  font-size: var(--font-sm);
  max-height: 420px;
  overflow: auto;
}

.cs-panel {
  margin-top: var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: rgba(255,255,255,0.01);
  padding: var(--spacing-md);
}
.cs-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
  font-weight: 600;
}
.cs-panel__meta { font-size: var(--font-xs); color: var(--color-text-muted); }
.cs-panel__empty { margin: 0; color: var(--color-text-muted); font-style: italic; }

.cs-logs__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
.cs-log {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: var(--spacing-sm);
  font-size: var(--font-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
  background: rgba(255,255,255,0.02);
}
.cs-log__time { font-family: 'Courier New', monospace; color: var(--color-text-muted); }
.cs-log__kind { text-transform: uppercase; font-size: var(--font-xs); font-weight: 600; color: var(--color-accent); }
.cs-log__msg { color: var(--color-text-primary); }

.cs-trace__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
.cs-trace-item {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: var(--spacing-sm);
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
}
.cs-trace-item__action[data-action='placed'] { color: var(--color-success); }
.cs-trace-item__action[data-action='destroyed'] { color: var(--color-danger); }
.cs-trace-item__block { font-family: 'Courier New', monospace; }
.cs-trace-item__pos { color: var(--color-text-muted); font-size: var(--font-xs); }
.cs-trace-item__cmd { color: var(--color-accent); font-size: var(--font-xs); }
</style>
