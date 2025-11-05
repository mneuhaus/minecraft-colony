<template>
  <div class="tl-item__body">
    <div class="tl-kv">
      <span class="tl-kv__key">CraftScript</span>
      <span class="tl-kv__val">{{ lineCount }} line(s)</span>
    </div>
    <pre class="tool-output"><code class="language-javascript hljs" v-html="highlightedCode"></code></pre>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import 'highlight.js/styles/github-dark-dimmed.css';

// Register JavaScript language
hljs.registerLanguage('javascript', javascript);

const props = defineProps<{ item: any }>();

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

const scriptPreview = computed(() => {
  const previewLines = lines.value.slice(0, 12);
  const suffix = lines.value.length > 12 ? `\n// … ${lines.value.length - 12} more line(s)` : '';
  return previewLines.join('\n') + suffix;
});

// Generate highlighted HTML
const highlightedCode = computed(() => {
  try {
    console.log('[ToolCraftScript] Highlighting code, preview length:', scriptPreview.value.length);
    const result = hljs.highlight(scriptPreview.value, { language: 'javascript' });
    console.log('[ToolCraftScript] Highlight result:', result.value.substring(0, 100));
    return result.value;
  } catch (e) {
    console.error('[ToolCraftScript] Failed to highlight code:', e);
    return scriptPreview.value;
  }
});
</script>

<style scoped>
.tool-output {
  margin-top: 8px;
}
</style>
