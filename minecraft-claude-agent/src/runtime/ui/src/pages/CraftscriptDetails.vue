<template>
  <div class="craftscript-page">
    <n-card v-if="snapshot.jobId" class="cs-detail">
      <div class="cs-summary">
        <n-tag :type="statusTagType" size="small">{{ statusLabel }}</n-tag>
        <span class="cs-summary__job">Job {{ snapshot.jobId }}</span>
        <span v-if="latestStatus?.duration_ms" class="cs-summary__meta">{{ formatDuration(latestStatus.duration_ms) }}</span>
        <span v-if="latestStatus?.error" class="cs-summary__error">
          {{ latestStatus.error?.message || latestStatus.error?.type }}
        </span>
        <span v-if="remoteLoading" class="cs-summary__meta">Syncing detailed logs…</span>
        <span v-else-if="remoteError" class="cs-summary__meta cs-summary__meta--warn">{{ remoteError }}</span>
      </div>

      <n-tabs type="line" size="large">
        <n-tab-pane name="script" tab="Script">
          <pre class="cs-code" v-html="highlightedScript"></pre>
        </n-tab-pane>
        <n-tab-pane name="logs" tab="Logs" v-if="snapshot.logs.length">
          <div class="cs-list">
            <div v-for="log in orderedLogs" :key="log.ts + log.kind" class="cs-list__item">
              <span class="cs-list__time">{{ formatTs(log.ts) }}</span>
              <span class="cs-list__label">{{ log.kind }}</span>
              <span class="cs-list__body">{{ summarizeLog(log.data) }}</span>
            </div>
          </div>
        </n-tab-pane>
        <n-tab-pane name="steps" tab="Steps" v-if="snapshot.steps.length">
          <div class="cs-list">
            <div v-for="step in orderedSteps" :key="step.ts + step.summary" class="cs-list__item" :class="{ 'is-error': !step.ok }">
              <span class="cs-list__time">{{ formatTs(step.ts) }}</span>
              <span class="cs-list__label">{{ step.ok ? 'OK' : 'FAIL' }}</span>
              <span class="cs-list__body">{{ step.summary }}</span>
            </div>
          </div>
        </n-tab-pane>
        <n-tab-pane name="trace" tab="Trace">
          <ToolCraftScriptTrace v-if="traceItem" :item="traceItem" />
          <CraftscriptMovementPanel
            v-else-if="movementVoxEntries.length"
            :entries="movementVoxEntries"
          />
          <div v-else class="cs-empty">No trace data available for this job.</div>
        </n-tab-pane>
        <n-tab-pane name="vox" tab="Vox" v-if="snapshot.voxWindows.length">
          <div class="vox-list">
            <div v-for="vox in snapshot.voxWindows" :key="`${vox.ts}-${vox.label || ''}-${vox.source || ''}`" class="vox-entry">
              <div class="vox-entry__meta">
                <span>{{ formatTs(vox.ts) }}</span>
                <span v-if="vox.label" class="vox-entry__label">{{ vox.label }}</span>
                <span v-if="vox.source" class="vox-entry__source">{{ vox.source }}</span>
                <span v-if="vox.target" class="vox-entry__target">target {{ targetLabel(vox.target) }}</span>
              </div>
              <Vox3DViewer :vox="vox.vox" :target="vox.target" />
              <VoxPreview :vox="vox.vox" :target="vox.target" />
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
    </n-card>

    <n-card v-else>
      <div class="cs-empty">
        <p v-if="remoteLoading">Loading CraftScript data...</p>
        <p v-else-if="remoteError">Error: {{ remoteError }}</p>
        <p v-else>No CraftScript data available for job {{ jobId }}</p>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { NCard, NTabs, NTabPane, NTag } from 'naive-ui';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import ToolCraftScriptTrace from '../components/types/Tool/ToolCraftScriptTrace.vue';
import VoxPreview from '../components/VoxPreview.vue';
import Vox3DViewer from '../components/Vox3DViewer.vue';
import CraftscriptMovementPanel from '../components/CraftscriptMovementPanel.vue';
import { collectCraftscriptSnapshot, type CraftscriptSnapshot } from '../utils/craftscriptJob';

hljs.registerLanguage('javascript', javascript);

const props = defineProps<{ jobId?: string | null }>();
const route = useRoute();
const store = inject<any>('store');

const jobId = computed(() => {
  if (props.jobId) return String(props.jobId);
  const param = route.params.jobId;
  if (Array.isArray(param)) return String(param[0] || '');
  return String(param || '');
});

// Local snapshot from timeline (real-time updates)
const localSnapshot = computed(() => {
  if (!jobId.value || !store) {
    return collectCraftscriptSnapshot([], null);
  }
  return collectCraftscriptSnapshot(store.items || [], jobId.value);
});

// Remote snapshot from API (persisted data)
const remoteSnapshot = ref<CraftscriptSnapshot | null>(null);
const remoteLoading = ref(false);
const remoteError = ref<string | null>(null);

// Merged snapshot (combines both sources)
const snapshot = computed(() => mergeSnapshots(localSnapshot.value, remoteSnapshot.value));

async function loadRemoteSnapshot() {
  if (!jobId.value) return;

  remoteLoading.value = true;
  remoteError.value = null;

  try {
    const res = await fetch(`/api/craftscript/${encodeURIComponent(jobId.value)}/logs`);
    if (!res.ok) {
      remoteSnapshot.value = null;
      remoteError.value = await res.text();
    } else {
      remoteSnapshot.value = await res.json();
    }
  } catch (error: any) {
    remoteSnapshot.value = null;
    remoteError.value = error?.message || String(error);
  } finally {
    remoteLoading.value = false;
  }
}

