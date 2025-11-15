<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-layout has-sider class="app-layout">
      <n-layout-sider
        bordered
        collapse-mode="width"
        :collapsed-width="0"
        :width="320"
        :native-scrollbar="false"
        show-trigger="bar"
        class="sidebar"
      >
        <n-space vertical :size="16" class="sidebar-content">
          <n-h3 prefix="bar" class="sidebar-header">
            Colony Agents
          </n-h3>

          <!-- Bot List -->
          <n-space vertical :size="8">
            <n-card
              v-for="b in bots"
              :key="b.name"
              size="small"
              :bordered="activeBot === b.name"
              :class="{ 'bot-card-active': activeBot === b.name }"
              @click="selectBot(b.name)"
              hoverable
              class="bot-card"
            >
              <n-space vertical :size="12">
                <!-- Header Row -->
                <n-space justify="space-between" align="center">
                  <n-text strong>{{ b.name }}</n-text>
                  <n-badge
                    :type="getStatusType(b.connectionStatus)"
                    :value="b.connectionStatus || 'idle'"
                  />
                </n-space>

                <!-- Details (only for active bot) -->
                <div v-if="activeBot === b.name">
                  <!-- Health & Food -->
                  <n-space vertical :size="8">
                    <div>
                      <n-text depth="3" :size="12">Health</n-text>
                      <n-progress
                        type="line"
                        :percentage="(b.health || 0) / 20 * 100"
                        :color="getHealthColor(b.health)"
                        :show-indicator="false"
                        :height="6"
                      />
                      <n-text depth="3" :size="12">{{ b.health || 0 }}/20</n-text>
                    </div>
                    <div>
                      <n-text depth="3" :size="12">Food</n-text>
                      <n-progress
                        type="line"
                        :percentage="(b.food || 0) / 20 * 100"
                        status="success"
                        :show-indicator="false"
                        :height="6"
                      />
                      <n-text depth="3" :size="12">{{ b.food || 0 }}/20</n-text>
                    </div>
                  </n-space>

                  <!-- Position & Game Mode -->
                  <n-descriptions :column="2" size="small" style="margin-top: 12px;">
                    <n-descriptions-item label="Position">
                      <n-text code v-if="b.position">
                        {{ Math.floor(b.position.x) }}, {{ Math.floor(b.position.y) }}, {{ Math.floor(b.position.z) }}
                      </n-text>
                      <n-text depth="3" v-else>Unknown</n-text>
                    </n-descriptions-item>
                    <n-descriptions-item label="Mode">
                      <n-tag size="small">{{ b.gameMode || 'unknown' }}</n-tag>
                    </n-descriptions-item>
                  </n-descriptions>

                  <!-- Inventory -->
                  <SidebarInventory />

                  <!-- Actions -->
                  <n-space :size="8" style="margin-top: 12px;">
                    <n-button size="small" @click.stop="bpModalOpen = true" secondary>
                      {{ blueprints.length }} Blueprint{{ blueprints.length !== 1 ? 's' : '' }}
                    </n-button>
                    <n-button size="small" @click.stop="openIssuesModal" secondary>
                      {{ openIssuesCount }} Issue{{ openIssuesCount !== 1 ? 's' : '' }}
                    </n-button>
                    <n-popconfirm @positive-click="resetActiveBot">
                      <template #trigger>
                        <n-button size="small" type="error" :loading="resetting" @click.stop>
                          Reset
                        </n-button>
                      </template>
                      Reset bot "{{ store.activeBot }}"?
                    </n-popconfirm>
                  </n-space>
                </div>

                <!-- Todos (always show if exist) -->
                <div v-if="Array.isArray(b.todo) && b.todo.length">
                  <n-divider style="margin: 8px 0;" />
                  <n-space vertical :size="4">
                    <n-checkbox
                      v-for="t in b.todo.slice(0, 3)"
                      :key="t.content"
                      :checked="t.done || String(t.status || '').toLowerCase() === 'completed'"
                      disabled
                      size="small"
                    >
                      <n-text :depth="3" :size="12">{{ t.content }}</n-text>
                    </n-checkbox>
                    <n-text v-if="b.todoProgress" depth="3" :size="11">
                      {{ b.todoProgress.done }}/{{ b.todoProgress.total }} done
                    </n-text>
                  </n-space>
                </div>
              </n-space>
            </n-card>
          </n-space>
        </n-space>
      </n-layout-sider>

      <!-- Main Content -->
      <n-layout :native-scrollbar="false">
        <n-layout-header bordered class="header">
          <n-space justify="space-between" align="center">
            <n-h2 style="margin: 0;">Activity Timeline</n-h2>
            <n-space :size="12">
              <n-radio-group v-model:value="store.viewMode" @update:value="setViewMode" size="small">
                <n-radio-button value="single">Active Bot</n-radio-button>
                <n-radio-button value="all">All Bots</n-radio-button>
              </n-radio-group>
            </n-space>
          </n-space>
        </n-layout-header>

        <n-layout-content :native-scrollbar="false" content-style="padding: 24px;">
          <Timeline :items="filteredItems" @openInspector="openInspector" />
        </n-layout-content>
      </n-layout>
    </n-layout>

    <!-- Modals -->
    <Inspector :open="inspectorOpen" :item="inspectorItem" @close="inspectorOpen = false" />
    <BlueprintsModal
      :open="bpModalOpen"
      :items="blueprints"
      @close="bpModalOpen = false"
      @refresh="loadBlueprints"
      @view="viewBlueprint"
      @remove="handleRemoveBlueprint"
      @create="handleCreateBlueprint"
    />
    <BlueprintDetail
      v-if="bpDetailOpen"
      :name="bpDetailName"
      :data="bpDetail"
      @close="bpDetailOpen = false"
    />
    <IssueTrackerModal
      :open="issuesModalOpen"
      :items="issues"
      :active-bot="store.activeBot"
      :bots="botNames"
      @close="issuesModalOpen = false"
      @refresh="loadIssues"
    />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue';
