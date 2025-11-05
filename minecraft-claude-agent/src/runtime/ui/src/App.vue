<template>
  <div class="app">
    <aside class="sidebar">
      <header class="sidebar__hdr">Agents</header>
      <div class="sidebar__view">
        <button :class="['chip', viewMode==='single' && 'chip--active']" @click="setViewMode('single')">This Bot</button>
        <button :class="['chip', viewMode==='all' && 'chip--active']" @click="setViewMode('all')">All Bots</button>
      </div>
      <div class="sidebar__list">
        <div v-for="b in bots" :key="b.name" class="agent" :aria-selected="activeBot===b.name" @click="selectBot(b.name)">
          <div class="agent__row">
            <div class="agent__name">{{ b.name }}</div>
            <div class="agent__badge" :data-status="b.connectionStatus">{{ b.connectionStatus || 'idle' }}</div>
          </div>
          <div v-if="Array.isArray(b.todo) && b.todo.length" class="agent__todos">
            <div v-for="t in b.todo.slice(0,3)" :key="t.content" class="todo">
              <span class="todo__box" :class="(t.done || String(t.status||'').toLowerCase()==='completed') && 'todo__box--done'"></span>
              <span class="todo__text">{{ t.content }}</span>
            </div>
            <div class="todo__progress" v-if="b.todoProgress">{{ b.todoProgress.done }}/{{ b.todoProgress.total }} done</div>
          </div>
        </div>
      </div>
      <div class="sidebar__actions" v-if="activeBot">
        <button class="chip" @click="resetActiveBot" :disabled="resetting">{{ resetting? 'Resetting…' : 'Reset Selected Bot' }}</button>
      </div>
    </aside>
    <main class="main">
      <Timeline :items="filteredItems" @openInspector="openInspector" />
    </main>
    <Inspector :open="inspectorOpen" :item="inspectorItem" @close="inspectorOpen=false" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import type { store as Store } from './main';
import Timeline from './components/Timeline.vue';
import Inspector from './components/Inspector.vue';

const store = inject<any>('store');
const bots = computed(()=> store.bots);
const items = computed(()=> store.items);
const activeBot = computed(()=> store.activeBot);
const viewMode = computed(()=> store.viewMode);

const resetting = ref(false);
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
  const events = await res.json();
  // reset bot-specific items
  store.items = store.items.filter((i: any) => i.bot_id !== botName);
  events.forEach((e: any) => store.items.push(e));
}
async function loadAllTimeline(){
  if (!store.bots || store.bots.length===0) await loadBots();
  store.items = [];
  const perBot = Math.max(10, Math.floor(300 / Math.max(1, store.bots.length)));
  await Promise.all(store.bots.map(async (b: any) => {
    const res = await fetch(`/api/bots/${encodeURIComponent(b.name)}/events?limit=${perBot}`);
    (await res.json()).forEach((e: any) => store.items.push(e));
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
  return store.items
    .filter((e: any) => store.viewMode==='all' || e.bot_id===active)
    .filter((e: any) => !(e.type==='tool' && /send_chat/i.test(String(e?.payload?.tool_name||''))));
});

function connectWebSocket(){
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
  ws.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    const list = Array.isArray(data) ? data : [data];
    for (const msg of list) {
      if (msg.type === 'history' && Array.isArray(msg.events)) {
        store.items.push(...msg.events);
      } else {
        store.items.push(msg);
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
});
</script>

<style scoped>
.app { display: grid; grid-template-columns: 280px 1fr; height: 100vh; background: #1C1C1C; color: #EAEAEA; }
.sidebar { background: #202020; border-right: 1px solid #2E2E2E; padding: 16px; overflow: auto; }
.sidebar__hdr { font-weight: 600; margin-bottom: 8px; }
.chip { padding: 6px 10px; border-radius: 8px; background: #2A2A2A; border: 1px solid #2E2E2E; color: #EAEAEA; cursor: pointer; }
.chip--active { background: #2f2f2f; border-color: #E96D2F; }
.sidebar__view { display: flex; gap: 6px; margin-bottom: 10px; }
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
.main { overflow: hidden; }
</style>