function mergeSnapshots(primary: CraftscriptSnapshot, secondary: CraftscriptSnapshot | null): CraftscriptSnapshot {
  if (!secondary) return primary;
  return {
    jobId: secondary.jobId || primary.jobId,
    script: secondary.script || primary.script,
    statuses: mergeCollections(primary.statuses, secondary.statuses, (item) => `${item.ts}-${item.state}`),
    steps: mergeCollections(primary.steps, secondary.steps, (item) => `${item.ts}-${item.summary}`),
    traces: mergeCollections(primary.traces, secondary.traces, (item) => `${item.ts}-${item.kind}`),
    voxWindows: mergeCollections(primary.voxWindows, secondary.voxWindows, (item) => `${item.ts}-${JSON.stringify(item.target || {})}`),
    logs: mergeCollections(primary.logs, secondary.logs, (item) => `${item.ts}-${item.kind}`),
  };
}

function mergeCollections<T>(local: T[], remote: T[], keyFn: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of local) {
    map.set(keyFn(item), item);
  }
  for (const item of remote || []) {
    map.set(keyFn(item), item);
  }
  return Array.from(map.values()).sort((a: any, b: any) => (a.ts || 0) - (b.ts || 0));
}

const highlightedScript = computed(() => {
  try {
    return hljs.highlight(snapshot.value.script || '', { language: 'javascript' }).value;
  } catch {
    return snapshot.value.script;
  }
});

const latestStatus = computed(() => {
  if (!snapshot.value.statuses.length) return null;
  return [...snapshot.value.statuses].sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
});

const statusTagType = computed<'success' | 'error' | 'warning' | 'info'>(() => {
  const state = String(latestStatus.value?.state || '').toLowerCase();
  if (state === 'completed') return 'success';
  if (state === 'failed') return 'error';
  if (state === 'running') return 'warning';
  return 'info';
});

const statusLabel = computed(() => latestStatus.value?.state?.toUpperCase() || 'UNKNOWN');

const orderedLogs = computed(() => [...snapshot.value.logs].sort((a, b) => (a.ts || 0) - (b.ts || 0)));
const orderedSteps = computed(() => [...snapshot.value.steps].sort((a, b) => (a.ts || 0) - (b.ts || 0)));

const traceItem = computed(() => {
  const changeEvent = snapshot.value.traces.find((t) => t.data?.changes && t.data.changes.length);
  if (!changeEvent) return null;
  return { payload: { output: JSON.stringify({ job_id: snapshot.value.jobId, ...changeEvent.data }) } };
});

const movementVoxEntries = computed(() =>
  snapshot.value.voxWindows
    .filter((v) => v.vox && (v.source === 'trace' || v.source === 'status'))
    .sort((a, b) => (a.ts || 0) - (b.ts || 0))
);

function formatTs(ts?: number) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString();
}

function formatDuration(ms?: number) {
  if (!ms) return '';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function summarizeLog(entry: any): string {
  if (!entry) return '';
  if (entry.kind === 'trace' && entry.data?.cmd === 'log') {
    return Array.isArray(entry.data.args) ? entry.data.args.join(' ') : String(entry.data.args || '');
  }
  if (entry.kind === 'status' && entry.data?.state) {
    return `status ${entry.data.state}`;
  }
  if (entry.data?.error) {
    return entry.data.error;
  }
  return JSON.stringify(entry);
}

function targetLabel(target: any): string {
  if (!target) return '';
  if (Array.isArray(target) && target.length === 3) return target.join(', ');
  if (typeof target === 'object') {
    return [target.x, target.y, target.z].filter((v) => typeof v === 'number').join(', ');
  }
  return String(target);
}

watch(
  () => jobId.value,
  (newId) => {
    remoteSnapshot.value = null;
    remoteLoading.value = false;
    remoteError.value = null;
    if (newId) {
      loadRemoteSnapshot();
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.craftscript-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.cs-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cs-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 14px;
}

.cs-summary__job {
  font-weight: 600;
}

.cs-summary__meta {
  opacity: 0.7;
}

.cs-summary__meta--warn {
  color: var(--color-warning, #facc15);
}

.cs-summary__error {
  color: var(--color-danger);
}

.cs-code {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px;
  max-height: 500px;
  overflow: auto;
  background: #0f1115;
  font-size: 13px;
}

.cs-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cs-list__item {
  display: grid;
  grid-template-columns: 120px 80px 1fr;
  gap: 8px;
  font-size: 13px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.cs-list__item.is-error {
  border-color: rgba(248, 113, 113, 0.4);
}

.cs-list__time {
  font-family: 'Courier New', monospace;
  opacity: 0.7;
}

.cs-list__label {
  font-weight: 600;
  text-transform: uppercase;
}

.cs-list__body {
  white-space: pre-line;
}

.vox-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.vox-entry {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 8px;
}

.vox-entry__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  margin-bottom: 4px;
}

.vox-entry__label {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.vox-entry__source {
  opacity: 0.65;
  font-size: 12px;
}

.vox-entry__target {
  opacity: 0.75;
}

.cs-empty {
  text-align: center;
  padding: 40px;
  opacity: 0.7;
}
</style>
