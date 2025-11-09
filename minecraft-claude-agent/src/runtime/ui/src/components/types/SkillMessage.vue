<template>
  <div>
    <p v-if="item.payload?.category" class="skill-category">{{ item.payload.category }}</p>
    <p class="skill-description" v-if="item.payload?.description">
      {{ item.payload.description }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ item: any }>();

const name = computed(() => props.item.payload?.name || 'Skill');
</script>

<style scoped>
.skill-description {
  line-height: 1.6;
  opacity: 0.9;
}
</style>
