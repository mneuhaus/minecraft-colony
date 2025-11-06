<template>
  <div class="tl-item__body tool-look-at-map">
    <div class="tool-header">
      <span class="tool-name">Look At Map</span>
      <span class="tool-meta">{{ gridInfo }}</span>
    </div>
    <div class="tool-hint">2D-Karte (Draufsicht) zur schnellen Orientierung. Jede Zelle entspricht einem Zoom-Feld; ▲ / • / ▼ zeigen die relative Höhe gegenüber den Füßen.</div>

    <div class="map-params">
      <div class="param-row" v-if="radius">
        <span class="param-label">radius</span>
        <span class="param-val">{{ radius }}</span>
      </div>
      <div class="param-row" v-if="zoom && zoom > 1">
        <span class="param-label">zoom</span>
        <span class="param-val">{{ zoom }}x ({{ zoom }}x{{ zoom }} blocks/cell)</span>
      </div>
      <div class="param-row" v-if="grep.length">
        <span class="param-label">filter</span>
        <span class="param-val">{{ grep.join(', ') }}</span>
      </div>
      <div class="param-row" v-if="botHeight !== null">
        <span class="param-label">bot height</span>
        <span class="param-val">y={{ botHeight }}</span>
      </div>
    </div>

    <div class="map-grid-container" v-if="gridCells.length > 0">
      <div class="map-orientation">
        <div class="orientation-row">
          <div class="orientation-label">↑ Forward</div>
        </div>
        <div class="orientation-hint">← Left | Bot Center | Right → • Matches outlined in blue</div>
      </div>
      <div class="map-grid" :style="{ gridTemplateColumns: `repeat(${gridWidth}, 1fr)` }">
        <div
          v-for="cell in gridCells"
          :key="cell.key"
          class="map-cell"
          :class="{ 'map-cell--bot': cell.isBotPosition, 'map-cell--match': cell.isMatch }"
          :style="cell.colors && cell.colors.length > 1 ? {} : { backgroundColor: cell.color }"
          :title="cell.tooltip"
        >
          <!-- Multi-color mosaic for cells with multiple block types -->
          <div v-if="cell.colors && cell.colors.length > 1" class="cell-mosaic">
            <div
              v-for="(color, idx) in cell.colors"
              :key="idx"
              class="mosaic-tile"
              :style="{ backgroundColor: color }"
            ></div>
          </div>
          <span class="cell-height">{{ cell.heightLabel }}</span>
        </div>
      </div>
      <div class="map-legend">
        <span class="legend-item"><span class="legend-symbol">▲</span> Above (+2)</span>
        <span class="legend-item"><span class="legend-symbol">•</span> Level (±1)</span>
        <span class="legend-item"><span class="legend-symbol">▼</span> Below (-2)</span>
      </div>
    </div>

    <div class="map-summary" v-if="cellCount > 0">
      <div class="summary-label">{{ cellCount }} cells | {{ uniqueBlocks.length }} block types</div>
      <div class="blocks-list">
        <span v-for="block in uniqueBlocks" :key="block" class="block-tag">{{ block }}</span>
      </div>
    </div>

    <div class="map-stats" v-if="heightStats">
      <div class="stat-row">
        <span class="stat-label">Height range:</span>
        <span class="stat-val">{{ heightStats.min }} to {{ heightStats.max }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{ item: any }>();

const raw = computed(() => {
  let out = props.item.payload?.output;
  if (typeof out === 'string') {
    try {
      out = JSON.parse(out);
    } catch {}
  }
  return out || {};
});

const radius = computed(() => props.item.payload?.params_summary?.radius ?? props.item.payload?.input?.radius ?? null);
const zoom = computed(() => raw.value?.zoom ?? props.item.payload?.params_summary?.zoom ?? props.item.payload?.input?.zoom ?? 1);
const botHeight = computed(() => raw.value?.bot_height ?? null);
const gridSize = computed(() => raw.value?.grid?.size ?? null);

const gridInfo = computed(() => {
  if (!gridSize.value) return '';
  return `${gridSize.value[0]}x${gridSize.value[1]}`;
});

const cellsData = computed(() => Array.isArray(raw.value?.cells) ? raw.value.cells : []);
const cellCount = computed(() => cellsData.value.length);
const grep = computed(() => {
  const p = props.item.payload?.params_summary ?? props.item.payload?.input ?? {};
  const g = p.grep || p.filter || raw.value?.grep;
  if (Array.isArray(g)) return g;
  return [];
});

// View options
const flipVertical = ref(true);

const uniqueBlocks = computed(() => {
  const blocks = new Set<string>();
  for (const cell of cellsData.value as any[]) {
    const arr = Array.isArray(cell.blocks) ? cell.blocks : [];
    arr.forEach((b: string) => blocks.add(b));
  }
  return Array.from(blocks).sort();
});

const heightStats = computed(() => {
  let min = Infinity;
  let max = -Infinity;
  for (const cell of cellsData.value as any[]) {
    if (cell.height_min !== undefined) min = Math.min(min, cell.height_min);
    if (cell.height_max !== undefined) max = Math.max(max, cell.height_max);
  }
  if (min === Infinity || max === -Infinity) return null;
  return { min, max };
});

// Compute grid extents from world x/z cells
function worldToGrid(cells: any[]): { minX: number; maxX: number; minZ: number; maxZ: number; xs: number[]; zs: number[]; stepX: number; stepZ: number } {
  const xSet = new Set<number>();
  const zSet = new Set<number>();
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of cells) {
    xSet.add(c.x);
    zSet.add(c.z);
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.z < minZ) minZ = c.z;
    if (c.z > maxZ) maxZ = c.z;
  }
  const xs = Array.from(xSet).sort((a,b)=>a-b);
  const zs = Array.from(zSet).sort((a,b)=>a-b);
  const dxs = xs.slice(1).map((v,i)=>v - xs[i]).filter(d=>d>0);
  const dzs = zs.slice(1).map((v,i)=>v - zs[i]).filter(d=>d>0);
  const stepX = dxs.length ? Math.min(...dxs) : 1;
  const stepZ = dzs.length ? Math.min(...dzs) : 1;
  return { minX, maxX, minZ, maxZ, xs, zs, stepX, stepZ };
}

