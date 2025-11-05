<template>
  <div class="tl-item__body tool-get-position">
    <div class="tool-header">
      <span class="tool-name">Get Position</span>
    </div>
    <div class="position-display">{{ pos }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ item: any }>();
const out = computed(()=> props.item.payload?.output || {});
const pos = computed(()=> out.value && out.value.x!==undefined ? `(${out.value.x}, ${out.value.y}, ${out.value.z})` : 'pos requested');
</script>

<style scoped>
.tool-header {
  font-weight: 600;
  color: #EAEAEA;
  margin-bottom: 8px;
  font-size: 13px;
}
.position-display {
  font-family: 'Monaco', 'Courier New', monospace;
  color: #4A9EFF;
  font-size: 14px;
  font-weight: 500;
}
</style>

