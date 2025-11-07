<template>
  <div class="sidebar-inventory" v-if="inv">
    <div class="inv__hdr">
      <span class="inv__title">Inventory</span>
      <span class="inv__stats">
        <span class="chip">{{ inv.totalTypes }} types</span>
        <span class="chip">{{ inv.slotsUsed }}/{{ inv.totalSlots }} slots</span>
      </span>
    </div>
    <div class="inv-grid">
      <div
        v-for="slot in 36"
        :key="slot"
        class="inv-slot"
        :class="{ 'inv-slot--filled': !!slotItem(slot-1) }"
        :title="slotItem(slot-1)?.name || 'empty'"
      >
        <template v-if="slotItem(slot-1)">
          <img :src="getItemTexture(slotItem(slot-1)!.name)" class="inv-icon" :alt="slotItem(slot-1)!.name"
               @error="(e)=>((e.target as HTMLImageElement).style.display='none')" />
          <span class="inv-badge">{{ slotItem(slot-1)!.count }}</span>
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

onMounted(()=> {
  load();
  timer = setInterval(load, 4000);
});

watch(activeBot, ()=> load());

// no onBeforeUnmount available here during SSR build; sidebar lives for app lifetime
</script>

<style scoped>
.sidebar-inventory { margin-top: 12px; padding: 10px; border: 1px solid #2E2E2E; border-radius: 10px; background: #181818; }
.inv__hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.inv__title { color:#FFB86C; font-weight:600; font-size:13px; }
.inv__stats { display:flex; gap:6px; }
.chip { padding: 2px 6px; border:1px solid #2E2E2E; border-radius:6px; font-size:10px; color:#B3B3B3; }
.inv-grid { display:grid; grid-template-columns:repeat(9,1fr); gap:2px; background:#0f0f0f; padding:4px; border-radius:6px; }
.inv-slot { aspect-ratio:1; background:#2b2b2b; border:1px solid #3a3a3a; border-radius:3px; display:flex; align-items:center; justify-content:center; color:#EAEAEA; font-weight:700; font-family:'Monaco','Courier New',monospace; font-size:12px; }
.inv-slot--filled { background:#3a3a3a; border-color:#4a4a4a; }
.inv-slot:hover { border-color:#777; box-shadow: inset 0 0 2px rgba(255,255,255,0.1); }
.inv-icon { width:80%; height:80%; image-rendering: pixelated; object-fit: contain; }
.inv-count { text-shadow: 0 0 3px rgba(0,0,0,0.9); }
</style>
