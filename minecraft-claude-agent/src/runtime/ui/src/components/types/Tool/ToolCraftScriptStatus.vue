<template>
  <div class="tl-item__body craftscript-status">
    <div class="hdr">
      <span class="title">CraftScript Status</span>
      <span class="badge" :data-state="status.state">{{ status.state }}</span>
    </div>
    <div class="grid">
      <div class="k">job</div><div class="v mono">{{ status.id }}</div>
      <div class="k">duration</div><div class="v mono">{{ status.duration_ms }} ms</div>
    </div>
    <pre class="script" v-if="status.script"><code>{{ status.script }}</code></pre>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ item: any }>();

const raw = computed(()=>{
  let out = props.item?.payload?.output;
  try { if (typeof out === 'string') out = JSON.parse(out); } catch {}
  try { if (typeof out === 'string') out = JSON.parse(out); } catch {}
  return out || {};
});

const status = computed(()=> {
  const o:any = raw.value || {};
  const id = o.id || o.job_id || props.item?.payload?.params_summary?.job_id || '';
  const state = o.state || 'unknown';
  const duration_ms = o.duration_ms ?? 0;
  const script = o.script || '';
  return { id, state, duration_ms, script };
});
</script>

<style scoped>
.craftscript-status { font-size: 12px; }
.hdr { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
.title { font-weight:600; color:#EAEAEA; }
.badge { padding:2px 6px; border:1px solid #2E2E2E; border-radius:6px; font-size:10px; text-transform:uppercase; letter-spacing:.03em; }
.badge[data-state="failed"]{ color:#F87171; border-color:rgba(248,113,113,.5); }
.badge[data-state="completed"], .badge[data-state="ok"]{ color:#34D399; border-color:rgba(52,211,153,.5); }
.grid { display:grid; grid-template-columns: 80px 1fr; gap:4px 8px; margin-bottom:6px; }
.k { color:#9CA3AF; }
.v { color:#EAEAEA; }
.mono { font-family:'Monaco','Menlo','Courier New',monospace; }
.script { margin-top:6px; background:#111; border:1px solid #2E2E2E; border-radius:6px; padding:8px; color:#C9D1D9; max-height:200px; overflow:auto; }
</style>

