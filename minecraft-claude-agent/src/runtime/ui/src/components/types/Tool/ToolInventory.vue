<template>
  <div class="tool-inventory">
    <div class="inventory-header">
      <h3>Inventory</h3>
      <div class="inventory-stats">
        <span class="stat">{{ inventoryData?.totalTypes || 0 }} types</span>
        <span class="stat">{{ inventoryData?.slotsUsed || 0 }}/36 slots</span>
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
.tool-inventory {
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  border-left: 3px solid #e67e22;
}

.inventory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.inventory-header h3 {
  margin: 0;
  font-size: 14px;
  color: #e67e22;
  font-weight: 600;
}

.inventory-stats {
  display: flex;
  gap: 8px;
}

.inventory-grid { display:grid; grid-template-columns:repeat(9,1fr); grid-template-rows:repeat(4,1fr); gap:2px; background:#0f0f0f; padding:4px; border-radius:6px; margin-bottom:12px; }

.inventory-slot { aspect-ratio:1; background:#2b2b2b; border:1px solid #3a3a3a; border-radius:3px; position:relative; display:flex; align-items:center; justify-content:center; transition: all .15s; }

.inventory-slot.filled { background:#3a3a3a; border-color:#4a4a4a; }

.inventory-slot:hover { border-color:#777; box-shadow: inset 0 0 2px rgba(255,255,255,0.1); }

.item-count { font-size:12px; color:#EAEAEA; font-family:'Monaco','Menlo','Courier New',monospace; font-weight:700; text-shadow:0 0 3px rgba(0,0,0,0.9); }

.item-tooltip {
  display: none;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: #ffffff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 100;
  margin-bottom: 4px;
  pointer-events: none;
}

.inventory-slot:hover .item-tooltip {
  display: block;
}

.stat {
  font-size: 12px;
  color: #ecf0f1;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px 8px;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
}

.empty-inventory {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  border: 1px dashed rgba(230, 126, 34, 0.3);
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.empty-text {
  font-size: 13px;
  color: #95a5a6;
  font-style: italic;
}
</style>
