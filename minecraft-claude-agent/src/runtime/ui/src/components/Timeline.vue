<template>
  <div class="timeline">
    <div class="timeline__list">
      <TimelineItem v-for="it in reversedItems" :key="it.id || (it.type+'-'+it.ts)" :item="normalize(it)" @openInspector="$emit('openInspector', $event)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import TimelineItem from './TimelineItem.vue';
const props = defineProps<{ items: any[] }>();
function normalize(e: any){ return e; }
const reversedItems = computed(() => [...props.items].reverse());
</script>

<style scoped>
.timeline { height: 100vh; overflow: auto; padding: 10px; }
.timeline__list { display: flex; flex-direction: column; }
</style>

