<template>
  <div class="chat-text" v-html="safeText"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ item: any }>();
function escapeHtml(s: string){ return String(s).replace(/[&<>\"]/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[m])); }

const payload = computed(() => {
  const base = props.item.payload || {};
  if (props.item.payload) {
    return {
      text: base.text ?? '',
      from: base.from ?? null,
      direction: base.direction ?? 'out',
    };
  }
  return {
    text: props.item.text ?? '',
    from: props.item.from ?? null,
    direction: props.item.direction ?? 'out',
  };
});

const direction = computed(() => payload.value.direction || 'out');

// Extract player name from message text if present (format: "username: message")
const parsedMessage = computed(() => {
  const rawText = payload.value.text || '';
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
  return payload.value.from || (direction.value === 'in' ? 'player' : 'bot');
});

const safeText = computed(() => {
  const text = parsedMessage.value.message;
  return escapeHtml(text).replace(/\n/g, '<br>');
});

const directionLabel = computed(() => direction.value === 'in' ? 'Player' : 'Bot');
</script>

<style scoped>
.chat-text {
  line-height: 1.6;
  opacity: 0.9;
}
</style>
