<template>
  <div class="tl-item__body tool-cslogs">
    <div class="tool-header">
      <span class="tool-icon">📋</span>
      <span class="tool-name">CraftScript Logs</span>
      <span class="log-status" :class="statusClass">{{ statusBadge }}</span>
      <button class="trace-btn" @click="viewTrace" title="View 3D block changes and movement">
        🔍 View Trace
      </button>
    </div>

    <div class="log-meta">
      <div class="meta-row">
        <span class="meta-k">Job ID</span>
        <span class="meta-v">{{ jobId }}</span>
      </div>
      <div class="meta-row" v-if="status">
        <span class="meta-k">Status</span>
        <span class="meta-v" :class="`status-${status}`">{{ status }}</span>
      </div>
      <div class="meta-row" v-if="logCount > 0">
        <span class="meta-k">Entries</span>
        <span class="meta-v">{{ logCount }}</span>
      </div>
    </div>

    <!-- Error summary -->
    <div class="log-error" v-if="error">
      <span class="error-icon">⚠️</span>
      <div class="error-content">
        <div class="error-title">Execution Failed</div>
        <div class="error-message">{{ error }}</div>
      </div>
    </div>

    <!-- Log entries -->
    <div class="log-entries" v-if="logs && logs.length">
      <div
        class="log-entry"
        v-for="(entry, i) in logs"
        :key="i"
        :class="`log-entry--${entry.kind}`"
      >
        <div class="entry-header">
          <span class="entry-icon">{{ getIcon(entry.kind) }}</span>
          <span class="entry-kind">{{ entry.kind }}</span>
          <span class="entry-time">{{ formatTime(entry.ts) }}</span>
        </div>

        <div class="entry-body">
          <!-- Status entries -->
          <div v-if="entry.kind === 'status'" class="entry-status">
            <div v-if="entry.data?.state" class="status-state">{{ entry.data.state }}</div>
            <div v-if="entry.data?.error" class="status-error">{{ entry.data.error }}</div>
          </div>

          <!-- Step entries (ok/fail) -->
          <div v-else-if="entry.kind === 'ok' || entry.kind === 'fail'" class="entry-step">
            <div class="step-command" v-if="entry.data?.cmd">{{ entry.data.cmd }}</div>
            <div class="step-meta">
              <span v-if="entry.data?.ms" class="step-duration">{{ entry.data.ms }}ms</span>
              <span v-if="entry.data?.ops" class="step-ops">{{ entry.data.ops }} ops</span>
            </div>
            <div v-if="entry.data?.error" class="step-error">{{ entry.data.error }}</div>
          </div>

          <!-- Trace entries (log, block_info, etc) -->
          <div v-else-if="entry.kind === 'trace'" class="entry-trace">
            <div v-if="entry.data?.cmd === 'log'" class="trace-log">
              {{ formatLogArgs(entry.data?.args) }}
            </div>
            <div v-else-if="entry.data?.cmd === 'block_info'" class="trace-blockinfo">
              <span class="bi-label">block_info:</span>
              <span class="bi-block">{{ entry.data?.block || '?' }}</span>
              <span v-if="entry.data?.position" class="bi-pos">
                @ {{ entry.data.position.x }}, {{ entry.data.position.y }}, {{ entry.data.position.z }}
              </span>
            </div>
            <div v-else class="trace-generic">
              {{ JSON.stringify(entry.data) }}
            </div>
          </div>

          <!-- Fallback for unknown kinds -->
          <div v-else class="entry-unknown">
            {{ JSON.stringify(entry.data) }}
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!error" class="log-empty">
      No log entries found for this job
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MessageBlock from '../../MessageBlock.vue';

const props = defineProps<{ item: any }>();

const raw = computed(() => {
  const o = props.item?.payload?.output;
  if (typeof o === 'string') {
    try { return JSON.parse(o); } catch { return {}; }
  }
  return o ?? {};
});

const jobId = computed(() => raw.value?.job_id || '?');
const status = computed(() => raw.value?.status);
const error = computed(() => raw.value?.error);
const logs = computed(() => Array.isArray(raw.value?.logs) ? raw.value.logs : []);
const logCount = computed(() => logs.value.length);

