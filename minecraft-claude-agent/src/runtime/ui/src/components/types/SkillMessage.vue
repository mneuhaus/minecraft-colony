<template>
  <div class="tl-item__body">
    <div class="tl-kv">
      <span class="tl-kv__key">Skill</span>
      <span class="tl-kv__val">{{ item.payload?.name || 'Skill' }}</span>
    </div>
    <div v-if="item.payload?.description">{{ item.payload.description }}</div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ item: any }>();
</script>

