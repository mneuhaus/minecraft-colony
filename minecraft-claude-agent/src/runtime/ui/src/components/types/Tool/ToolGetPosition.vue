<template>
  <MessageBlock
    eyebrow="Telemetry"
    title="Get Position"
    :tone="out ? 'info' : 'neutral'"
    padding="md"
  >
    <div class="position-display">{{ pos }}</div>
  </MessageBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MessageBlock from '../../MessageBlock.vue';
const props = defineProps<{ item: any }>();
const out = computed(()=> props.item.payload?.output || {});
const pos = computed(()=> out.value && out.value.x!==undefined ? `(${out.value.x}, ${out.value.y}, ${out.value.z})` : 'pos requested');
</script>

<style scoped>
.position-display {
  font-family: 'Monaco', 'Courier New', monospace;
  color: var(--color-accent);
  font-size: var(--font-lg);
  font-weight: 600;
}
</style>
