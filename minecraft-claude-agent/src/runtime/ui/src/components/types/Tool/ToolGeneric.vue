<template>
    <pre class="tool-output"><code>{{ pretty(obj) }}</code></pre>
</template>

<script setup lang="ts">
import { computed } from 'vue';
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
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 8px;
  font-family: 'Monaco','Courier New',monospace;
  font-size: 14px;
  overflow-x: auto;
}
</style>
