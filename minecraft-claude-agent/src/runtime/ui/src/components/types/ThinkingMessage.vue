<template>
  <div class="thinking-message">
    <div class="thinking-header">
      <n-icon size="18" color="#9b59b6">
        <BulbOutline />
      </n-icon>
      <span class="thinking-label">Chain of Thought</span>
    </div>
    <div class="thinking-content">
      {{ content }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NIcon } from 'naive-ui';
import { BulbOutline } from '@vicons/ionicons5';

const props = defineProps<{ item: any }>();

const content = computed(() => {
  const msg = props.item.message || props.item.payload?.message || '';
  return msg;
});
</script>

<style scoped>
.thinking-message {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.8;
}

.thinking-label {
  font-size: 13px;
  font-weight: 600;
  color: #9b59b6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.thinking-content {
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.85);
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  padding: 12px;
  background: rgba(155, 89, 182, 0.08);
  border-left: 3px solid #9b59b6;
  border-radius: 4px;
}
</style>
