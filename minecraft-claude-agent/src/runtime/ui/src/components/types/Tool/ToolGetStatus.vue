<template>
  <div class="status-container">
    <div v-if="parsedStatus" class="status-grid">
      <!-- Position Section -->
      <div class="status-section">
        <div class="section-header">
          <n-icon :component="LocationOutline" class="section-icon" />
          <span>Position</span>
        </div>
        <div class="position-coords">
          <span class="coord-label">X:</span> <span class="coord-value">{{ parsedStatus.position.x }}</span>
          <span class="coord-label">Y:</span> <span class="coord-value">{{ parsedStatus.position.y }}</span>
          <span class="coord-label">Z:</span> <span class="coord-value">{{ parsedStatus.position.z }}</span>
        </div>
      </div>

      <!-- Nearby Players Section -->
      <div v-if="parsedStatus.players && parsedStatus.players.length > 0" class="status-section">
        <div class="section-header">
          <n-icon :component="PeopleOutline" class="section-icon" />
          <span>Nearby Players ({{ parsedStatus.players.length }})</span>
        </div>
        <div class="entity-list">
          <div v-for="(player, idx) in parsedStatus.players" :key="idx" class="entity-item">
            <div class="entity-name">{{ player.username }}</div>
            <div class="entity-details">
              <span class="distance">{{ player.distance }}m</span>
              <span class="entity-pos">{{ player.position.x }}, {{ player.position.y }}, {{ player.position.z }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Nearby Items Section -->
      <div v-if="parsedStatus.items && parsedStatus.items.length > 0" class="status-section">
        <div class="section-header">
          <n-icon :component="CubeOutline" class="section-icon" />
          <span>Nearby Items ({{ parsedStatus.items.length }})</span>
        </div>
        <div class="entity-list">
          <div v-for="(item, idx) in parsedStatus.items" :key="idx" class="entity-item">
            <div class="entity-name">
              {{ item.item }}
              <span v-if="item.count > 1" class="item-count">×{{ item.count }}</span>
            </div>
            <div class="entity-details">
              <span class="distance">{{ item.distance }}m</span>
              <span class="entity-pos">{{ item.position.x }}, {{ item.position.y }}, {{ item.position.z }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Inventory Section -->
      <div v-if="inventoryItems && inventoryItems.length > 0" class="status-section full-width">
        <div class="section-header">
          <n-icon :component="GridOutline" class="section-icon" />
          <span>Inventory ({{ inventoryItems.length }} types)</span>
        </div>
        <div class="inventory-grid">
          <div v-for="(item, idx) in inventoryItems" :key="idx" class="inventory-item">
            <span class="item-name">{{ item.name }}</span>
            <span class="item-count">×{{ item.count }}</span>
          </div>
        </div>
      </div>

      <!-- Vox Section -->
      <div v-if="voxSummary" class="status-section full-width">
        <div class="section-header">
          <n-icon :component="GridOutline" class="section-icon" />
          <span>Nearby Blocks (3×3×3)</span>
          <n-button size="tiny" @click="toggleVoxExpanded" class="toggle-btn">
            {{ voxExpanded ? 'Collapse' : 'Expand' }}
          </n-button>
        </div>
        <div v-if="!voxExpanded" class="vox-summary">
          <div v-for="(count, blockId) in voxSummary" :key="blockId" class="vox-item">
            <span class="block-name">{{ blockId }}</span>
            <span class="block-count">×{{ count }}</span>
          </div>
        </div>
        <div v-else class="vox-detailed">
          <div v-for="(voxel, idx) in parsedStatus.vox" :key="idx" class="vox-detail-item">
            <span class="vox-pos">{{ voxel.x }}, {{ voxel.y }}, {{ voxel.z }}</span>
            <span class="vox-block">{{ voxel.id }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="error-message">
      Failed to parse status data
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { NIcon, NButton } from 'naive-ui';
import { LocationOutline, PeopleOutline, CubeOutline, GridOutline } from '@vicons/ionicons5';

const props = defineProps<{
  item: any;
}>();

const voxExpanded = ref(false);

const parsedStatus = computed(() => {
  const payload = props.item.payload || props.item;
  let output = payload.output;

  if (typeof output === 'string') {
    try {
      output = JSON.parse(output);
    } catch {
      return null;
    }
  }

  return output;
});

const inventoryItems = computed(() => {
  if (!parsedStatus.value?.inventory) return [];

  const inv = parsedStatus.value.inventory;

  // If inventory is a string, try to parse it
  if (typeof inv === 'string') {
    // Try to extract items from the string format
    // Example: "Slot 0: oak_log x64\nSlot 1: cobblestone x32"
    const lines = inv.split('\n').filter(line => line.trim());
    const items: { name: string; count: number }[] = [];

    for (const line of lines) {
      const match = line.match(/(?:Slot \d+|Hand): (.+?) x(\d+)/);
      if (match) {
        const [, name, count] = match;
        // Find if item already exists
        const existing = items.find(i => i.name === name);
        if (existing) {
          existing.count += parseInt(count);
        } else {
          items.push({ name, count: parseInt(count) });
        }
      }
    }

    return items.sort((a, b) => b.count - a.count);
  }

  // If inventory is already an array
  if (Array.isArray(inv)) {
    return inv;
  }

  return [];
});

const voxSummary = computed(() => {
  if (!parsedStatus.value?.vox || !Array.isArray(parsedStatus.value.vox)) return null;

  const summary: Record<string, number> = {};
  for (const voxel of parsedStatus.value.vox) {
    const id = voxel.id || 'unknown';
    summary[id] = (summary[id] || 0) + 1;
  }

  // Sort by count descending
  return Object.fromEntries(
    Object.entries(summary).sort((a, b) => b[1] - a[1])
  );
});

function toggleVoxExpanded() {
  voxExpanded.value = !voxExpanded.value;
}
</script>

<style scoped>
.status-container {
  font-size: 14px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.status-section {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 12px;
}

.status-section.full-width {
  grid-column: 1 / -1;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  color: var(--color-accent);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-icon {
  font-size: 16px;
  color: var(--color-accent);
}

.toggle-btn {
  margin-left: auto;
}

/* Position */
.position-coords {
  display: flex;
  gap: 16px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 15px;
}

.coord-label {
  color: #95a5a6;
  font-weight: 600;
}

.coord-value {
  color: #3498db;
  font-weight: 700;
}

/* Entity Lists (Players & Items) */
.entity-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.entity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.entity-name {
  font-weight: 600;
  color: #e8b86d;
  display: flex;
  align-items: center;
  gap: 6px;
}

.item-count {
  font-size: 12px;
  color: #95a5a6;
  font-weight: 400;
}

.entity-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #95a5a6;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
}

.distance {
  color: #2ecc71;
  font-weight: 600;
}

.entity-pos {
  color: #7f8c8d;
}

/* Inventory Grid */
.inventory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}

.inventory-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  font-size: 13px;
}

.item-name {
  color: #e8b86d;
  font-weight: 500;
}

.inventory-item .item-count {
  color: #3498db;
  font-weight: 600;
}

/* Vox Summary */
.vox-summary {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}

.vox-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  font-size: 13px;
}

.block-name {
  color: #e8b86d;
  font-weight: 500;
}

.block-count {
  color: #95a5a6;
  font-weight: 600;
}

/* Vox Detailed */
.vox-detailed {
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.vox-detail-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
}

.vox-pos {
  color: #7f8c8d;
}

.vox-block {
  color: #e8b86d;
}

.error-message {
  padding: 12px;
  background: rgba(231, 76, 60, 0.1);
  border-radius: 4px;
  color: #e74c3c;
}
</style>
