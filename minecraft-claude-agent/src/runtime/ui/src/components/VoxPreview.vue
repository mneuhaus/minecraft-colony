<template>
  <div class="vox-preview" v-if="cells.length">
    <div class="vox-header">
      <span class="vox-title">Vox Window</span>
      <span class="vox-meta">origin {{ originLabel }}</span>
    </div>
    <div class="vox-layer-control" v-if="layerCount > 1">
      <button class="layer-btn" @click="shiftLayer(-1)" :disabled="!canLayerDown">▲</button>
      <span class="layer-meta">Layer {{ activeLayerIndex + 1 }} / {{ layerCount }} · y = {{ layerY }}</span>
      <button class="layer-btn" @click="shiftLayer(1)" :disabled="!canLayerUp">▼</button>
    </div>
    <div class="vox-grid" :style="gridStyle">
      <div
        v-for="cell in cells"
        :key="cell.key"
        class="vox-cell"
        :class="[
          `vox-cell--${cell.material}`,
          { 'vox-cell--target': cell.isTarget }
        ]"
        :title="cell.tooltip"
      >
        <span>{{ cell.label }}</span>
      </div>
    </div>
    <div class="vox-footer">
      <span class="legend">
        <span class="legend-swatch target"></span>
        Target block
      </span>
      <span class="legend">
        <span class="legend-swatch solid"></span>
        Solid block
      </span>
      <span class="legend">
        <span class="legend-swatch air"></span>
        Air
      </span>
    </div>
  </div>
  <div v-else class="vox-empty">No vox window data</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

type Voxel = { x: number; y: number; z: number; id: string };

type Coord = { x: number; y: number; z: number };

const props = defineProps<{ vox?: any; target?: Coord | [number, number, number] | null }>();

const windowInfo = computed(() => props.vox?.window ?? {});
const shape = computed<[number, number, number]>(() => {
  const s = windowInfo.value?.shape;
  if (Array.isArray(s) && s.length === 3) return s as [number, number, number];
  const r = windowInfo.value?.radius ?? 0;
  const size = r ? r * 2 + 1 : 1;
  return [size, size, size];
});

const origin = computed<Coord>(() => {
  const o = windowInfo.value?.origin;
  if (o && typeof o.x === 'number' && typeof o.y === 'number' && typeof o.z === 'number') {
    return { x: o.x, y: o.y, z: o.z };
  }
  const voxels: Voxel[] = Array.isArray(props.vox?.voxels) ? props.vox.voxels : [];
  if (voxels.length > 0) return { ...voxels[0] };
  return { x: 0, y: 0, z: 0 };
});

function normalizeTarget(): Coord | null {
  const t = props.target;
  if (!t) return null;
  if (Array.isArray(t) && t.length === 3) {
    return { x: Number(t[0]), y: Number(t[1]), z: Number(t[2]) };
  }
  if (typeof t === 'object' && 'x' in t && 'y' in t && 'z' in t) {
    const obj = t as Coord;
    return { x: Number(obj.x), y: Number(obj.y), z: Number(obj.z) };
  }
  return null;
}

const targetCoord = computed<Coord>(() => {
  return normalizeTarget() ?? origin.value;
});

const voxelsAll = computed<Voxel[]>(() => Array.isArray(props.vox?.voxels) ? props.vox.voxels : []);

const yLayers = computed<number[]>(() => {
  const voxels = voxelsAll.value;
  if (voxels.length) {
    return Array.from(new Set(voxels.map((v) => Math.round(v.y)))).sort((a, b) => a - b);
  }
  const win = windowInfo.value;
  if (win?.shape?.length === 3) {
    const height = Math.max(1, Number(win.shape[1]));
    const start = Math.round((win.origin?.y ?? origin.value.y) - Math.floor(height / 2));
    return Array.from({ length: height }, (_, i) => start + i);
  }
  return [origin.value.y];
});

const layerCount = computed(() => yLayers.value.length);
const activeLayerIndex = ref(0);

const defaultLayerIndex = computed(() => {
  const targetY = targetCoord.value?.y;
  const idx = yLayers.value.indexOf(targetY);
  if (idx >= 0) return idx;
  const originIdx = yLayers.value.indexOf(origin.value.y);
  if (originIdx >= 0) return originIdx;
  return Math.max(0, Math.floor(yLayers.value.length / 2));
});

watch(
  () => [props.vox, targetCoord.value?.y],
  () => {
    const layers = layerCount.value;
    if (!layers) {
      activeLayerIndex.value = 0;
      return;
    }
    const next = Math.min(Math.max(0, defaultLayerIndex.value), layers - 1);
    activeLayerIndex.value = next;
  },
  { immediate: true }
);

