<template>
  <div class="tool-generic">
    <div class="generic-notice">
      <span class="notice-icon">&#9432;</span>
      <span class="notice-text">Raw output (no custom formatter)</span>
    </div>
    <div class="tool-output">
      <pre><code class="language-json hljs" v-html="highlightedJson"></code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';

hljs.registerLanguage('json', json);

const props = defineProps<{ item: any }>();
const payload = computed(() => props.item.payload || {});

const obj = computed(() => {
  let v = payload.value.params_summary;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch {}
  }
  if (v && typeof v === 'object') return v;
  return payload.value.input || payload.value.output || {};
});

function pretty(o: any) {
  try {
    return JSON.stringify(o, null, 2);
  } catch {
    return String(o);
  }
}

const highlightedJson = computed(() => {
  try {
    const jsonStr = pretty(obj.value);
    const result = hljs.highlight(jsonStr, { language: 'json' });
    return result.value;
  } catch (e) {
    return pretty(obj.value);
  }
});
</script>

<style scoped>
.tool-generic {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.generic-notice {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #95a5a6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.notice-icon {
  font-size: 14px;
  opacity: 0.7;
}

.tool-output {
  margin: 0;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  overflow-x: auto;
}

.tool-output pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.tool-output code {
  background: transparent;
}
</style>