const statusClass = computed(() => {
  const s = status.value;
  if (s === 'completed') return 'status-completed';
  if (s === 'failed') return 'status-failed';
  if (s === 'running') return 'status-running';
  if (s === 'canceled') return 'status-canceled';
  return '';
});

const statusBadge = computed(() => {
  const s = status.value;
  if (s === 'completed') return '✓ COMPLETED';
  if (s === 'failed') return '✗ FAILED';
  if (s === 'running') return '⟳ RUNNING';
  if (s === 'canceled') return '⊘ CANCELED';
  return '';
});

function getIcon(kind: string): string {
  if (kind === 'status') return '📊';
  if (kind === 'ok') return '✓';
  if (kind === 'fail') return '✗';
  if (kind === 'trace') return '💬';
  return '•';
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
}

function formatLogArgs(args: any[]): string {
  if (!Array.isArray(args)) return String(args);
  return args.map(a => {
    if (typeof a === 'string') return a;
    if (typeof a === 'number') return String(a);
    if (typeof a === 'boolean') return String(a);
    return JSON.stringify(a);
  }).join(' ');
}

async function viewTrace() {
  const job = jobId.value;
  if (!job || job === '?') return;

  // Extract bot name from the item (assuming it's available in the payload or context)
  const botName = props.item?.bot_name || props.item?.payload?.bot_name || 'bot';

  try {
    // Call the bot's API to execute craftscript_trace tool
    const response = await fetch(`/api/bots/${encodeURIComponent(botName)}/trace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: job })
    });

    if (!response.ok) {
      console.error('Failed to fetch trace:', await response.text());
    }
  } catch (error) {
    console.error('Error fetching trace:', error);
  }
}
</script>

<style scoped>
.log-status {
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-xs);
  font-weight: 600;
  border: 1px solid var(--color-border-subtle);
}
.status-completed { color: var(--color-success); border-color: rgba(52,211,153,0.4); }
.status-failed { color: var(--color-danger); border-color: rgba(248,113,113,0.4); }
.status-running { color: var(--color-accent); border-color: rgba(74,158,255,0.4); }
.status-canceled { color: var(--color-text-muted); }
.trace-btn {
  background: var(--color-accent-soft);
  border: 1px solid rgba(74,158,255,0.4);
  color: var(--color-accent);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  font-size: var(--font-sm);
}

.log-meta {
  display: flex;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
  font-size: var(--font-sm);
}
.meta-row { display: flex; flex-direction: column; gap: 2px; }
.meta-k {
  text-transform: uppercase;
  font-size: var(--font-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.5px;
}
.meta-v {
  font-weight: 600;
  color: var(--color-text-primary);
}

.log-error {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  border: 1px solid rgba(248,113,113,0.4);
  background: rgba(248,113,113,0.12);
  margin-bottom: var(--spacing-md);
}
.error-title { font-weight: 600; color: var(--color-danger); }

.log-entries {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.log-entry {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: rgba(17,17,17,0.4);
}
.log-entry--status { border-color: rgba(74,158,255,0.3); }
.log-entry--ok { border-color: rgba(52,211,153,0.3); }
.log-entry--fail { border-color: rgba(248,113,113,0.3); }

.entry-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-sm);
}
.entry-icon { font-size: 14px; }
.entry-kind {
  font-weight: 600;
  color: var(--color-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.entry-time {
  margin-left: auto;
  font-size: var(--font-xs);
  color: var(--color-text-muted);
  font-family: 'Courier New', monospace;
}

.entry-body { font-size: var(--font-sm); line-height: 1.4; }
.entry-status .status-state { font-weight: 600; color: var(--color-accent); }
.entry-status .status-error { color: var(--color-danger); }
.step-command { font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px; }
.step-meta { display: flex; gap: var(--spacing-sm); color: var(--color-text-muted); font-size: var(--font-xs); }
.step-error { color: var(--color-danger); margin-top: 4px; }
.entry-trace { font-family: 'Courier New', monospace; font-size: var(--font-sm); }
.log-empty { color: var(--color-text-muted); font-style: italic; margin-top: var(--spacing-sm); }
</style>
