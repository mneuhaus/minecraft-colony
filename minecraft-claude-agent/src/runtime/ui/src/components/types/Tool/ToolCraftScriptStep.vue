<template>
  <div class="tl-item__body craftscript-step">
    <div class="step-header">
      <div class="step-op">
        <span class="step-icon" :class="{ success: result.ok, failed: !result.ok }">
          {{ result.ok ? '✓' : '✗' }}
        </span>
        <span class="step-name">{{ result.op || 'step' }}</span>
      </div>
      <span class="step-duration">{{ result.ms }}ms</span>
    </div>

    <div v-if="result.ok && result.notes" class="step-notes">
      <div v-for="(value, key) in result.notes" :key="key" class="note-item">
        <span class="note-key">{{ key }}:</span>
        <span class="note-value">{{ formatValue(value) }}</span>
      </div>
    </div>

    <div v-if="!result.ok" class="step-error">
      <div class="error-type">{{ result.error }}</div>
      <div v-if="result.message" class="error-message">{{ result.message }}</div>
      <div v-if="result.loc" class="error-location">
        at line {{ result.loc.line }}, column {{ result.loc.column }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ item: any }>();

const result = computed(() => {
  try {
    const output = props.item.payload?.output;
    if (typeof output === 'string') {
      return JSON.parse(output);
    }
    return output || {};
  } catch {
    return {};
  }
});

function formatValue(value: any): string {
  if (Array.isArray(value)) {
    return `[${value.join(', ')}]`;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
</script>

<style scoped>
.craftscript-step {
  font-size: 12px;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.step-op {
  display: flex;
  align-items: center;
  gap: 6px;
}

.step-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: bold;
}

.step-icon.success {
  background: rgba(52, 211, 153, 0.2);
  color: #34D399;
}

.step-icon.failed {
  background: rgba(248, 113, 113, 0.2);
  color: #F87171;
}

.step-name {
  font-weight: 500;
  color: #E5E7EB;
}

.step-duration {
  color: #9CA3AF;
  font-size: 11px;
}

.step-notes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.note-item {
  display: flex;
  gap: 8px;
}

.note-key {
  color: #9CA3AF;
  font-weight: 500;
  min-width: 60px;
}

.note-value {
  color: #E5E7EB;
  font-family: 'Courier New', monospace;
}

.step-error {
  padding: 8px;
  background: rgba(248, 113, 113, 0.1);
  border-radius: 4px;
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.error-type {
  color: #F87171;
  font-weight: 600;
  margin-bottom: 4px;
}

.error-message {
  color: #FCA5A5;
  margin-bottom: 4px;
}

.error-location {
  color: #9CA3AF;
  font-size: 11px;
}
</style>
