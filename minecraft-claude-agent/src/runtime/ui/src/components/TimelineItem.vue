<template>
  <div class="tl-item-wrapper" :class="wrapperClass">
    <div class="tl-item" :class="cssClass" @click="$emit('openInspector', item)">
      <div class="tl-item__header">
        <span class="tl-time">{{ time }}</span>
      </div>
      <component :is="componentName" :item="item" />
    </div>
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
const wrapperClass = computed(() => {
  const t = props.item.type;
  if (t === 'chat') {
    const dir = props.item.payload?.direction;
    return dir === 'in' ? 'tl-wrapper--right' : 'tl-wrapper--left';
  }
  if (t === 'system') return 'tl-wrapper--center';
  return 'tl-wrapper--left';
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
/* Wrapper for positioning */
.tl-item-wrapper {
  display: flex;
  width: 100%;
  margin-bottom: 8px;
}

.tl-wrapper--left {
  justify-content: flex-start;
}

.tl-wrapper--right {
  justify-content: flex-end;
}

.tl-wrapper--center {
  justify-content: center;
}

/* Item styling */
.tl-item {
  position: relative;
  background: #202020;
  border: 1px solid #2E2E2E;
  border-radius: 12px;
  padding: 10px 80px 10px 10px;
  max-width: 80%;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.tl-item__body {
  margin: 0;
  padding: 0;
}

.tl-item:hover {
  border-color: #4A4A4A;
}

.tl-wrapper--center .tl-item {
  max-width: 60%;
}

.tl-item__header {
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 11px;
  color: #7A7A7A;
  opacity: 0.7;
}

/* Chat message styling */
.tl-item--chat-in {
  background: linear-gradient(135deg, rgba(74, 158, 255, 0.08) 0%, rgba(74, 158, 255, 0.02) 100%);
  border-color: rgba(74, 158, 255, 0.3);
}
.tl-item--chat-out {
  background: linear-gradient(135deg, rgba(233, 109, 47, 0.08) 0%, rgba(233, 109, 47, 0.02) 100%);
  border-color: rgba(233, 109, 47, 0.3);
}
</style>