// Map block names to representative colors
function blockToColor(blocks: string[]): string {
  if (!blocks || blocks.length === 0) return '#2a2a2a';

  // Find the most representative block (prioritize solid blocks over plants)
  const blockPriority: Record<string, number> = {
    'water': 10,
    'lava': 10,
    'grass_block': 9,
    'dirt': 8,
    'stone': 8,
    'sand': 8,
    'sandstone': 8,
    'oak_log': 7,
    'oak_leaves': 6,
    'jungle_leaves': 6,
  };

  const sortedBlocks = [...blocks].sort((a, b) =>
    (blockPriority[b] || 0) - (blockPriority[a] || 0)
  );
  const dominantBlock = sortedBlocks[0];

  // Minecraft-like block colors
  const blockColors: Record<string, string> = {
    'grass_block': '#7cbd6b',
    'dirt': '#96651b',
    'stone': '#7f7f7f',
    'cobblestone': '#7a7a7a',
    'sand': '#dbd3a0',
    'sandstone': '#d9c8a4',
    'gravel': '#857b7b',
    'oak_log': '#6e5231',
    'oak_planks': '#9c7f4e',
    'oak_leaves': '#62a835',
    'jungle_leaves': '#69a839',
    'jungle_planks': '#a67d4d',
    'water': '#3f76e4',
    'lava': '#ea5b09',
    'bedrock': '#545454',
    'coal_ore': '#676767',
    'iron_ore': '#a3a3a3',
    'gold_ore': '#e4d84e',
    'diamond_ore': '#6bcfcf',
    'wheat': '#b5a845',
    'tall_grass': '#7cbd6b',
    'short_grass': '#7cbd6b',
    'fern': '#6db05f',
    'dead_bush': '#8e6e3a',
    'cactus': '#4d7a1c',
    'sugar_cane': '#8ebc5a',
    'pumpkin': '#c07615',
    'melon': '#a6c944',
    'vine': '#437a1d',
    'snow': '#fffafa',
    'ice': '#9cd3f7',
    'clay': '#a4a8b8',
  };

  // Try to match the dominant block
  for (const [blockName, color] of Object.entries(blockColors)) {
    if (dominantBlock.includes(blockName)) {
      return color;
    }
  }

  // Default colors for common patterns
  if (dominantBlock.includes('grass')) return '#7cbd6b';
  if (dominantBlock.includes('dirt')) return '#96651b';
  if (dominantBlock.includes('stone')) return '#7f7f7f';
  if (dominantBlock.includes('sand')) return '#dbd3a0';
  if (dominantBlock.includes('wood') || dominantBlock.includes('log')) return '#6e5231';
  if (dominantBlock.includes('leaves')) return '#62a835';
  if (dominantBlock.includes('water')) return '#3f76e4';
  if (dominantBlock.includes('lava')) return '#ea5b09';

  return '#5a5a5a'; // default gray for unknown blocks
}

