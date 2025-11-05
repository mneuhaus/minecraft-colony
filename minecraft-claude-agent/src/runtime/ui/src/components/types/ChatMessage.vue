<template>
  <div class="tl-item__body">
    <strong v-if="item.type==='chat-in'">{{ item.payload?.from || 'player' }}:</strong>
    <span v-html="safeText"></span>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ item: any }>();
function escapeHtml(s: string){ return String(s).replace(/[&<>\"]/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[m])); }
const safeText = escapeHtml(props.item.payload?.text || '');
</script>

