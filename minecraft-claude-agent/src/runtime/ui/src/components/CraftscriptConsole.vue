<template>
  <div class="console">
    <div v-if="!orderedLogs.length" class="console-empty">
      No console output available.
    </div>
    <div v-else class="console-entries">
      <div
        v-for="(entry, idx) in orderedLogs"
        :key="`${entry.ts}-${idx}`"
        class="console-entry"
        :class="`console-entry--${entry.level}`"
      >
        <div class="console-entry__header">
          <span class="console-entry__icon">{{ getLevelIcon(entry.level) }}</span>
          <span class="console-entry__time">{{ formatTime(entry.ts) }}</span>
          <span class="console-entry__level">{{ entry.level.toUpperCase() }}</span>
          <span class="console-entry__message">{{ entry.message }}</span>
        </div>
        <div v-if="entry.details" class="console-entry__details">
          <button
            class="console-entry__toggle"
            @click="toggleExpand(idx)"
            :aria-expanded="expanded.has(idx)"
          >
            {{ expanded.has(idx) ? '▼' : '▶' }} Details
          </button>
          <div v-show="expanded.has(idx)" class="console-entry__content">
            <pre>{{ formatDetails(entry.details) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

interface ConsoleLogEntry {
  ts: number;
  level: string;
  message: string;
  details?: any;
}

const props = defineProps<{
  logs: ConsoleLogEntry[];
}>();

const expanded = ref(new Set<number>());

const orderedLogs = computed(() => {
  return [...props.logs].sort((a, b) => (a.ts || 0) - (b.ts || 0));
});

function formatTime(ts: number): string {
  if (!ts) return '';
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
}

function getLevelIcon(level: string): string {
  const iconMap: Record<string, string> = {
    info: 'ℹ️',
    success: '✓',
    warn: '⚠️',
    error: '✗',
  };
  return iconMap[level] || 'ℹ️';
}

function formatDetails(details: any): string {
  if (!details) return '';

  // Format position objects nicely
  const formatted = JSON.stringify(details, (key, value) => {
    if (value && typeof value === 'object') {
      // Format Vec3-like objects
      if ('x' in value && 'y' in value && 'z' in value && Object.keys(value).length === 3) {
        return `(${value.x}, ${value.y}, ${value.z})`;
      }
    }
    return value;
  }, 2);

  return formatted;
}

function toggleExpand(idx: number) {
  if (expanded.value.has(idx)) {
    expanded.value.delete(idx);
  } else {
    expanded.value.add(idx);
  }
}
</script>

<style scoped>
.console {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  background: #0f1115;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px;
  max-height: 600px;
  overflow-y: auto;
}

.console-empty {
  text-align: center;
  padding: 40px;
  opacity: 0.5;
}

.console-entries {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.console-entry {
  padding: 8px;
  border-radius: 4px;
  border-left: 3px solid transparent;
  background: rgba(255, 255, 255, 0.02);
}

.console-entry--info {
  border-left-color: #60a5fa;
}

.console-entry--success {
  border-left-color: #34d399;
}

.console-entry--warn {
  border-left-color: #fbbf24;
}

.console-entry--error {
  border-left-color: #f87171;
  background: rgba(248, 113, 113, 0.05);
}

.console-entry__header {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.console-entry__icon {
  flex-shrink: 0;
  font-size: 14px;
}

.console-entry__time {
  flex-shrink: 0;
  opacity: 0.6;
  font-size: 11px;
}

.console-entry__level {
  flex-shrink: 0;
  font-weight: 600;
  font-size: 11px;
  opacity: 0.8;
  min-width: 60px;
}

.console-entry--info .console-entry__level {
  color: #60a5fa;
}

.console-entry--success .console-entry__level {
  color: #34d399;
}

.console-entry--warn .console-entry__level {
  color: #fbbf24;
}

.console-entry--error .console-entry__level {
  color: #f87171;
}

.console-entry__message {
  flex: 1;
  line-height: 1.5;
}

.console-entry__details {
  margin-top: 8px;
  margin-left: 28px;
}

.console-entry__toggle {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  color: inherit;
  font-family: inherit;
  transition: background 0.15s;
}

.console-entry__toggle:hover {
  background: rgba(255, 255, 255, 0.12);
}

.console-entry__content {
  margin-top: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  max-height: 300px;
  overflow: auto;
}

.console-entry__content pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
