<template>
  <div class="sidebar-inventory" v-if="inv">
    <div class="inventory-header">
      <h4>Inventory</h4>
      <div class="inventory-stats">
        <span class="stat">{{ inv.totalTypes }} types</span>
        <span class="stat">{{ inv.slotsUsed }}/{{ inv.totalSlots }} slots</span>
      </div>
    </div>
    <div class="inventory-grid">
      <div
        v-for="slot in 36"
        :key="slot"
        class="inventory-slot"
        :class="{ filled: !!slotItem(slot-1) }"
      >
        <template v-if="slotItem(slot-1)">
          <img :src="getItemTexture(slotItem(slot-1)!.name)" class="item-icon" :alt="slotItem(slot-1)!.name"
               @error="(e)=>((e.target as HTMLImageElement).style.display='none')" />
          <div class="item-count">{{ slotItem(slot-1)!.count }}</div>
          <div class="item-tooltip">{{ formatItemName(slotItem(slot-1)!.name) }}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, ref, inject } from 'vue';

const store = inject<any>('store');
const activeBot = computed(()=> store.activeBot);
const inv = ref<{ totalTypes:number; slotsUsed:number; totalSlots:number; items:Array<{name:string,count:number}> }|null>(null);
let timer: any = null;

async function load(){
  if (!activeBot.value) { inv.value = null; return; }
  try {
    const res = await fetch(`/api/bots/${encodeURIComponent(activeBot.value)}/inventory`);
    if (!res.ok) throw new Error('fetch_failed');
    const data = await res.json();
  inv.value = data?.ok ? data : null;
  } catch {}
}

function slotItem(idx: number){
  if (!inv.value) return null;
  return inv.value.items[idx] || null;
}

function getItemTexture(name: string){
  const clean = name.replace(/^minecraft:/,'');
  return `/api/minecraft/item/${encodeURIComponent(clean)}/texture`;
}

function formatItemName(name: string): string {
  return name
    .replace(/minecraft:/g, '')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

onMounted(()=> {
  load();
  timer = setInterval(load, 4000);
});

watch(activeBot, ()=> load());

// no onBeforeUnmount available here during SSR build; sidebar lives for app lifetime
</script>

<style scoped>
.sidebar-inventory {
  margin-top: 16px;
}

.inventory-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.inventory-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.inventory-stats {
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.stat {
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.inventory-grid {
  display: grid;
  grid-template-columns: repeat(5, 42px);
  gap: 4px;
  background: rgba(0, 0, 0, 0.2);
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.inventory-slot {
  aspect-ratio: 1;
  background: linear-gradient(135deg, #2b2f38 0%, #1a1d24 100%);
  border: 1px solid #0f1115;
  border-radius: 4px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.inventory-slot.filled {
  border-color: rgba(255, 255, 255, 0.12);
  background: linear-gradient(135deg, #3d4048 0%, #262932 100%);
}

.inventory-slot:hover {
  transform: scale(1.05);
  z-index: 10;
}

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
  font-size: 13px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.item-tooltip {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  z-index: 100;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.inventory-slot:hover .item-tooltip {
  opacity: 1;
}
</style>
