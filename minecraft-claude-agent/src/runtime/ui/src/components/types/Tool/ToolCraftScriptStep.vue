<template>
  <MessageBlock
    eyebrow="CraftScript Step"
    :title="result.op || 'step'"
    :tone="result.ok ? 'success' : 'danger'"
    padding="sm"
  >
    <template #meta>
      <span class="duration-chip">{{ result.ms }} ms</span>
    </template>

    <div class="step-body">
      <div class="step-icon" :class="{ success: result.ok, failed: !result.ok }">
        {{ result.ok ? '✓' : '✗' }}
      </div>

      <div class="step-content">
        <div v-if="result.ok && result.notes" class="step-notes">
          <div v-for="(value, key) in result.notes" :key="key" class="note-item">
            <span class="note-key">{{ key }}:</span>
            <span class="note-value">{{ formatValue(value) }}</span>
          </div>
        </div>

        <div v-else-if="!result.ok" class="step-error">
          <div class="error-type">{{ result.error }}</div>
          <div v-if="result.message" class="error-message">{{ result.message }}</div>
          <div v-if="result.loc" class="error-location">
            at line {{ result.loc.line }}, column {{ result.loc.column }}
          </div>
        </div>
      </div>
    </div>
  </MessageBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MessageBlock from '../../MessageBlock.vue';

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
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}
</script>

<style scoped>
.duration-chip {
  font-size: var(--font-xs);
  color: var(--color-text-muted);
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
}

.step-body {
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-start;
}

.step-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
}

.step-icon.success {
  background: rgba(52, 211, 153, 0.2);
  border-color: rgba(52, 211, 153, 0.4);
  color: var(--color-success);
}

.step-icon.failed {
  background: rgba(248, 113, 113, 0.2);
  border-color: rgba(248, 113, 113, 0.4);
  color: var(--color-danger);
}

.step-content {
  flex: 1;
  min-width: 0;
  font-size: var(--font-sm);
}

.step-notes {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
}

.note-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--spacing-sm);
}

.note-key {
  color: var(--color-text-muted);
  font-weight: 500;
  text-transform: capitalize;
}

.note-value {
  color: var(--color-text-primary);
  font-family: 'Courier New', monospace;
}

.step-error {
  padding: var(--spacing-sm);
  background: rgba(248, 113, 113, 0.1);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(248, 113, 113, 0.4);
}

.error-type {
  color: var(--color-danger);
  font-weight: 600;
  margin-bottom: 4px;
}

.error-message {
  color: #fca5a5;
  margin-bottom: 4px;
}

.error-location {
  color: var(--color-text-muted);
  font-size: var(--font-xs);
}
</style>
