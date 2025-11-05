<template>
  <aside class="inspector" :class="open && 'inspector--open'">
    <div class="inspector__header">
      <h3 class="inspector__title">Inspector</h3>
      <button class="inspector__close" @click="$emit('close')">×</button>
    </div>
    <div class="inspector__section" v-if="item">
      <div class="inspector__json">
        <pre><code class="language-json hljs" v-html="highlightedJson"></code></pre>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import 'highlight.js/styles/github-dark-dimmed.css';

hljs.registerLanguage('json', json);

const props = defineProps<{ open: boolean; item: any }>();

function pretty(o: any) {
  try {
    return JSON.stringify(o, null, 2);
  } catch {
    return String(o);
  }
}

const highlightedJson = computed(() => {
  try {
    const jsonStr = pretty(props.item);
    const result = hljs.highlight(jsonStr, { language: 'json' });
    return result.value;
  } catch (e) {
    console.error('[Inspector] Failed to highlight JSON:', e);
    return pretty(props.item);
  }
});
</script>

<style scoped>
.inspector {
  position: fixed;
  right: -420px;
  top: 0;
  width: 420px;
  height: 100vh;
  background: #202020;
  border-left: 1px solid #2E2E2E;
  transition: right 0.2s ease-in-out;
  padding: 16px;
  overflow: auto;
  z-index: 100;
}
.inspector--open {
  right: 0;
}
.inspector__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.inspector__title {
  color: #EAEAEA;
  font-size: 16px;
  font-weight: 600;
}
.inspector__close {
  background: none;
  border: none;
  color: #EAEAEA;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
.inspector__close:hover {
  color: #E96D2F;
}
.inspector__json {
  background: #181818;
  border: 1px solid #2E2E2E;
  border-radius: 8px;
  padding: 12px;
  overflow-x: auto;
}
.inspector__json pre {
  margin: 0;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
}
.inspector__json code {
  font-family: inherit;
}
</style>