import { darkTheme } from 'naive-ui';
import { themeOverrides } from './theme';
import type { store as Store } from './main';
import Timeline from './components/Timeline.vue';
import Inspector from './components/Inspector.vue';
import BlueprintsModal from './components/BlueprintsModal.vue';
import BlueprintDetail from './components/BlueprintDetail.vue';
import IssueTrackerModal from './components/IssueTrackerModal.vue';
import SidebarInventory from './components/SidebarInventory.vue';

const store = inject<any>('store');

// Simple client-side de-dup
const seenKeys = new Set<string>();

function normalizeEvent(e: any) {
  if (!e || typeof e !== 'object') return e;
  if (e.type === 'chat') {
    const existing = e.payload || {};
    const payload = {
      from: existing.from ?? e.from,
      text: existing.text ?? e.text ?? '',
      direction: existing.direction ?? e.direction ?? (existing.from ? 'out' : 'in'),
      channel: existing.channel ?? e.channel ?? 'chat',
    };
    return { ...e, payload };
  }
  return e;
}

function makeKey(e: any) {
  const normalized = normalizeEvent(e);
  const t = normalized?.type ?? e?.type ?? '';
  const b = normalized?.bot_id ?? e?.bot_id ?? '';
  const ts = normalized?.ts ?? e?.ts ?? '';
  const p = normalized?.payload || {};
  const tool = p.tool_name || '';
  const text = (p.text || p.message || JSON.stringify(p.input || {})).slice(0, 200);
  return `${t}|${b}|${tool}|${text}|${ts}`;
}

function pushDedup(e: any) {
  const normalized = normalizeEvent(e);
  if (!normalized) return;
  const k = makeKey(normalized);
  if (seenKeys.has(k)) return;
  seenKeys.add(k);
  store.items.push(normalized);
  if (seenKeys.size > 2000) {
    const arr = Array.from(seenKeys);
    for (let i = 0; i < 500; i++) seenKeys.delete(arr[i]);
  }
}

const bots = computed(() => store.bots);
const items = computed(() => store.items);
const activeBot = computed(() => store.activeBot);
const viewMode = computed(() => store.viewMode);

const resetting = ref(false);
const blueprints = ref<any[]>([]);
const bpModalOpen = ref(false);
const bpDetailOpen = ref(false);
const bpDetailName = ref('');
const bpDetail = ref<any>(null);
const issues = ref<any[]>([]);
const issuesModalOpen = ref(false);
const inspectorOpen = ref(false);
const inspectorItem = ref<any>(null);
const botNames = computed(() => bots.value.map((b: any) => b.name));
const openIssuesCount = computed(() =>
  issues.value.filter((i: any) => !['resolved', 'closed'].includes(String(i.state))).length
);

function getStatusType(status: string): 'success' | 'info' | 'warning' | 'error' {
  if (status === 'connected') return 'success';
  if (status === 'connecting') return 'info';
  if (status === 'error') return 'error';
  return 'warning';
}

function getHealthColor(health: number): string {
  if (health > 15) return '#5cb85c';
  if (health > 10) return '#f0ad4e';
  return '#d9534f';
}

function openInspector(item: any) {
  inspectorItem.value = item;
  inspectorOpen.value = true;
}

function setViewMode(mode: 'single' | 'all') {
  store.viewMode = mode;
  if (mode === 'single' && store.activeBot) loadBotTimeline(store.activeBot);
  else loadAllTimeline();
}

function selectBot(name: string) {
  store.activeBot = name;
  if (store.viewMode === 'single') loadBotTimeline(name);
}

async function loadBots() {
  const res = await fetch('/api/bots');
  const data = await res.json();
  store.bots = data;
  if (!store.activeBot && data.length) store.activeBot = data[0].name;
}

async function loadIssues() {
  try {
    const query = store.activeBot ? `?bot=${encodeURIComponent(store.activeBot)}` : '';
    const res = await fetch(`/api/issues${query}`);
    issues.value = await res.json();
  } catch (error) {
    console.error('Failed to load issues', error);
    issues.value = [];
  }
}

