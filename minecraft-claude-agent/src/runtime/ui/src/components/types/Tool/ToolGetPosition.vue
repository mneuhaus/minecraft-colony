<template>
    <div class="position-display">{{ pos }}</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ item: any }>();
const out = computed(()=> props.item.payload?.output || {});
const pos = computed(()=> out.value && out.value.x!==undefined ? `(${out.value.x}, ${out.value.y}, ${out.value.z})` : 'pos requested');
</script>

<style scoped>
.position-display {
  font-family: 'Monaco', 'Courier New', monospace;
  color: var(--color-accent);
  font-size: 15px;
  font-weight: 600;
}
</style>
