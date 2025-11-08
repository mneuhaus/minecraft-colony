<template>
  <MessageBlock
    title="Block Info"
    eyebrow="Spatial"
    :tone="blockData ? 'info' : 'neutral'"
    :collapsible="true"
    :default-collapsed="true"
    padding="md"
  >
    <template #meta>
      <span v-if="position" class="block-chip">({{ position.x }}, {{ position.y }}, {{ position.z }})</span>
    </template>
    <template #actions>
      <button class="inspector-toggle" @click="$emit('openInspector', item)" title="Open Inspector">
        🔍
      </button>
    </template>

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
  </MessageBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MessageBlock from '../../MessageBlock.vue';

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
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
  font-size: var(--font-xs);
  color: var(--color-text-muted);
}
.block-row {
  display: flex;
  gap: var(--spacing-sm);
  align-items: baseline;
  margin-bottom: var(--spacing-sm);
}
.block-key {
  color: var(--color-text-muted);
  font-size: var(--font-xs);
  text-transform: uppercase;
}
.block-val {
  color: var(--color-accent);
  font-size: var(--font-sm);
  font-family: 'Monaco','Courier New',monospace;
  font-weight: 600;
}
.block-info { margin-top: var(--spacing-sm); padding-top: var(--spacing-sm); border-top: 1px solid var(--color-border-subtle); }
.info-row { display: flex; gap: var(--spacing-sm); align-items: flex-start; margin-bottom: var(--spacing-xs); font-size: var(--font-sm); }
.info-label { color: var(--color-text-muted); min-width: 80px; text-transform: uppercase; font-size: var(--font-xs); }
.info-val { color: var(--color-text-primary); font-family: 'Monaco','Courier New',monospace; }
.block-id { color: var(--color-success); font-weight: 600; }
.props-grid { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.prop-item {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 2px 6px;
  background: rgba(255,255,255,0.02);
  border-radius: var(--radius-sm);
  font-size: var(--font-xs);
}
.prop-key { color: var(--color-warning); font-family: 'Monaco','Courier New',monospace; font-weight: 600; }
.prop-val { color: var(--color-text-primary); font-family: 'Monaco','Courier New',monospace; }

.inspector-toggle {
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-primary);
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
}
</style>
