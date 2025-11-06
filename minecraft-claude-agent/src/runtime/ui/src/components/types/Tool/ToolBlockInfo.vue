<template>
  <div class="tl-item__body tool-block-info">
    <div class="tool-header">
      <span class="tool-name">Block Info</span>
    </div>
    <div class="block-row" v-if="position">
      <span class="block-key">position</span>
      <span class="block-val">({{ position.x }}, {{ position.y }}, {{ position.z }})</span>
    </div>
    <div class="block-info" v-if="blockData">
      <div class="info-row">
        <span class="info-label">Block:</span>
        <span class="info-val block-id">{{ blockData.id }}</span>
      </div>
      <div class="info-row" v-if="blockData.state !== null && blockData.state !== undefined">
        <span class="info-label">State:</span>
        <span class="info-val">{{ blockData.state === null ? 'null' : blockData.state }}</span>
      </div>
      <div class="info-row" v-if="blockData.props && Object.keys(blockData.props).length > 0">
        <span class="info-label">Properties:</span>
        <div class="props-grid">
          <div v-for="[key, val] in Object.entries(blockData.props)" :key="key" class="prop-item">
            <span class="prop-key">{{ key }}</span>
            <span class="prop-arrow">:</span>
            <span class="prop-val">{{ JSON.stringify(val) }}</span>
          </div>
        </div>
      </div>
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

const position = computed(()=> {
  const p = props.item.payload?.params_summary ?? props.item.payload?.input ?? null;
  if (p && typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number') {
    return { x: p.x, y: p.y, z: p.z };
  }
  return null;
});
const blockData = computed(()=> raw.value);
</script>

<style scoped>
.tool-header {
  font-weight: 600;
  color: #EAEAEA;
  margin-bottom: 8px;
  font-size: 13px;
}
.block-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 6px;
}
.block-key {
  color: #B3B3B3;
  font-size: 11px;
}
.block-val {
  color: #4A9EFF;
  font-size: 12px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-weight: 600;
}
.block-info {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #2E2E2E;
}
.info-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 4px;
}
.info-label {
  color: #B3B3B3;
  font-size: 11px;
  min-width: 70px;
}
.info-val {
  color: #EAEAEA;
  font-size: 11px;
  font-family: 'Monaco', 'Courier New', monospace;
}
.block-id {
  color: #7CFC00;
  font-weight: 600;
}
.props-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.prop-item {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 2px 4px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 3px;
  font-size: 10px;
}
.prop-key {
  color: #FFB86C;
  font-family: 'Monaco', 'Courier New', monospace;
  font-weight: 600;
}
.prop-arrow {
  color: #4A4A4A;
}
.prop-val {
  color: #EAEAEA;
  font-family: 'Monaco', 'Courier New', monospace;
}
</style>
