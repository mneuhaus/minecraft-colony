<template>
  <div class="ascii-view">
    <div class="ascii-header">
      <span class="ascii-icon">🗺️</span>
      <span class="ascii-title">ASCII Map</span>
      <span v-if="radius" class="ascii-radius">radius: {{ radius }}</span>
    </div>
    <pre class="ascii-map">{{ asciiContent }}</pre>
    <div class="ascii-legend">
      <span class="legend-item"><span class="legend-char">@</span> Bot</span>
      <span class="legend-item"><span class="legend-char">█</span> Stone</span>
      <span class="legend-item"><span class="legend-char">▓</span> Dirt</span>
      <span class="legend-item"><span class="legend-char">▒</span> Grass</span>
      <span class="legend-item"><span class="legend-char">≈</span> Water</span>
      <span class="legend-item"><span class="legend-char">║</span> Wood</span>
      <span class="legend-item"><span class="legend-char">░</span> Leaves</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ item: any }>();
const payload = computed(() => props.item.payload || {});

const radius = computed(() => {
  return payload.value.params_summary?.radius || payload.value.input?.radius || null;
});

const asciiContent = computed(() => {
  // Output can be string directly or in output field
  let content = payload.value.output;
  if (typeof content === 'object' && content?.content) {
    // MCP format: { content: [{ type: 'text', text: '...' }] }
    const textBlock = content.content?.find?.((c: any) => c.type === 'text');
    if (textBlock) content = textBlock.text;
  }
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (parsed.content?.[0]?.text) return parsed.content[0].text;
    } catch {}
    return content;
  }
  return 'No ASCII view available';
});
</script>

<style scoped>
.ascii-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ascii-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.ascii-icon {
  font-size: 16px;
}

.ascii-title {
  font-weight: 600;
}

.ascii-radius {
  opacity: 0.65;
  font-size: 12px;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.ascii-map {
  margin: 0;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.2;
  overflow-x: auto;
  white-space: pre;
  color: #a8d8a8;
}

.ascii-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  opacity: 0.7;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-char {
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  color: #a8d8a8;
  width: 16px;
  text-align: center;
}
</style>
