<template>
  <div class="tl-item__body">
    <pre class="tool-output"><code>{{ pretty(obj) }}</code></pre>
  </div>
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

