<template>
  <div>
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
defineEmits<{ openInspector: [item: any] }>();

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
.block-chip {
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 13px;
  opacity: 0.65;
}
.block-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 8px;
}
.block-key {
  opacity: 0.65;
  font-size: 13px;
  text-transform: uppercase;
}
.block-val {
  color: var(--color-accent);
  font-size: 14px;
  font-family: 'Monaco','Courier New',monospace;
  font-weight: 600;
}
.block-info { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.06); }
.info-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 4px; font-size: 14px; }
.info-label { opacity: 0.65; min-width: 80px; text-transform: uppercase; font-size: 13px; }
.info-val { ; font-family: 'Monaco','Courier New',monospace; }
.block-id { color: var(--color-success); font-weight: 600; }
.props-grid { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.prop-item {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 2px 6px;
  background: rgba(255,255,255,0.02);
  border-radius: 6px;
  font-size: 13px;
}
.prop-key { color: var(--color-warning); font-family: 'Monaco','Courier New',monospace; font-weight: 600; }
.prop-val { ; font-family: 'Monaco','Courier New',monospace; }

.inspector-toggle {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  ;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 14px;
}
</style>
