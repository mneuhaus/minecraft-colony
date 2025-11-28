<template>
  <div class="context-section" v-if="contextStats">
    <n-space justify="space-between" align="center" style="margin-bottom: 8px;">
      <n-text strong style="font-size: 13px;">Context</n-text>
      <n-text depth="3" style="font-size: 11px;">
        {{ formatBytes(contextStats.currentBytes) }} / {{ formatBytes(contextStats.maxBytes) }}
      </n-text>
    </n-space>
    <n-progress
      type="line"
      :percentage="contextStats.percentage"
      :color="getContextColor(contextStats.percentage)"
      :show-indicator="false"
      :height="6"
    />
    <n-text depth="3" style="font-size: 11px; margin-top: 4px; display: block;">
      {{ contextStats.messageCount }} messages · {{ contextStats.percentage }}% used
    </n-text>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, inject } from 'vue';
import { NSpace, NText, NProgress } from 'naive-ui';

interface ContextStats {
  currentBytes: number;
  maxBytes: number;
  messageCount: number;
  percentage: number;
}

const store = inject<any>('store');
const activeBot = computed(() => store.activeBot);
const contextStats = ref<ContextStats | null>(null);
let pollInterval: ReturnType<typeof setInterval> | null = null;

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

const getContextColor = (percentage: number): string => {
  if (percentage < 50) return '#18a058'; // green
  if (percentage < 75) return '#f0a020'; // yellow
  return '#d03050'; // red
};

const fetchContextStats = async () => {
  if (!activeBot.value) {
    contextStats.value = null;
    return;
  }

  try {
    const res = await fetch(`/api/bots/${encodeURIComponent(activeBot.value)}/context`);
    if (res.ok) {
      const data = await res.json();
      if (data.ok) {
        contextStats.value = {
          currentBytes: data.currentBytes,
          maxBytes: data.maxBytes,
          messageCount: data.messageCount,
          percentage: data.percentage
        };
      }
    }
  } catch (e) {
    // Silently ignore errors
  }
};

onMounted(() => {
  fetchContextStats();
  pollInterval = setInterval(fetchContextStats, 5000); // Poll every 5 seconds
});

watch(activeBot, () => fetchContextStats());
</script>

<style scoped>
.context-section {
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  margin-top: 12px;
}
</style>
