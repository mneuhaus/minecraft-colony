<template>
  <div class="tl-item__body">
    <div class="tl-kv">
      <span class="tl-kv__key">radius</span> <span class="tl-kv__val">{{ radius }}</span>
    </div>
    <div class="vox-meta" v-if="hazards.length">Hazards: {{ hazards.join(', ') }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ item: any }>();
const raw = computed(()=> {
  let out = props.item.payload?.output;
  if (typeof out === 'string') { try { out = JSON.parse(out); } catch {} }
  return out || {};
});
const radius = computed(()=> raw.value?.window?.radius ?? (props.item.payload?.params_summary?.radius ?? props.item.payload?.input?.radius ?? '?'));
const hazards = computed(()=> Array.isArray(raw.value?.predicates?.HAZARDS) ? raw.value.predicates.HAZARDS : []);
</script>