watch(layerCount, () => {
  if (!layerCount.value) {
    activeLayerIndex.value = 0;
    return;
  }
  if (activeLayerIndex.value > layerCount.value - 1) {
    activeLayerIndex.value = layerCount.value - 1;
  }
});

const layerY = computed(() => {
  if (!layerCount.value) return undefined;
  return yLayers.value[activeLayerIndex.value] ?? yLayers.value[0];
});

const voxelMap = computed<Record<string, Voxel>>(() => {
  const map: Record<string, Voxel> = {};
  const voxels = voxelsAll.value;
  for (const v of voxels) {
    if (typeof v.x !== 'number' || typeof v.y !== 'number' || typeof v.z !== 'number') continue;
    map[`${v.x}:${v.y}:${v.z}`] = v;
  }
  return map;
});

const xs = computed(() => {
  const width = Math.max(1, Math.round(shape.value[0]));
  const start = origin.value.x - Math.floor(width / 2);
  return Array.from({ length: width }, (_, i) => start + i);
});

const zs = computed(() => {
  const depth = Math.max(1, Math.round(shape.value[2]));
  const start = origin.value.z - Math.floor(depth / 2);
  return Array.from({ length: depth }, (_, i) => start + i);
});

const cells = computed(() => {
  const layer = layerY.value;
  if (layer === undefined) return [];
  const result: Array<{ key: string; isTarget: boolean; label: string; tooltip: string; material: string }> = [];
  for (let zi = zs.value.length - 1; zi >= 0; zi -= 1) {
    const z = zs.value[zi];
    for (const x of xs.value) {
      const key = `${x}:${layer}:${z}`;
      const voxel = voxelMap.value[key];
      const id = voxel?.id ?? 'air';
      const label = shortId(id);
      const material = classify(id);
      const isTarget = x === targetCoord.value.x && z === targetCoord.value.z && layer === targetCoord.value.y;
      const tooltip = `${id} @ ${x}, ${layer}, ${z}`;
      result.push({ key, isTarget, label, tooltip, material });
    }
  }
  return result;
});

const layerCountValue = computed(() => layerCount.value);
const canLayerDown = computed(() => layerCount.value > 0 && activeLayerIndex.value > 0);
const canLayerUp = computed(() => layerCount.value > 0 && activeLayerIndex.value < layerCount.value - 1);

function shiftLayer(delta: number) {
  if (!layerCount.value) return;
  activeLayerIndex.value = Math.min(
    layerCount.value - 1,
    Math.max(0, activeLayerIndex.value + delta)
  );
}

function shortId(id?: string): string {
  if (!id) return '?';
  const clean = id.replace('minecraft:', '');
  if (clean === 'air') return '•';
  if (clean.length <= 5) return clean;
  return clean.split('_').map(part => part[0]).join('').slice(0, 3).toUpperCase();
}

function classify(id?: string): string {
  if (!id) return 'unknown';
  const clean = id.replace('minecraft:', '');
  if (clean === 'air') return 'air';
  if (/water|lava/.test(clean)) return 'fluid';
  return 'solid';
}

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${xs.value.length}, minmax(22px, 1fr))`,
}));

const originLabel = computed(() => `${origin.value.x},${origin.value.y},${origin.value.z}`);
</script>

<style scoped>
.vox-preview {
  margin-top: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 8px;
  background: rgba(15, 17, 21, 0.6);
}
.vox-header {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  margin-bottom: 6px;
}
.vox-title {
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.vox-meta {
  opacity: 0.7;
  font-family: 'Courier New', monospace;
}
.vox-layer-control {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.layer-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  width: 24px;
  height: 24px;
  color: #fff;
}
.layer-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.layer-meta {
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.vox-grid {
  display: grid;
  gap: 4px;
}
.vox-cell {
  position: relative;
  min-height: 28px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  text-transform: uppercase;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.04);
}
.vox-cell--air { opacity: 0.35; }
.vox-cell--solid { background: rgba(90, 161, 255, 0.08); }
.vox-cell--fluid { background: rgba(96, 165, 250, 0.18); }
.vox-cell--target {
  border: 2px solid var(--color-danger);
  box-shadow: 0 0 6px rgba(255, 99, 99, 0.6);
}
.vox-footer {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 12px;
  opacity: 0.85;
  flex-wrap: wrap;
}
.legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.legend-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.legend-swatch.target { background: rgba(239, 68, 68, 0.6); }
.legend-swatch.solid { background: rgba(59, 130, 246, 0.4); }
.legend-swatch.air { background: rgba(255, 255, 255, 0.1); }
.vox-empty {
  opacity: 0.6;
  font-size: 13px;
  padding: 8px;
  text-align: center;
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}
</style>
