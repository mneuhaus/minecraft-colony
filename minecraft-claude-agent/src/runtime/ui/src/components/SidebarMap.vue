<template>
  <n-card size="small" title="Map View" :bordered="false">
    <template #header-extra>
      <n-space :size="8">
        <n-select
          v-model:value="zoomLevel"
          :options="zoomOptions"
          size="small"
          style="width: 80px"
          @update:value="refreshMap"
        />
        <n-checkbox v-model:checked="showHeight" size="small" @update:checked="refreshMap">
          Height
        </n-checkbox>
        <n-button size="small" @click="refreshMap" :loading="loading" quaternary circle>
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
          </template>
        </n-button>
      </n-space>
    </template>

    <div v-if="error" class="error-message">
      <n-text type="error">{{ error }}</n-text>
    </div>

    <div v-else-if="loading && !mapImage" class="loading-container">
      <n-spin size="small" />
      <n-text depth="3">Loading map...</n-text>
    </div>

    <div v-else-if="mapImage" class="map-container">
      <img :src="mapImage" alt="Minecraft Map" class="map-image" />
      <div v-if="mapMetadata" class="map-metadata">
        <n-space :size="4" vertical>
          <n-text depth="3" :size="11">
            Center: {{ mapMetadata.centerX }}, {{ mapMetadata.centerZ }}
          </n-text>
          <n-text depth="3" :size="11">
            Radius: {{ mapMetadata.radius }} blocks
          </n-text>
          <n-text depth="3" :size="11">
            Size: {{ mapMetadata.width }}x{{ mapMetadata.height }}
          </n-text>
        </n-space>
      </div>
    </div>

    <div v-else class="empty-state">
      <n-text depth="3">Click refresh to load map</n-text>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { ref, inject, computed, onMounted, watch } from 'vue';

const store = inject<any>('store');
const activeBot = computed(() => store.activeBot);

const loading = ref(false);
const error = ref<string | null>(null);
const mapImage = ref<string | null>(null);
const mapMetadata = ref<any>(null);
const zoomLevel = ref(0);
const showHeight = ref(true);

const zoomOptions = [
  { label: '1:1', value: 0 },
  { label: '1:2', value: 1 },
  { label: '1:4', value: 2 },
  { label: '1:8', value: 3 },
  { label: '1:16', value: 4 },
];

async function refreshMap() {
  if (!activeBot.value) {
    error.value = 'No active bot';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const response = await fetch('/api/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot: activeBot.value,
        zoom: zoomLevel.value,
        showHeight: showHeight.value,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to load map: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.image) {
      mapImage.value = `data:image/png;base64,${data.image}`;
      mapMetadata.value = data.metadata || null;
    } else {
      throw new Error('No image data received');
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load map';
    console.error('Map loading error:', err);
  } finally {
    loading.value = false;
  }
}

// Auto-refresh when bot changes
watch(activeBot, () => {
  if (activeBot.value && mapImage.value) {
    refreshMap();
  }
});

// Optional: Auto-refresh every 30 seconds
let autoRefreshInterval: any = null;
onMounted(() => {
  // Don't auto-load on mount, let user trigger it
  // But set up auto-refresh if they do load it
  autoRefreshInterval = setInterval(() => {
    if (mapImage.value && !loading.value) {
      refreshMap();
    }
  }, 30000);
});

// Cleanup
import { onUnmounted } from 'vue';
onUnmounted(() => {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
});
</script>

<style scoped>
.map-container {
  position: relative;
  width: 100%;
}

.map-image {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 4px;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}

.map-metadata {
  margin-top: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.loading-container,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  gap: 12px;
}

.error-message {
  padding: 12px;
  text-align: center;
}
</style>
