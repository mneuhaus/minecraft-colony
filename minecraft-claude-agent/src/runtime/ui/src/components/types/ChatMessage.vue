<template>
  <div class="chat-text" v-html="safeText"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ item: any }>();
function escapeHtml(s: string){ return String(s).replace(/[&<>\"]/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[m])); }

// Normalize WebSocket vs history data structure
const normalized = computed(() => {
  if (props.item.payload) return props.item;
  // Live WS chat messages arrive with fields at top-level; wrap into payload for uniformity
  const { from, text, direction } = props.item as any;
  return {
    ...props.item,
    payload: { from, text, direction },
  } as any;
});

const direction = computed(() => normalized.value.payload?.direction || 'out');

// Extract player name from message text if present (format: "username: message")
const parsedMessage = computed(() => {
  const rawText = normalized.value.payload?.text || '';
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
  return normalized.value.payload?.from || (direction.value === 'in' ? 'player' : 'bot');
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
