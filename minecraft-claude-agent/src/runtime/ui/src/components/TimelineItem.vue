<template>
  <div class="tl-item" :class="cssClass">
    <div class="tl-item__header">
      <div class="tl-item__meta">
        <span class="tl-time">{{ time }}</span>
        <span class="tl-badge tl-badge--job">{{ item.bot_id }}</span>
      </div>
      <div class="tl-item__outcome">{{ (item.outcome||'').toUpperCase() }}</div>
    </div>
    <component :is="componentName" :item="item" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ChatMessage from './types/ChatMessage.vue';
import SystemMessage from './types/SystemMessage.vue';
import SkillMessage from './types/SkillMessage.vue';
import ToolCard from './types/Tool/ToolCard.vue';

const props = defineProps<{ item: any }>();

const time = computed(()=> new Date(props.item.ts || Date.now()).toLocaleTimeString());
const cssClass = computed(()=> {
  let cls = `tl-item--${props.item.type}`;
  if (props.item.type === 'chat' && props.item.payload?.direction) {
    cls += ` tl-item--chat-${props.item.payload.direction}`;
  }
  if (props.item.outcome) {
    cls += ` tl-item--${props.item.outcome}`;
  }
  return cls;
});
const componentName = computed(()=> {
  const t = String(props.item.type||'');
  if (t === 'chat' || t === 'chat-in' || t === 'chat-out') return ChatMessage;
  if (t === 'system') return SystemMessage;
  if (t === 'skill') return SkillMessage;
  if (t === 'tool') return ToolCard;
  return SystemMessage;
});
</script>

<style scoped>
.tl-item { background: #202020; border: 1px solid #2E2E2E; border-radius: 12px; padding: 10px; }
.tl-item__header { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #B3B3B3; margin-bottom: 4px; }
.tl-badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; border: 1px solid #2E2E2E; }
.tl-time { color: #7A7A7A; font-size: 11px; margin-right: 6px; }
.tl-item__outcome { color: #B3B3B3; font-size: 11px; }

/* Chat message colors */
.tl-item--chat-in { border-left: 3px solid #4A9EFF; }
.tl-item--chat-out { border-left: 3px solid #E96D2F; }
</style>

