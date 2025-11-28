<template>
  <div class="tool-screenshot">
    <div v-if="imagePath" class="screenshot-container">
      <img
        :src="`/api/screenshot?path=${encodeURIComponent(imagePath)}`"
        :alt="`Screenshot: ${viewMode} view`"
        class="screenshot-image"
        @error="handleImageError"
      />
      <div class="screenshot-info">
        <span class="info-badge">{{ viewMode }}</span>
        <span class="info-text">{{ dimensions }}</span>
      </div>
    </div>
    <div v-else class="no-screenshot">
      <span>📷 No screenshot available</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ item: any }>();

const payload = computed(() => props.item.payload || {});
const output = computed(() => payload.value.output || '');

// Extract image path from output text
const imagePath = computed(() => {
  const match = output.value.match(/Screenshot saved to: (.+\.png)/);
  return match ? match[1] : null;
});

const params = computed(() => {
  let p = payload.value.params_summary || payload.value.input;
  if (typeof p === 'string') {
    try { p = JSON.parse(p); } catch {}
  }
  return p || {};
});

const viewMode = computed(() => params.value.viewMode || 'topdown');
const width = computed(() => params.value.width || 32);
const height = computed(() => params.value.height || 32);
const dimensions = computed(() => `${width.value}x${height.value} blocks`);

function handleImageError(event: Event) {
  console.error('Failed to load screenshot:', event);
}
</script>

<style scoped>
.tool-screenshot {
  margin: 8px 0;
}

.screenshot-container {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-bg-muted);
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.screenshot-image {
  width: 100%;
  height: auto;
  display: block;
  image-rendering: pixelated; /* Preserve blocky Minecraft style */
  image-rendering: crisp-edges;
}

.screenshot-info {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.info-badge {
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.info-text {
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  border-radius: 20px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.no-screenshot {
  padding: 24px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  background: var(--color-bg-muted);
  border-radius: 12px;
  border: 2px dashed rgba(255, 255, 255, 0.2);
}
</style>
