<template>
  <div class="tl-item__body tool-vox">
    <div class="tool-header">
      <span class="tool-name">Get Vox</span>
    </div>
    <div class="vox-row">
      <span class="vox-key">radius</span>
      <span class="vox-val">{{ radius }}</span>
    </div>
    <div class="vox-hazards" v-if="hazards.length">
      <span class="hazards-label">Hazards:</span>
      <span class="hazards-list">{{ hazards.join(', ') }}</span>
    </div>
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

<style scoped>
.tool-header {
  font-weight: 600;
  color: #EAEAEA;
  margin-bottom: 8px;
  font-size: 13px;
}
.vox-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 6px;
}
.vox-key {
  color: #B3B3B3;
  font-size: 11px;
}
.vox-val {
  color: #EAEAEA;
  font-size: 12px;
  font-family: 'Monaco', 'Courier New', monospace;
}
.vox-hazards {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #2E2E2E;
}
.hazards-label {
  color: #E96D2F;
  font-size: 11px;
  font-weight: 600;
}
.hazards-list {
  color: #EAEAEA;
  font-size: 11px;
}
</style>

