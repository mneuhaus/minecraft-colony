<template>
  <div class="tl-item__body chat-message">
    <div class="chat-message__header">
      <strong class="chat-from">{{ from }}</strong>
    </div>
    <div class="chat-text" v-html="safeText"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ item: any }>();
function escapeHtml(s: string){ return String(s).replace(/[&<>\"]/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[m])); }
const safeText = escapeHtml(props.item.payload?.text || '');
const direction = computed(() => props.item.payload?.direction || 'out');
const from = computed(() => props.item.payload?.from || (direction.value === 'in' ? 'player' : 'bot'));
</script>

<style scoped>
.chat-message__header {
  margin-bottom: 4px;
}
.chat-from {
  color: #EAEAEA;
  font-size: 13px;
}
.chat-text {
  color: #D0D0D0;
  line-height: 1.5;
}
</style>

