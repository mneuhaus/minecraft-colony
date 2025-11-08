<template>
  <div class="tool-inventory">
    <div class="inventory-header">
      <h3>Inventory</h3>
      <div class="inventory-stats">
        <span class="stat">{{ (inventoryData && inventoryData.totalTypes) || 0 }} types</span>
        <span class="stat">{{ (inventoryData && inventoryData.slotsUsed) || 0 }}/36 slots</span>
      </div>
    </div>

    <div v-if="inventoryData" class="inventory-grid">
      <div
        v-for="slot in 36"
        :key="slot"
        class="inventory-slot"
        :class="{ filled: getSlotItem(slot - 1) }"
      >
        <template v-if="getSlotItem(slot - 1)">
          <img :src="getItemTexture(getSlotItem(slot - 1).name)" :alt="getSlotItem(slot - 1).name" class="item-icon"
               @error="(e)=>((e.target as HTMLImageElement).style.display='none')" />
          <div class="item-count">{{ getSlotItem(slot - 1).count }}</div>
          <div class="item-tooltip">{{ formatItemName(getSlotItem(slot - 1).name) }}</div>
        </template>
      </div>
    </div>

    <div v-if="isEmpty" class="empty-inventory">
      <div class="empty-icon">📭</div>
      <div class="empty-text">Inventory is empty</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  item: any;
}>();

const output = computed(() => props.item.output || props.item.payload?.output || '');

const isEmpty = computed(() => output.value.toLowerCase().includes('inventory is empty'));

const inventoryData = computed(() => {
  if (isEmpty.value) return null;

  const text = output.value;
  const lines = text.split('\n').filter((l: string) => l.trim());

  const items: Array<{ name: string; count: number }> = [];
  let totalTypes = 0;
  let totalItems = 0;
  let slotsUsed = 0;

  for (const line of lines) {
    // Parse item lines like "  4x apple" or "  32x brown_terracotta"
    const itemMatch = line.match(/^\s*(\d+)x\s+(.+)$/);
    if (itemMatch) {
      const count = parseInt(itemMatch[1]);
      const name = itemMatch[2].trim();
      items.push({ name, count });
      continue;
    }

    // Parse stats
    const typesMatch = line.match(/Total:\s*(\d+)\s+different/i);
    if (typesMatch) {
      totalTypes = parseInt(typesMatch[1]);
      continue;
    }

    const totalMatch = line.match(/Total items:\s*(\d+)/i);
    if (totalMatch) {
      totalItems = parseInt(totalMatch[1]);
      continue;
    }

    const slotsMatch = line.match(/Slots used:\s*(\d+)/i);
    if (slotsMatch) {
      slotsUsed = parseInt(slotsMatch[1]);
    }
  }

  return {
    items,
    totalTypes,
    totalItems,
    slotsUsed,
  };
});

// Map items to slots based on order from inventory
const slotItems = computed(() => {
  if (!inventoryData.value) return [];
  const slots = new Array(36).fill(null);
  inventoryData.value.items.forEach((item, idx) => {
    if (idx < 36) slots[idx] = item;
  });
  return slots;
});

function getSlotItem(index: number) {
  return slotItems.value[index];
}

function getItemTexture(name: string): string {
  const cleanName = name.replace(/^minecraft:/, '');
  return `/api/minecraft/item/${encodeURIComponent(cleanName)}/texture`;
}

function formatItemName(name: string): string {
  return name
    .replace(/minecraft:/g, '')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
</script>

<style scoped>
.inv-chip {
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
  font-size: var(--font-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.inventory-grid {
  display: grid;
  grid-template-columns: repeat(9, minmax(16px, 1fr));
  gap: 4px;
  background: var(--color-bg-muted);
  padding: var(--spacing-sm);
  border-radius: var(--radius-lg);
  margin-top: var(--spacing-md);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}
.inventory-slot {
  aspect-ratio: 1;
  background: linear-gradient(135deg, #2b2f38 0%, #1a1d24 100%);
  border: 1px solid #0f1115;
  border-radius: var(--radius-sm);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--transition-base);
}
.inventory-slot.filled {
  border-color: rgba(255,255,255,0.1);
  background: linear-gradient(135deg, #3d4048 0%, #262932 100%);
}
.inventory-slot:hover { transform: scale(1.03); }
.item-icon {
  width: 85%;
  height: 85%;
  image-rendering: pixelated;
  object-fit: contain;
}
.item-count {
  position: absolute;
  bottom: 3px;
  right: 4px;
  font-size: var(--font-xs);
  font-weight: 600;
}
.item-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.8);
  color: var(--color-text-primary);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: var(--font-xs);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
}
.inventory-slot:hover .item-tooltip { opacity: 1; }

.empty-inventory { text-align: center; color: var(--color-text-muted); padding: var(--spacing-lg); }
.empty-icon { font-size: 32px; margin-bottom: var(--spacing-sm); }
.empty-text { font-size: var(--font-sm); text-transform: uppercase; letter-spacing: 0.05em; }
</style>
