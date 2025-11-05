<template>
  <div class="tl-item__body tool-nav">
    <div class="tool-header">
      <span class="tool-name">Nav</span>
    </div>
    <div class="nav-details" v-if="kv.length">
      <div v-for="k in kv" :key="k.key" class="nav-row">
        <span class="nav-key">{{ k.key }}</span>
        <span class="nav-val">{{ k.val }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ item: any }>();
const p = computed(()=> props.item.payload?.params_summary ?? props.item.payload?.input ?? {});
const kv = computed(()=> {
  const out: {key:string,val:string}[] = [];
  if (p.value.nav_id) out.push({ key:'nav_id', val:String(p.value.nav_id) });
  if (p.value.action === 'start') {
    if (p.value.target?.type === 'WORLD') out.push({ key:'target', val:`WORLD(${p.value.target.x}, ${p.value.target.y}, ${p.value.target.z})` });
    if (p.value.tol !== undefined) out.push({ key:'tol', val:String(p.value.tol) });
    if (p.value.timeout_ms) out.push({ key:'timeout', val:`${p.value.timeout_ms}ms` });
  } else if (p.value.action === 'status') {
    out.push({ key:'state', val: 'requested' });
  } else if (p.value.action === 'cancel') {
    out.push({ key:'state', val: 'canceled' });
  }
  return out;
});
</script>

<style scoped>
.tool-header {
  font-weight: 600;
  color: #EAEAEA;
  margin-bottom: 8px;
  font-size: 13px;
}
.nav-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nav-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.nav-key {
  color: #B3B3B3;
  font-size: 11px;
  min-width: 60px;
}
.nav-val {
  color: #EAEAEA;
  font-size: 12px;
  font-family: 'Monaco', 'Courier New', monospace;
}
</style>

