<template>
  <div class="tl-item__body tool-vox">
    <div class="tool-header">
      <span class="tool-name">Get Vox</span>
    </div>
    <div class="vox-row">
      <span class="vox-key">radius</span>
      <span class="vox-val">{{ radius }}</span>
    </div>
    <div class="vox-blocks" v-if="blockCount > 0">
      <div class="blocks-header">
        <span class="blocks-label">Blocks:</span>
        <span class="blocks-count">{{ blockCount }}</span>
      </div>
      <div class="blocks-grid">
        <div v-for="[sel, block] in blocks.slice(0, maxBlocks)" :key="sel" class="block-item">
          <span class="block-sel">{{ sel }}</span>
          <span class="block-arrow">→</span>
          <span class="block-id">{{ block.replace('minecraft:', '') }}</span>
        </div>
        <div v-if="blockCount > maxBlocks" class="block-item block-more">
          +{{ blockCount - maxBlocks }} more...
        </div>
      </div>
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
const blocks = computed(()=> {
  const vox = raw.value?.vox;
  if (!vox || typeof vox !== 'object') return [];
  return Object.entries(vox);
});
const blockCount = computed(()=> blocks.value.length);
const maxBlocks = 12; // Show first 12 blocks
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
.vox-blocks {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #2E2E2E;
}
.blocks-header {
  display: flex;
  gap: 6px;
  align-items: baseline;
  margin-bottom: 6px;
}
.blocks-label {
  color: #4A9EFF;
  font-size: 11px;
  font-weight: 600;
}
.blocks-count {
  color: #7A7A7A;
  font-size: 10px;
}
.blocks-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  font-size: 10px;
}
.block-item {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 2px 4px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 3px;
}
.block-sel {
  color: #4A9EFF;
  font-family: 'Monaco', 'Courier New', monospace;
  font-weight: 600;
  min-width: 35px;
}
.block-arrow {
  color: #4A4A4A;
  font-size: 9px;
}
.block-id {
  color: #EAEAEA;
  font-family: 'Monaco', 'Courier New', monospace;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.block-more {
  grid-column: 1 / -1;
  justify-content: center;
  color: #7A7A7A;
  font-style: italic;
}
.vox-hazards {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
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

