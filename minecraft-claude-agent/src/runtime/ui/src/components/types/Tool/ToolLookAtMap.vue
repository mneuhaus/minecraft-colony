<template>
  <div class="tl-item__body tool-look-at-map">
    <div class="tool-header">
      <span class="tool-name">Look At Map</span>
      <span class="tool-meta">{{ gridInfo }}</span>
    </div>

    <div class="map-params">
      <div class="param-row" v-if="radius">
        <span class="param-label">radius</span>
        <span class="param-val">{{ radius }}</span>
      </div>
      <div class="param-row" v-if="zoom && zoom > 1">
        <span class="param-label">zoom</span>
        <span class="param-val">{{ zoom }}x ({{ zoom }}x{{ zoom }} blocks/cell)</span>
      </div>
      <div class="param-row" v-if="botHeight !== null">
        <span class="param-label">bot height</span>
        <span class="param-val">y={{ botHeight }}</span>
      </div>
    </div>

    <div class="map-grid-container" v-if="gridCells.length > 0">
      <div class="map-orientation">
        <div class="orientation-label">↑ Forward</div>
        <div class="orientation-hint">← Left | Bot Center | Right →</div>
      </div>
      <div class="map-grid" :style="{ gridTemplateColumns: `repeat(${gridWidth}, 1fr)` }">
        <div
          v-for="cell in gridCells"
          :key="cell.key"
          class="map-cell"
          :class="{ 'map-cell--bot': cell.isBotPosition }"
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
import { computed } from 'vue';

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

const mapData = computed(() => raw.value?.map ?? {});
const cellCount = computed(() => Object.keys(mapData.value).length);

const uniqueBlocks = computed(() => {
  const blocks = new Set<string>();
  for (const cell of Object.values(mapData.value)) {
    const cellData = cell as any;
    if (cellData.blocks && Array.isArray(cellData.blocks)) {
      cellData.blocks.forEach((b: string) => blocks.add(b));
    } else if (cellData.block) {
      blocks.add(cellData.block);
    }
  }
  return Array.from(blocks).sort();
});

const heightStats = computed(() => {
  let min = Infinity;
  let max = -Infinity;

  for (const cell of Object.values(mapData.value)) {
    const cellData = cell as any;
    if (cellData.height_min !== undefined) {
      min = Math.min(min, cellData.height_min);
    }
    if (cellData.height_max !== undefined) {
      max = Math.max(max, cellData.height_max);
    }
    if (cellData.height !== undefined) {
      min = Math.min(min, cellData.height);
      max = Math.max(max, cellData.height);
    }
  }

  if (min === Infinity || max === -Infinity) return null;
  return { min, max };
});

// Parse FR notation key to grid coordinates
function parseFRKey(key: string): { f: number; r: number } | null {
  const match = key.match(/F(-?\d+)\+R(-?\d+)/);
  if (!match) return null;
  return { f: parseInt(match[1], 10), r: parseInt(match[2], 10) };
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
  // Calculate actual grid width from map data, accounting for step
  const rValues = new Set<number>();
  for (const key of Object.keys(mapData.value)) {
    const coords = parseFRKey(key);
    if (!coords) continue;
    rValues.add(coords.r);
  }
  return rValues.size;
});

const gridCells = computed(() => {
  const cells = [];
  const stats = heightStats.value;

  // Parse all cells from the map data
  const cellMap = new Map<string, any>();

  for (const [key, cellData] of Object.entries(mapData.value)) {
    cellMap.set(key, cellData);
  }

  if (cellMap.size === 0) return [];

  // Parse all keys to find actual F and R ranges and detect the step size
  let minF = Infinity, maxF = -Infinity;
  let minR = Infinity, maxR = -Infinity;
  const fValues = new Set<number>();
  const rValues = new Set<number>();

  for (const key of cellMap.keys()) {
    const coords = parseFRKey(key);
    if (!coords) continue;
    minF = Math.min(minF, coords.f);
    maxF = Math.max(maxF, coords.f);
    minR = Math.min(minR, coords.r);
    maxR = Math.max(maxR, coords.r);
    fValues.add(coords.f);
    rValues.add(coords.r);
  }

  if (minF === Infinity) return [];

  // Detect step size from the sorted unique values
  const sortedF = Array.from(fValues).sort((a, b) => a - b);
  const sortedR = Array.from(rValues).sort((a, b) => a - b);
  const stepF = sortedF.length > 1 ? sortedF[1] - sortedF[0] : 1;
  const stepR = sortedR.length > 1 ? sortedR[1] - sortedR[0] : 1;

  // Use the detected step (should be consistent for both F and R with zoom)
  const step = Math.max(stepF, stepR);

  // Generate all cells in proper order using the detected step
  // Top row = far forward (maxF), bottom row = behind (minF)
  // Left = left (minR), right = right (maxR)
  for (let f = maxF; f >= minF; f -= step) {
    for (let r = minR; r <= maxR; r += step) {
      const key = `F${f}+R${r}`;
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
          isBotPosition: key === 'F0+R0',
          tooltip: `${key}${key === 'F0+R0' ? ' (BOT HERE)' : ''}\nRelative height: ${heightDiff}\nRange: ${cell.height_min} to ${cell.height_max}\nBlocks: ${blocksList}`,
        });
      } else {
        // Cell exists in backend data but has no blocks - show as unknown
        cells.push({
          key,
          color: '#2a2a2a',
          colors: undefined,
          heightLabel: '?',
          heightValue: 0,
          isBotPosition: key === 'F0+R0',
          tooltip: `${key}${key === 'F0+R0' ? ' (BOT HERE)' : ''}\nNo block data`,
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
