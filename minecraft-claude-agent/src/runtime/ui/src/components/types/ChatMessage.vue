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

const direction = computed(() => props.item.payload?.direction || 'out');

// Extract player name from message text if present (format: "username: message")
const parsedMessage = computed(() => {
  const rawText = props.item.payload?.text || '';
  const match = rawText.match(/^([^:]+):\s*(.*)$/s);
  if (match) {
    return { username: match[1].trim(), message: match[2] };
  }
  return { username: null, message: rawText };
});

const from = computed(() => {
  // If we extracted a username from the message, use it
  if (parsedMessage.value.username) {
    return parsedMessage.value.username;
  }
  // Otherwise use payload.from or fallback
  return props.item.payload?.from || (direction.value === 'in' ? 'player' : 'bot');
});

const safeText = computed(() => {
  const text = parsedMessage.value.message;
  return escapeHtml(text).replace(/\n/g, '<br>');
});
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

