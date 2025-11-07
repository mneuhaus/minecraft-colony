<template>
  <div class="tl-item__body craftscript-trace">
    <div class="trace-row">
      <span class="trace-kind" :data-kind="trace.kind">{{ trace.kind }}</span>
      <span class="trace-msg">{{ summary }}</span>
    </div>
    <div v-if="showDetails" class="trace-details">
      <div v-for="(v,k) in trace" :key="k" class="detail">
        <span class="k">{{ k }}</span>
        <span class="v">{{ format(v) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ item:any }>();

const trace = computed(()=>{
  let out = props.item.payload?.output;
  try { if (typeof out === 'string') out = JSON.parse(out); } catch {}
  return out || {};
});

const showDetails = computed(()=> true);

const summary = computed(()=>{
  const t:any = trace.value || {};
  switch (t.kind) {
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
});

function format(v:any){
  if (v===null || v===undefined) return String(v);
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  if (typeof v==='object') return JSON.stringify(v);
  return String(v);
}
</script>

<style scoped>
.craftscript-trace { font-size: 12px; }
.trace-row { display:flex; gap:8px; align-items:center; }
.trace-kind { font-weight:600; color:#9CA3AF; text-transform:uppercase; font-size:10px; letter-spacing:0.04em; }
.trace-kind[data-kind="fail"]{ color:#F87171; }
.trace-kind[data-kind="ok"]{ color:#34D399; }
.trace-details { margin-top:6px; padding:6px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:4px; }
.detail { display:flex; gap:6px; }
.k { color:#9CA3AF; min-width:60px; }
.v { color:#E5E7EB; font-family:'Courier New', monospace; }
</style>

