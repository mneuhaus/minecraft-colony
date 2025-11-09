<template>
  <div class="timeline">
    <n-empty v-if="!reversedItems.length" description="No activity yet">
      <template #icon>
        <span style="font-size: 48px;">📭</span>
      </template>
    </n-empty>
    <n-space vertical :size="12" v-else>
      <TimelineItem
        v-for="it in reversedItems"
        :key="it.id || (it.type + '-' + it.ts)"
        :item="normalize(it)"
        @openInspector="$emit('openInspector', $event)"
      />
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import TimelineItem from './TimelineItem.vue';

const props = defineProps<{ items: any[] }>();

function normalize(e: any) {
  return e;
}

const reversedItems = computed(() => [...props.items].reverse());
</script>

<style scoped>
.timeline {
  min-height: 100%;
}
</style>

