<template>
  <MessageBlock
    eyebrow="Tool Output"
    title="Generic Tool"
    padding="md"
  >
    <pre class="tool-output"><code>{{ pretty(obj) }}</code></pre>
  </MessageBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MessageBlock from '../../MessageBlock.vue';
const props = defineProps<{ item: any }>();
const payload = computed(()=> props.item.payload || {});
const obj = computed(()=> {
  let v = payload.value.params_summary;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch {} }
  if (v && typeof v === 'object') return v;
  return payload.value.input || payload.value.output || {};
});
function pretty(o: any){ try { return JSON.stringify(o, null, 2); } catch { return String(o); } }
</script>

<style scoped>
.tool-output {
  margin: 0;
  background: var(--color-bg-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  font-family: 'Monaco','Courier New',monospace;
  font-size: var(--font-sm);
  overflow-x: auto;
}
</style>
