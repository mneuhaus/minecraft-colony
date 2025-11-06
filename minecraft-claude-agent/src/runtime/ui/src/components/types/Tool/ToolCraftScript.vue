<template>
  <div class="tl-item__body">
    <div class="tl-hdr">
      <div class="tl-kv">
        <span class="tl-kv__key">CraftScript</span>
        <span class="tl-kv__val">{{ lineCount }} line(s)</span>
      </div>
      <div class="tl-actions">
        <button class="tl-btn" :disabled="running" @click="runAgain">{{ running ? 'Running…' : 'Run Again' }}</button>
      </div>
    </div>
    <pre class="tool-output"><code class="language-javascript hljs" v-html="highlightedCode"></code></pre>
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

const payload = computed(() => props.item.payload || {});

// Extract script from various possible locations
const script = computed(() => {
  const data = payload.value;
  if (typeof data?.input?.script === 'string') return data.input.script;
  if (typeof data?.params_summary?.input?.script === 'string') return data.params_summary.input.script;
  if (typeof data?.output?.script === 'string') return data.output.script;
  return '';
});

const lines = computed(() => script.value.split(/\r?\n/));
const lineCount = computed(() => lines.value.length);

// Generate highlighted HTML
const highlightedCode = computed(() => {
  try {
    const full = script.value;
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
    // Prefer the event's bot_id if present; fallback to active bot
    const botName = props.item?.bot_id || store?.activeBot;
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
</script>

<style scoped>
.tl-hdr { display:flex; justify-content: space-between; align-items:center; }
.tl-actions { display:flex; gap:6px; }
.tl-btn { background: rgba(74, 158, 255, 0.1); border:1px solid rgba(74,158,255,0.3); color:#4A9EFF; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; }
.tl-btn:disabled { opacity: 0.6; cursor: default; }
.tool-output {
  margin-top: 8px;
  max-height: none;
  overflow: auto;
}
</style>
