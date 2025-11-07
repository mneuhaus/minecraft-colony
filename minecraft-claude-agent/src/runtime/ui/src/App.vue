<template>
  <div class="app">
    <aside class="sidebar">
      <header class="sidebar__hdr">Agents</header>
      <div class="sidebar__list">
        <div v-for="b in bots" :key="b.name" class="agent" :aria-selected="activeBot===b.name">
          <div class="agent__row" @click="selectBot(b.name)">
            <div class="agent__name">{{ b.name }}</div>
            <div class="agent__badge" :data-status="b.connectionStatus">{{ b.connectionStatus || 'idle' }}</div>
          </div>

          <!-- Only show details for active bot -->
          <div v-if="activeBot===b.name" class="agent__details">
            <!-- Inventory -->
            <SidebarInventory />

            <!-- Info Row: Blueprints + Reset -->
            <div class="agent__info-row">
              <button class="chip chip--link" @click.stop="bpModalOpen = true">
                {{ blueprints.length }} Blueprint{{ blueprints.length !== 1 ? 's' : '' }}
              </button>
              <button class="chip chip--danger" @click.stop="resetActiveBot" :disabled="resetting">
                {{ resetting ? 'Resetting…' : 'Reset' }}
              </button>
            </div>
          </div>

          <!-- Todos -->
          <div v-if="Array.isArray(b.todo) && b.todo.length" class="agent__todos">
            <div v-for="t in b.todo.slice(0,3)" :key="t.content" class="todo">
              <span class="todo__box" :class="(t.done || String(t.status||'').toLowerCase()==='completed') && 'todo__box--done'"></span>
              <span class="todo__text">{{ t.content }}</span>
            </div>
            <div class="todo__progress" v-if="b.todoProgress">{{ b.todoProgress.done }}/{{ b.todoProgress.total }} done</div>
          </div>
        </div>
      </div>
    </aside>
    <main class="main">
      <Timeline :items="filteredItems" @openInspector="openInspector" />
    </main>
    <Inspector :open="inspectorOpen" :item="inspectorItem" @close="inspectorOpen=false" />
    <BlueprintsModal :open="bpModalOpen" :items="blueprints" @close="bpModalOpen=false" @refresh="loadBlueprints" @view="viewBlueprint" @remove="handleRemoveBlueprint" @create="handleCreateBlueprint" />
    <BlueprintDetail v-if="bpDetailOpen" :name="bpDetailName" :data="bpDetail" @close="bpDetailOpen=false" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import type { store as Store } from './main';
import Timeline from './components/Timeline.vue';
import Inspector from './components/Inspector.vue';
import BlueprintsModal from './components/BlueprintsModal.vue';
import BlueprintDetail from './components/BlueprintDetail.vue';
import SidebarInventory from './components/SidebarInventory.vue';

const store = inject<any>('store');
// Simple client-side de-dup: same type/bot/tool/text/ts
const seenKeys = new Set<string>();
function makeKey(e:any){
  const t = e?.type || '';
  const b = e?.bot_id || '';
  const ts = e?.ts || '';
  const p = e?.payload || {};
  const tool = p.tool_name || '';
  const text = (p.text || p.message || JSON.stringify(p.input||{})).slice(0,200);
  return `${t}|${b}|${tool}|${text}|${ts}`;
}
function pushDedup(e:any){
  const k = makeKey(e);
  if (seenKeys.has(k)) return;
  seenKeys.add(k);
  store.items.push(e);
  if (seenKeys.size > 2000) {
    // trim to avoid unbounded growth
    const arr = Array.from(seenKeys);
    for (let i=0;i<500;i++) seenKeys.delete(arr[i]);
  }
}
const bots = computed(()=> store.bots);
const items = computed(()=> store.items);
const activeBot = computed(()=> store.activeBot);
const viewMode = computed(()=> store.viewMode);

const resetting = ref(false);
const blueprints = ref<any[]>([]);
const bpModalOpen = ref(false);
const bpDetailOpen = ref(false);
const bpDetailName = ref('');
const bpDetail = ref<any>(null);
const inspectorOpen = ref(false);
const inspectorItem = ref<any>(null);

function openInspector(item: any){ inspectorItem.value = item; inspectorOpen.value = true; }
function setViewMode(mode: 'single'|'all'){ store.viewMode = mode; if (mode==='single' && store.activeBot) loadBotTimeline(store.activeBot); else loadAllTimeline(); }
function selectBot(name: string){ store.activeBot = name; if (store.viewMode==='single') loadBotTimeline(name); }

async function loadBots(){
  const res = await fetch('/api/bots');
  const data = await res.json();
  store.bots = data;
  if (!store.activeBot && data.length) store.activeBot = data[0].name;
}
async function loadBotTimeline(botName: string){
  const res = await fetch(`/api/bots/${encodeURIComponent(botName)}/events?limit=120`);
  const data = await res.json();
  const events = data.events || [];
  // Get bot ID to properly filter
  const bot = store.bots.find((b: any) => b.name === botName);
  const botId = bot?.id;
  // reset bot-specific items
  if (botId) {
    store.items = store.items.filter((i: any) => i.bot_id !== botId);
  }
  events.forEach((e: any) => pushDedup(e));
}
async function loadAllTimeline(){
  if (!store.bots || store.bots.length===0) await loadBots();
  store.items = [];
  const perBot = Math.max(10, Math.floor(300 / Math.max(1, store.bots.length)));
  await Promise.all(store.bots.map(async (b: any) => {
    const res = await fetch(`/api/bots/${encodeURIComponent(b.name)}/events?limit=${perBot}`);
    const data = await res.json();
    const events = data.events || [];
    events.forEach((e: any) => store.items.push(e));
  }));
}
async function resetActiveBot(){
  if (!store.activeBot) return;
  if (!confirm(`Reset bot "${store.activeBot}"?`)) return;
  resetting.value = true;
  try {
    const res = await fetch(`/api/bots/${encodeURIComponent(store.activeBot)}/reset`, { method: 'POST' });
    if (!res.ok) throw new Error('reset_failed');
    setTimeout(()=>{ loadBots(); loadBotTimeline(store.activeBot); }, 1000);
  } finally { resetting.value = false; }
}

