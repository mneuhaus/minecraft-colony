<template>
  <p class="system-text">{{ message }}</p>
</template>

<script setup lang="ts">
import { computed } from 'vue';

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
  line-height: 1.6;
  opacity: 0.9;
}
</style>
