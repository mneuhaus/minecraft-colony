<template>
  <n-modal
    preset="card"
    :show="open"
    :title="modalTitle"
    :style="{ width: '1200px', maxWidth: '95vw', maxHeight: '90vh' }"
    @close="handleClose"
  >
    <div v-if="snapshot.jobId" class="cs-detail">
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
        <n-tab-pane name="trace" tab="Trace" v-if="traceItem">
          <ToolCraftScriptTrace :item="traceItem" />
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
    </div>
    <div v-else class="cs-empty">
      No CraftScript data available.
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { NModal, NTabs, NTabPane, NTag } from 'naive-ui';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import ToolCraftScriptTrace from './types/Tool/ToolCraftScriptTrace.vue';
import VoxPreview from './VoxPreview.vue';
import Vox3DViewer from './Vox3DViewer.vue';
import { collectCraftscriptSnapshot, extractScriptFromEvent, type CraftscriptSnapshot } from '../utils/craftscriptJob';

hljs.registerLanguage('javascript', javascript);

const props = defineProps<{ open: boolean; jobId: string | null; seed?: any }>();
const emit = defineEmits<{ close: [] }>();
const store = inject<any>('store');

const localSnapshot = computed(() => {
  if (!props.open || !props.jobId || !store) {
    return collectCraftscriptSnapshot([], null);
  }
  return collectCraftscriptSnapshot(store.items || [], props.jobId);
});

const remoteSnapshot = ref<CraftscriptSnapshot | null>(null);
const remoteLoading = ref(false);
const remoteError = ref<string | null>(null);

watch(
  () => [props.open, props.jobId, store?.activeBot],
  async ([open, jobId, bot]) => {
    if (!open || !jobId) {
      remoteSnapshot.value = null;
      remoteLoading.value = false;
      remoteError.value = null;
      return;
    }
    remoteLoading.value = true;
    remoteError.value = null;
    try {
      const query = bot ? `?bot=${encodeURIComponent(bot)}` : '';
      const res = await fetch(`/api/craftscript/${encodeURIComponent(jobId)}/logs${query}`);
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
  },
  { immediate: true }
);

const snapshot = computed(() => mergeSnapshots(localSnapshot.value, remoteSnapshot.value));

const modalTitle = computed(() => {
  if (!props.jobId) return 'CraftScript Detail';
  return `CraftScript Job ${props.jobId}`;
});

const scriptContent = computed(() => {
  if (snapshot.value.script) return snapshot.value.script;
  if (props.seed) return extractScriptFromEvent(props.seed);
  return '';
});

const highlightedScript = computed(() => {
  try {
    return hljs.highlight(scriptContent.value || '', { language: 'javascript' }).value;
  } catch {
    return scriptContent.value;
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

function handleClose() {
  emit('close');
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
</script>

<style scoped>
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
  max-height: 420px;
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
