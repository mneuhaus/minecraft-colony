<template>
  <div class="tl-item__body skill-message">
    <div class="skill-header">
      <span class="skill-badge">Skill</span>
      <span class="skill-name">{{ item.payload?.name || 'Skill' }}</span>
    </div>
    <div class="skill-description" v-if="item.payload?.description">
      {{ item.payload.description }}
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ item: any }>();
</script>

<style scoped>
.skill-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.skill-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  color: #B794F4;
  background: rgba(183, 148, 244, 0.15);
  padding: 3px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}
.skill-name {
  font-weight: 500;
  color: #EAEAEA;
  font-size: 13px;
}
.skill-description {
  color: #D0D0D0;
  line-height: 1.5;
  font-size: 13px;
}
</style>