const filteredItems = computed(()=> {
  const active = store.activeBot;
  // Get bot ID from bot name
  const activeBot = store.bots.find((b: any) => b.name === active);
  const activeBotId = activeBot?.id;

  const prelim = store.items
    .filter((e: any) => store.viewMode==='all' || e.bot_id===activeBotId)
    // Hide noisy CraftScript internals from the main timeline; view them in the card's Show Logs instead
    .filter((e: any) => !(e.type==='tool' && /^(craftscript_step|craftscript_trace|craftscript_status)$/i.test(String(e?.payload?.tool_name||''))))
    // Also hide send_chat spam from tools
    .filter((e: any) => !(e.type==='tool' && /send_chat/i.test(String(e?.payload?.tool_name||''))));

  // De-duplicate CraftScript Status by job id: keep only the latest event per job
  const seenJobs = new Set<string>();
  const result: any[] = [];
  for (let i = prelim.length - 1; i >= 0; i--) {
    const e: any = prelim[i];
    const tool = String(e?.payload?.tool_name || '').toLowerCase();
    if (e.type === 'tool' && tool === 'craftscript_status') {
      let id = '';
      try {
        const raw = e?.payload?.output;
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        id = data?.id || data?.job_id || '';
      } catch {}
      if (id) {
        if (seenJobs.has(id)) continue; // skip older duplicates
        seenJobs.add(id);
      }
    }
    result.push(e);
  }
  return result.reverse();
});

function connectWebSocket(){
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
  ws.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    const list = Array.isArray(data) ? data : [data];
    for (const msg of list) {
      if (msg.type === 'history' && Array.isArray(msg.events)) {
        for (const e of msg.events) pushDedup(e);
      } else {
        pushDedup(msg);
      }
    }
    if (store.items.length > 800) store.items = store.items.slice(-800);
  };
  ws.onclose = () => setTimeout(connectWebSocket, 3000);
}

onMounted(async () => {
  await loadBots();
  if (store.activeBot && store.viewMode==='single') await loadBotTimeline(store.activeBot);
  else await loadAllTimeline();
  connectWebSocket();
  loadBlueprints();
});

async function loadBlueprints(){
  try { const res = await fetch('/api/blueprints'); blueprints.value = await res.json(); } catch {}
}
async function viewBlueprint(name: string){
  try {
    const res = await fetch(`/api/blueprints/${encodeURIComponent(name)}`);
    const data = await res.json();
    bpDetail.value = data; bpDetailName.value = name; bpDetailOpen.value = true;
  } catch {}
}
async function handleRemoveBlueprint(name: string){
  if (!confirm(`Remove blueprint "${name}"?`)) return;
  const res = await fetch(`/api/blueprints/${encodeURIComponent(name)}`, { method:'DELETE' });
  if (res.ok) loadBlueprints();
}
async function handleCreateBlueprint(payload: any){
  try {
    const res = await fetch('/api/blueprints', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('create_failed');
    loadBlueprints();
  } catch { alert('Failed to create blueprint'); }
}
</script>

<style scoped>
.app { display: grid; grid-template-columns: 280px 1fr; height: 100vh; background: #1C1C1C; color: #EAEAEA; }
.sidebar { background: #202020; border-right: 1px solid #2E2E2E; padding: 16px; overflow: auto; }
.sidebar__hdr { font-weight: 600; margin-bottom: 8px; }
.chip { padding: 6px 10px; border-radius: 8px; background: #2A2A2A; border: 1px solid #2E2E2E; color: #EAEAEA; cursor: pointer; }
.chip--active { background: #2f2f2f; border-color: #E96D2F; }
.sidebar__list { display: flex; flex-direction: column; gap: 6px; }
.agent { border: 1px solid #2E2E2E; border-radius: 10px; padding: 8px; background: #202020; cursor: pointer; }
.agent[aria-selected="true"] { outline: 1px solid #E96D2F; }
.agent__row { display: flex; justify-content: space-between; align-items: center; }
.agent__badge { font-size: 11px; border: 1px solid #2E2E2E; border-radius: 999px; padding: 2px 8px; }
.agent__todos { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; color: #B3B3B3; }
.todo { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.todo__box { width: 12px; height: 12px; background: #EAEAEA; border: 1px solid #EAEAEA; border-radius: 3px; }
.todo__box--done { background: #2F4A3C; border-color: #365246; }
.todo__text { color: #B3B3B3; }
.todo__progress { font-size: 11px; color: #7A7A7A; }
.agent__details { margin-top: 8px; padding-top: 8px; border-top: 1px solid #2E2E2E; }
.agent__info-row { display: flex; gap: 6px; margin-top: 8px; }
.chip--link { flex: 1; text-align: center; border-color: #E96D2F; color: #E96D2F; }
.chip--link:hover { background: #2f2f2f; }
.chip--danger { background: #4A2020; border-color: #6E2E2E; color: #E96D6D; }
.chip--danger:hover:not(:disabled) { background: #5A2828; border-color: #8E3E3E; }
.chip--danger:disabled { opacity: 0.5; cursor: not-allowed; }
.main { overflow: hidden; }
</style>
