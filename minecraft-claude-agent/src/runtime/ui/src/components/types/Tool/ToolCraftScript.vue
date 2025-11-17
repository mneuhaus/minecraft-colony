<template>
  <div class="cs-card">
    <div class="cs-card__header">
      <div class="cs-card__meta">
        <span class="cs-chip">CraftScript Start</span>
        <span v-if="jobId" class="cs-chip cs-chip--muted">Job {{ jobId }}</span>
      </div>
    </div>
    <pre class="cs-preview">{{ previewText }}</pre>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { deriveJobIdFromEvent, extractScriptFromEvent } from '../../../utils/craftscriptJob';

const props = defineProps<{ item: any }>();

const jobId = computed(() => deriveJobIdFromEvent(props.item));
const script = computed(() => extractScriptFromEvent(props.item));
const previewText = computed(() => {
  const text = script.value || '';
  if (text.length <= 400) return text;
  return `${text.slice(0, 400)}…`;
});
</script>

<style scoped>
.cs-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cs-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.cs-card__meta {
  display: flex;
  gap: 6px;
  align-items: center;
}
.cs-chip {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.cs-chip--muted {
  opacity: 0.7;
}
.cs-preview {
  margin: 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 8px;
  font-size: 13px;
  max-height: 220px;
  overflow: auto;
  background: rgba(0, 0, 0, 0.15);
}
</style>
