<template>
  <div class="tl-item__body">
    <div class="tl-hdr">
      <div class="tl-kv">
        <span class="tl-kv__key">CraftScript</span>
        <span class="tl-kv__val">{{ lineCount }} line(s)</span>
      </div>
      <div class="tl-actions">
        <span class="tl-status" :data-state="status.state">{{ status.state.toUpperCase() }}</span>
        <button class="tl-btn" :disabled="running" @click="runAgain">{{ running ? 'Running…' : 'Run Again' }}</button>
        <button class="tl-btn" @click="showLogs = !showLogs">{{ showLogs ? 'Hide Logs' : 'Show Logs' }}</button>
      </div>
    </div>
    <pre class="tool-output"><code class="language-javascript hljs" v-html="highlightedCode"></code></pre>

    <div v-if="showLogs" class="cs-logs">
      <div class="cs-logs__hdr">
        <span class="cs-logs__title">Logs</span>
        <span class="cs-logs__meta" v-if="activeJobId">job {{ activeJobId }}</span>
      </div>
      <div v-if="logs.length === 0" class="cs-logs__empty">No logs yet for this script (status: {{ status.state }}).</div>
      <div v-else class="cs-logs__list">
        <div v-for="log in logs" :key="log.id" class="cs-log">
          <span class="cs-log__time">{{ fmtTs(log.ts) }}</span>
          <span class="cs-log__kind" :data-kind="log.kind">{{ log.kind }}</span>
          <span class="cs-log__msg">{{ log.msg }}</span>
        </div>
      </div>
    </div>
  </div>
  
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import 'highlight.js/styles/github-dark-dimmed.css';

// Register JavaScript language
hljs.registerLanguage('javascript', javascript);

const props = defineProps<{ item: any }>();
const store = inject<any>('store');
const running = ref(false);
const showLogs = ref(false);

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
.tl-hdr { display:flex; justify-content: space-between; align-items:center; }
.tl-actions { display:flex; gap:6px; }
.tl-status { padding: 2px 6px; border:1px solid #2E2E2E; border-radius:6px; font-size:10px; color:#B3B3B3; }
.tl-status[data-state="failed"] { color:#F87171; border-color: rgba(248,113,113,.5); }
.tl-status[data-state="completed"] { color:#34D399; border-color: rgba(52,211,153,.5); }
.tl-status[data-state="running"] { color:#4A9EFF; border-color: rgba(74,158,255,.5); }
.tl-status[data-state="canceled"] { color:#9CA3AF; border-color:#444; }
.tl-btn { background: rgba(74, 158, 255, 0.1); border:1px solid rgba(74,158,255,0.3); color:#4A9EFF; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; }
.tl-btn:disabled { opacity: 0.6; cursor: default; }
.tool-output {
  margin-top: 8px;
  max-height: none;
  overflow: auto;
}
.cs-logs { margin-top:10px; padding:10px; background:#151515; border:1px solid #2E2E2E; border-radius:8px; }
.cs-logs__hdr{ display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
.cs-logs__title{ color:#FFB86C; font-weight:600; font-size:12px; }
.cs-logs__meta{ color:#7A7A7A; font-size:10px; }
.cs-logs__empty{ color:#9CA3AF; font-size:12px; font-style: italic; }
.cs-logs__list{ display:flex; flex-direction:column; gap:4px; }
.cs-log{ display:grid; grid-template-columns: 60px 90px 1fr; gap:8px; align-items:baseline; font-size:12px; }
.cs-log__time{ color:#7A7A7A; font-size:10px; }
.cs-log__kind{ color:#9CA3AF; text-transform:uppercase; font-size:10px; letter-spacing:0.04em; }
.cs-log__kind[data-kind="fail"]{ color:#F87171; }
.cs-log__kind[data-kind="ok"]{ color:#34D399; }
.cs-log__msg{ color:#EAEAEA; }
</style>
