<template>
  <div class="tl-item-wrapper" :class="wrapperClass">
    <div class="tl-item" :class="cssClass">
      <div class="tl-item__time">{{ time }}</div>
      <component :is="componentName" :item="item" @openInspector="$emit('openInspector', $event)" />
      <div class="tl-meta">
        <small>{{ identityLabel }}</small>
      </div>
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

const identityLabel = computed(() => {
  const type = String(props.item?.type || 'unknown');
  const id = props.item?.id ?? props.item?.payload?.id ?? props.item?.payload?.job_id ?? props.item?.payload?.run_id ?? 'n/a';
  const tool = props.item?.payload?.tool_name ? `, tool: ${props.item.payload.tool_name}` : '';
  return `(${type}, ${id}${tool})`;
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
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  max-width: 80%;
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
}

.tl-item__body { margin: 0; padding: 0; }

.tl-wrapper--center .tl-item {
  max-width: 60%;
}

.tl-item__time {
  font-size: var(--font-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-sm);
}

.tl-meta {
  margin-top: var(--spacing-sm);
  font-size: var(--font-xs);
  color: var(--color-text-muted);
  text-align: right;
}

.tl-item--chat-in {
  border-left: 3px solid var(--color-accent);
}
.tl-item--chat-out {
  border-left: 3px solid var(--color-warning);
}
</style>
