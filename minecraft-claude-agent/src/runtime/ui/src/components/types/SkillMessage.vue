<template>
  <MessageBlock
    eyebrow="Skill"
    :title="name"
    :subtitle="item.payload?.category"
  >
    <p class="skill-description" v-if="item.payload?.description">
      {{ item.payload.description }}
    </p>
  </MessageBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MessageBlock from '../MessageBlock.vue';

const props = defineProps<{ item: any }>();

const name = computed(() => props.item.payload?.name || 'Skill');
</script>

<style scoped>
.skill-description {
  color: var(--color-text-secondary);
  line-height: 1.5;
  font-size: var(--font-md);
}
</style>