async function loadBotTimeline(botName: string) {
  const res = await fetch(`/api/bots/${encodeURIComponent(botName)}/events?limit=120`);
  const data = await res.json();
  const events = data.events || [];
  const bot = store.bots.find((b: any) => b.name === botName);
  const botId = bot?.id;
  if (botId) {
    store.items = store.items.filter((i: any) => i.bot_id !== botId);
  }
  events.forEach((e: any) => pushDedup(e));
}

async function loadAllTimeline() {
  if (!store.bots || store.bots.length === 0) await loadBots();
  store.items = [];
  const perBot = Math.max(10, Math.floor(300 / Math.max(1, store.bots.length)));
  await Promise.all(
    store.bots.map(async (b: any) => {
      const res = await fetch(`/api/bots/${encodeURIComponent(b.name)}/events?limit=${perBot}`);
      const data = await res.json();
      const events = data.events || [];
      events.forEach((e: any) => store.items.push(e));
    })
  );
}

async function resetActiveBot() {
  if (!store.activeBot) return;
  resetting.value = true;
  try {
    const res = await fetch(`/api/bots/${encodeURIComponent(store.activeBot)}/reset`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('reset_failed');
    setTimeout(() => {
      loadBots();
      loadBotTimeline(store.activeBot);
    }, 1000);
  } finally {
    resetting.value = false;
  }
}

const urlHash = ref('');

const filteredItems = computed(() => {
  // Check if we have a hash filter (format: #msg-{type}-{timestamp}-{tool})
  const hash = urlHash.value.slice(1); // Remove '#'
  if (hash && hash.startsWith('msg-')) {
    // Parse hash: msg-{type}-{timestamp}-{tool}
    const parts = hash.split('-');
    if (parts.length >= 3) {
      const type = parts[1];
      const timestamp = parseInt(parts[2], 10);
      const toolFromHash = parts.length > 3 ? parts.slice(3).join('-') : '';

      // Find the message matching timestamp and type
      const found = store.items.find((e: any) => {
        const matchType = String(e?.type || '') === type;
        const matchTs = e?.ts === timestamp;
        const eventTool = String(e?.payload?.tool_name || '').replace(/[^a-z0-9]/gi, '_');
        const matchTool = !toolFromHash || eventTool === toolFromHash;
        return matchType && matchTs && matchTool;
      });
      return found ? [found] : [];
    }
  }

  // Normal filtering (no hash)
  const active = store.activeBot;
  const activeBot = store.bots.find((b: any) => b.name === active);
  const activeBotId = activeBot?.id;

  const prelim = store.items
    .filter((e: any) => store.viewMode === 'all' || e.bot_id === activeBotId)
    .filter(
      (e: any) =>
        !(
          e.type === 'tool' &&
          /^(craftscript_step|craftscript_status|craftscript_cancel|craftscript_trace)$/i.test(
            String(e?.payload?.tool_name || '')
          )
        )
    )
    .filter(
      (e: any) =>
        !(e.type === 'tool' && /send_chat/i.test(String(e?.payload?.tool_name || '')))
    );

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
        if (seenJobs.has(id)) continue;
        seenJobs.add(id);
      }
    }
    result.push(e);
  }
  return result.reverse();
});

function connectWebSocket() {
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
  // Set initial hash value (important for page load with hash)
  urlHash.value = window.location.hash;

  await loadBots();
  if (store.activeBot && store.viewMode === 'single') await loadBotTimeline(store.activeBot);
  else await loadAllTimeline();
  connectWebSocket();
  loadBlueprints();
  loadIssues();

  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    urlHash.value = window.location.hash;
  });
});

watch(
  () => issuesModalOpen.value,
  (open) => {
    if (open) loadIssues();
  }
);

watch(() => store.activeBot, () => {
  loadIssues();
});

async function loadBlueprints() {
  try {
    const res = await fetch('/api/blueprints');
    blueprints.value = await res.json();
  } catch {}
}

async function viewBlueprint(name: string) {
  try {
    const res = await fetch(`/api/blueprints/${encodeURIComponent(name)}`);
    const data = await res.json();
    bpDetail.value = data;
    bpDetailName.value = name;
    bpDetailOpen.value = true;
  } catch {}
}

async function handleRemoveBlueprint(name: string) {
  const res = await fetch(`/api/blueprints/${encodeURIComponent(name)}`, { method: 'DELETE' });
  if (res.ok) loadBlueprints();
}

async function handleCreateBlueprint(payload: any) {
  try {
    const res = await fetch('/api/blueprints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('create_failed');
    loadBlueprints();
  } catch {
    alert('Failed to create blueprint');
  }
}

function openIssuesModal() {
  issuesModalOpen.value = true;
  loadIssues();
}
</script>

<style scoped>
.app-layout {
  height: 100vh;
}

.sidebar {
  height: 100vh;
}

.sidebar-content {
  padding: 20px;
}

.sidebar-header {
  margin: 0 0 16px 0;
}

.bot-card {
  cursor: pointer;
  transition: all 0.2s;
}

.bot-card-active {
  border-color: var(--n-border-color-primary);
}

.header {
  padding: 16px 24px;
}
</style>
