<template>
  <div class="timeline">
    <div class="timeline__list">
      <TimelineItem v-for="it in items" :key="it.id || (it.type+'-'+it.ts)" :item="normalize(it)" @openInspector="$emit('openInspector', $event)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import TimelineItem from './TimelineItem.vue';
const props = defineProps<{ items: any[] }>();
function normalize(e: any){ return e; }
</script>

<style scoped>
.timeline { height: 100vh; overflow: auto; padding: 10px; }
.timeline__list { display: flex; flex-direction: column; }
</style>

