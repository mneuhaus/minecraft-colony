<template>
  <div class="tl-item__body">
    <div class="tl-alert" :class="levelClass">
      <div class="tl-alert__content">
        <div class="tl-alert__title">System</div>
        <div class="tl-alert__msg">{{ item.payload?.message || '' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ item: any }>();
const lvl = String(props.item.payload?.level || '').toLowerCase();
const levelClass = computed(()=> ({ 'tl-alert--ok': !lvl || lvl==='info', 'tl-alert--warn': lvl==='warn', 'tl-alert--fail': lvl==='error' }));
</script>

<style scoped>
.tl-alert { border: 1px solid #2E2E2E; border-radius: 10px; padding: 10px; background: #202020; }
.tl-alert--warn { border-color: #5E4A1A; }
.tl-alert--fail { border-color: #5A2A2A; }
.tl-alert--ok { border-color: #2E2E2E; }
</style>