const gridWidth = computed(() => {
  if (!cellsData.value.length) return 0;
  const { zs } = worldToGrid(cellsData.value);
  return zs.length;
});

const gridCells = computed(() => {
  const cells = [];
  const stats = heightStats.value;

  // Use provided cells array (world x/z) and index for quick lookup
  const cellMap = new Map<string, any>();
  for (const cell of cellsData.value as any[]) {
    cellMap.set(`${cell.x},${cell.z}`, cell);
  }

  if (cellMap.size === 0) return [];

  // Parse all keys to find actual F and R ranges and detect the step size
  if (cellMap.size === 0) return [];

  // Derive extents and step using world coordinates
  const { minX, maxX, minZ, maxZ, xs, zs, stepX, stepZ } = worldToGrid(cellsData.value as any[]);

  // Generate all cells in proper order using the detected step
  // Default: Top row = far forward (maxF), bottom row = behind (minF)
  // Left = left (minR), right = right (maxR)
  // If flipVertical is enabled, invert the F sweep so users can switch perspective.
  const xList = flipVertical.value ? xs : [...xs].reverse();
  const originX = raw.value?.grid?.origin?.x ?? null;
  const originZ = raw.value?.grid?.origin?.z ?? null;
  for (const f of xList) {
    for (const r of zs) {
      const key = `${f},${r}`;
      const cell = cellMap.get(key);

      if (cell && cell.blocks && cell.blocks.length > 0) {
        const avgHeight = (cell.height_min + cell.height_max) / 2;
        const blocks = cell.blocks || [];
        const uniqueBlocks = Array.from(new Set(blocks));

        // Generate color for each unique block type
        const colors = uniqueBlocks.map(b => blockToColor([b]));
        const dominantColor = blockToColor(blocks);
        const blocksList = blocks.join(', ') || 'unknown';

        // Show relative height from bot's feet
        const heightDiff = Math.round(avgHeight);
        let heightSymbol = '•';
        if (heightDiff > 1) heightSymbol = '▲';
        else if (heightDiff < -1) heightSymbol = '▼';

        cells.push({
          key,
          color: dominantColor,
          colors: colors.length > 1 ? colors : undefined,
          heightLabel: heightSymbol,
          heightValue: heightDiff,
          isBotPosition: originX !== null && originZ !== null && f === originX && r === originZ,
          isMatch: Array.isArray((cell as any).matched) && (cell as any).matched.length > 0,
          tooltip: `${key}\nRelative height: ${heightDiff}\nRange: ${cell.height_min} to ${cell.height_max}\nBlocks: ${blocksList}${(cell as any).matched?.length ? `\nMatched: ${(cell as any).matched.join(', ')}` : ''}`,
        });
      } else {
        // Cell exists in backend data but has no blocks - show as unknown
        cells.push({
          key,
          color: '#2a2a2a',
          colors: undefined,
          heightLabel: '?',
          heightValue: 0,
          isBotPosition: originX !== null && originZ !== null && f === originX && r === originZ,
          isMatch: false,
          tooltip: `${key}\nNo block data`,
        });
      }
    }
  }

  return cells;
});
</script>

