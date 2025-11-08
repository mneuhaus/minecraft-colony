<template>
  <MessageBlock
    eyebrow="System"
    title="Notification"
    :tone="tone"
  >
    <p class="system-text">{{ message }}</p>
  </MessageBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MessageBlock from '../MessageBlock.vue';

const props = defineProps<{ item: any }>();

const level = computed(() => String(props.item.payload?.level || '').toLowerCase());

const tone = computed(() => {
  if (level.value === 'warn') return 'warning';
  if (level.value === 'error') return 'danger';
  return 'info';
});

const message = computed(() => props.item.payload?.message || '');
</script>

<style scoped>
.system-text {
  color: var(--color-text-secondary);
  font-size: var(--font-md);
  line-height: 1.5;
}
</style>
