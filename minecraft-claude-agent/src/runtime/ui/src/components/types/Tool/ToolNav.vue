<template>
  <div class="tl-item__body">
    <div class="tl-kv" v-if="kv.length">
      <template v-for="k in kv" :key="k.key">
        <span class="tl-kv__key">{{ k.key }}</span> <span class="tl-kv__val">{{ k.val }}</span>
      </template>
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

