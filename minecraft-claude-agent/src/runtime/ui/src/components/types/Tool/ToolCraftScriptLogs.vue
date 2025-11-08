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
.tool-cslogs {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  color: #EAEAEA;
  font-size: 13px;
}

.tool-icon {
  font-size: 16px;
}

.tool-name {
  flex: 1;
}

.trace-btn {
  background: linear-gradient(135deg, #00d9ff 0%, #0099cc 100%);
  color: #000;
  border: none;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 217, 255, 0.2);
}

.trace-btn:hover {
  background: linear-gradient(135deg, #00b8d4 0%, #007799 100%);
  box-shadow: 0 3px 6px rgba(0, 217, 255, 0.3);
  transform: translateY(-1px);
}

.trace-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 217, 255, 0.2);
}

.log-status {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.status-completed {
  background: rgba(74, 222, 128, 0.15);
  color: #4ADE80;
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.status-failed {
  background: rgba(248, 113, 113, 0.15);
  color: #F87171;
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.status-running {
  background: rgba(96, 165, 250, 0.15);
  color: #60A5FA;
  border: 1px solid rgba(96, 165, 250, 0.3);
}

.status-canceled {
  background: rgba(161, 161, 170, 0.15);
  color: #A1A1AA;
  border: 1px solid rgba(161, 161, 170, 0.3);
}

/* Metadata */
.log-meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 12px;
  margin-bottom: 12px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  border: 1px solid #2E2E2E;
}

.meta-row {
  display: contents;
}

.meta-k {
  color: #B3B3B3;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.meta-v {
  color: #EAEAEA;
  font-size: 12px;
  font-family: 'Monaco', 'Courier New', monospace;
}

/* Error summary */
.log-error {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: 6px;
  margin-bottom: 12px;
}

.error-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.error-content {
  flex: 1;
}

.error-title {
  color: #F87171;
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 4px;
}

.error-message {
  color: #EAEAEA;
  font-size: 11px;
  font-family: 'Monaco', 'Courier New', monospace;
}

/* Log entries */
.log-entries {
  border: 1px solid #2E2E2E;
  border-radius: 6px;
  overflow: hidden;
}

.log-entry {
  border-bottom: 1px solid #2E2E2E;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-entry--ok {
  background: rgba(74, 222, 128, 0.03);
}

.log-entry--fail {
  background: rgba(248, 113, 113, 0.05);
}

.log-entry--trace {
  background: rgba(147, 197, 253, 0.03);
}

.entry-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.entry-icon {
  font-size: 14px;
}

.entry-kind {
  color: #B3B3B3;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.entry-time {
  margin-left: auto;
  color: #7A7A7A;
  font-size: 10px;
  font-family: 'Monaco', 'Courier New', monospace;
}

.entry-body {
  padding: 8px 10px;
}

/* Status entries */
.status-state {
  color: #4A9EFF;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-error {
  color: #F87171;
  font-size: 11px;
  font-family: 'Monaco', 'Courier New', monospace;
  margin-top: 4px;
}

/* Step entries */
.step-command {
  color: #EAEAEA;
  font-size: 12px;
  font-family: 'Monaco', 'Courier New', monospace;
  margin-bottom: 4px;
}

.step-meta {
  display: flex;
  gap: 12px;
  font-size: 10px;
  color: #7A7A7A;
}

.step-duration,
.step-ops {
  font-family: 'Monaco', 'Courier New', monospace;
}

.step-error {
  color: #F87171;
  font-size: 11px;
  font-family: 'Monaco', 'Courier New', monospace;
  margin-top: 4px;
}

/* Trace entries */
.trace-log {
  color: #EAEAEA;
  font-size: 12px;
  font-family: 'Monaco', 'Courier New', monospace;
  line-height: 1.5;
}

.trace-blockinfo {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-family: 'Monaco', 'Courier New', monospace;
}

.bi-label {
  color: #B3B3B3;
}

.bi-block {
  color: #4ADE80;
  font-weight: 600;
}

.bi-pos {
  color: #7A7A7A;
}

.trace-generic,
.entry-unknown {
  color: #B3B3B3;
  font-size: 11px;
  font-family: 'Monaco', 'Courier New', monospace;
}

.log-empty {
  color: #7A7A7A;
  font-size: 12px;
  text-align: center;
  padding: 20px;
}
</style>
