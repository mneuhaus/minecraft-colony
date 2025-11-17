<template>
  <div class="movement-panel" v-if="entries.length">
    <div class="movement-header">
      <div class="selector">
        <label>Snapshot</label>
        <n-select
          v-model:value="selected"
          :options="options"
          size="small"
          class="snapshot-select"
        />
      </div>
      <div class="meta">
        <n-tag size="small" type="info">{{ activeEntry.label || activeEntry.source || 'trace' }}</n-tag>
        <span class="ts">{{ formatTs(activeEntry.ts) }}</span>
      </div>
    </div>

    <div class="movement-viewers">
      <Vox3DViewer :vox="activeEntry.vox" :target="activeEntry.target" />
      <VoxPreview :vox="activeEntry.vox" :target="activeEntry.target" />
    </div>

    <div class="movement-details">
      <div v-if="activeEntry.source" class="detail">
        <span class="label">Source</span>
        <span>{{ activeEntry.source }}</span>
      </div>
      <div v-if="activeEntry.label" class="detail">
        <span class="label">Label</span>
        <span>{{ activeEntry.label }}</span>
      </div>
      <div v-if="activeEntry.target" class="detail">
        <span class="label">Target</span>
        <span>{{ formatTarget(activeEntry.target) }}</span>
      </div>
    </div>
  </div>
  <div v-else class="movement-empty">
    No movement snapshot data available.
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Vox3DViewer from './Vox3DViewer.vue';
import VoxPreview from './VoxPreview.vue';

type Entry = {
  ts: number;
  vox: any;
  target?: any;
  label?: string;
  source?: string;
};

const props = defineProps<{
  entries: Entry[];
}>();

const sorted = computed(() =>
  [...props.entries].sort((a, b) => (a.ts || 0) - (b.ts || 0))
);
const selected = ref(sorted.value.length ? sorted.value.length - 1 : 0);

const options = computed(() =>
  sorted.value.map((entry, idx) => ({
    label: `${idx + 1}. ${entry.label || entry.source || 'snapshot'} (${formatTs(entry.ts)})`,
    value: idx,
  }))
);

const activeEntry = computed(() => {
  const idx = Math.min(Math.max(selected.value, 0), sorted.value.length - 1);
  return sorted.value[idx] || sorted.value[0];
});

function formatTs(ts?: number) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString();
}

function formatTarget(target: any) {
  if (!target) return '';
  if (Array.isArray(target) && target.length === 3) return target.join(', ');
  if (typeof target === 'object') {
    const coords = [target.x, target.y, target.z].filter((v) => typeof v === 'number');
    return coords.join(', ');
  }
  return String(target);
}
</script>

<style scoped>
.movement-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.movement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.selector {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.selector label {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
}

.snapshot-select {
  min-width: 220px;
}

.meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.meta .ts {
  font-size: 13px;
  opacity: 0.7;
}

.movement-viewers {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (min-width: 900px) {
  .movement-viewers {
    flex-direction: row;
  }
}

.movement-details {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}

.detail .label {
  text-transform: uppercase;
  font-size: 11px;
  opacity: 0.6;
  letter-spacing: 0.05em;
}

.movement-empty {
  padding: 16px;
  opacity: 0.7;
  font-style: italic;
}
</style>