<style scoped>
.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #EAEAEA;
  margin-bottom: 8px;
  font-size: 13px;
}

.tool-meta {
  color: #7A7A7A;
  font-size: 11px;
  font-weight: 400;
}

.tool-hint {
  color: #9A9A9A;
  font-size: 11px;
  margin-bottom: 8px;
}

.map-params {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
}

.param-row {
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.param-label {
  color: #B3B3B3;
  font-size: 10px;
}

.param-val {
  color: #4A9EFF;
  font-size: 11px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-weight: 600;
}

.map-summary {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #2E2E2E;
}

.summary-label {
  color: #FFB86C;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 6px;
}

.blocks-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.block-tag {
  background: rgba(124, 252, 0, 0.1);
  border: 1px solid rgba(124, 252, 0, 0.3);
  color: #7CFC00;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 9px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-weight: 600;
}

.map-stats {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #2E2E2E;
}

.stat-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 4px;
}

.stat-label {
  color: #B3B3B3;
  font-size: 11px;
}

.stat-val {
  color: #EAEAEA;
  font-size: 11px;
  font-family: 'Monaco', 'Courier New', monospace;
}

.map-grid-container {
  margin: 12px 0;
  padding: 12px;
  background: #1a1a1a;
  border-radius: 4px;
  border: 1px solid #2E2E2E;
  overflow-x: auto;
}

.map-orientation {
  text-align: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2E2E2E;
}

.orientation-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.orientation-label {
  color: #FFB86C;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
}

.orientation-hint {
  color: #7A7A7A;
  font-size: 10px;
}

.flip-btn {
  background: #2a2a2a;
  color: #EAEAEA;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 10px;
  cursor: pointer;
}

.flip-btn:hover {
  border-color: #5a5a5a;
}

.map-grid {
  display: grid;
  gap: 1px;
  width: fit-content;
  margin: 0 auto;
}

.map-cell {
  aspect-ratio: 1;
  min-width: 32px;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  cursor: help;
  transition: transform 0.1s, border-color 0.1s, box-shadow 0.1s;
  position: relative;
  overflow: hidden;
}

.map-cell:hover {
  transform: scale(1.15);
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
  z-index: 10;
}

.map-cell--bot {
  border: 3px solid #FFD700;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.6), inset 0 0 8px rgba(255, 215, 0, 0.2);
  animation: bot-pulse 2s ease-in-out infinite;
}

.map-cell--match {
  outline: 2px solid #4A9EFF;
  box-shadow: 0 0 8px rgba(74, 158, 255, 0.6);
}

@keyframes bot-pulse {
  0%, 100% {
    box-shadow: 0 0 12px rgba(255, 215, 0, 0.6), inset 0 0 8px rgba(255, 215, 0, 0.2);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.9), inset 0 0 12px rgba(255, 215, 0, 0.4);
  }
}

.cell-mosaic {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 0;
}

.mosaic-tile {
  width: 100%;
  height: 100%;
}

.cell-height {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 700;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.9), 0 0 6px rgba(0, 0, 0, 0.5);
  font-family: 'Monaco', 'Courier New', monospace;
  white-space: nowrap;
  position: relative;
  z-index: 1;
}

.map-legend {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #2E2E2E;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #B3B3B3;
  font-size: 10px;
}

.legend-symbol {
  font-size: 14px;
  font-weight: 700;
  color: #EAEAEA;
}
</style>
