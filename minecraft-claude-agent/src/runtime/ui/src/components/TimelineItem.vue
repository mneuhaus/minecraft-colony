<template>
  <div :id="anchorId" class="tl-item-wrapper" :class="wrapperClass">
    <n-card
      :class="cardClass"
      :bordered="true"
      size="small"
      class="tl-item"
      :style="{ borderColor: cardBorderColor, borderWidth: '2px', boxShadow: isHighlighted ? '0 0 20px ' + cardBorderColor : undefined }"
    >
      <!-- Header: Title/Name (left) + Actions (right) -->
      <template #header>
        <n-space justify="space-between" align="center">
          <n-text strong>{{ messageTitle }}</n-text>
          <n-space :size="8">
            <n-button
              size="tiny"
              quaternary
              @click="isExpanded = !isExpanded"
            >
              <template #icon>
                <n-icon>
                  <ChevronUp v-if="isExpanded" />
                  <ChevronDown v-else />
                </n-icon>
              </template>
            </n-button>
            <n-button
              v-if="hasInspector"
              size="tiny"
              quaternary
              @click="$emit('openInspector', item)"
            >
              <template #icon>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M8 2a6 6 0 100 12A6 6 0 008 2zM8 9a1 1 0 110-2 1 1 0 010 2z"/>
                </svg>
              </template>
            </n-button>
          </n-space>
        </n-space>
      </template>

      <!-- Body: Direct content (no inner card) -->
      <div v-show="isExpanded">
        <component
          :is="componentName"
          :item="item"
          @openInspector="$emit('openInspector', $event)"
        />
      </div>

      <!-- Footer: Reference (left, clickable) + Time (right) -->
      <template #footer>
        <div v-show="isExpanded">
          <n-space justify="space-between" align="center" class="footer-content">
            <n-button
              text
              size="tiny"
              class="reference-button"
              @click="copyReference"
            >
              <n-text depth="3" :size="11" style="font-family: monospace;">
                {{ identityLabel }}
              </n-text>
            </n-button>
            <n-text depth="3" :size="11" class="time-text">
              {{ time }}
            </n-text>
          </n-space>
        </div>
      </template>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, ref } from 'vue';
import { useMessage, NIcon } from 'naive-ui';
import { ChevronDown, ChevronUp } from '@vicons/ionicons5';
import ChatMessage from './types/ChatMessage.vue';
import SystemMessage from './types/SystemMessage.vue';
import SkillMessage from './types/SkillMessage.vue';
import ToolCard from './types/Tool/ToolCard.vue';

const props = defineProps<{ item: any; expandedState: Record<string, boolean> }>();
const message = useMessage();
const isHighlighted = ref(false);

// Generate unique key for this item
const itemKey = computed(() => {
  return props.item.id || `${props.item.type}-${props.item.ts}`;
});

// Determine if this item should be expanded by default
const shouldExpandByDefault = computed(() => {
  const t = props.item.type;

  // Always expand chat messages
  if (t === 'chat') return true;

  // Expand failed/error/warning messages
  if (props.item.outcome === 'failed' || props.item.outcome === 'error') return true;

  if (t === 'system') {
    const level = String(props.item.payload?.level || '').toLowerCase();
    if (level === 'error' || level === 'warn') return true;
  }

  // Collapse everything else by default
  return false;
});

// Use persistent expanded state from parent, initialize if not set
const isExpanded = computed({
  get: () => {
    const key = itemKey.value;
    // If state not set yet, initialize with default
    if (!(key in props.expandedState)) {
      props.expandedState[key] = shouldExpandByDefault.value;
    }
    return props.expandedState[key];
  },
  set: (value: boolean) => {
    props.expandedState[itemKey.value] = value;
  }
});

const time = computed(() => new Date(props.item.ts || Date.now()).toLocaleTimeString());

const chatPayload = computed(() => {
  if (props.item.type !== 'chat') return null;
  const payload = props.item.payload || {};
  return {
    text: payload.text ?? props.item.text ?? '',
    from: payload.from ?? props.item.from ?? null,
    direction: payload.direction ?? props.item.direction ?? 'out',
  };
});

const messageTitle = computed(() => {
  const t = props.item.type;

  if (t === 'chat') {
    const dir = chatPayload.value?.direction;
    // Extract username from message or use from/direction
    const rawText = chatPayload.value?.text || '';
    const match = rawText.match(/^([^:]+):/);
    if (match) return match[1].trim();
    return chatPayload.value?.from || (dir === 'in' ? 'Player' : 'Bot');
  }

  if (t === 'tool') {
    return props.item.payload?.tool_name || 'Tool';
  }

  if (t === 'skill') {
    return props.item.payload?.name || 'Skill';
  }

  if (t === 'system') {
    const level = String(props.item.payload?.level || '').toLowerCase();
    if (level === 'error') return 'Error';
    if (level === 'warn') return 'Warning';
    if (level === 'success') return 'Success';
    return 'System';
  }

  return 'Message';
});

const cardClass = computed(() => {
  let cls = `tl-card--${props.item.type}`;
  if (props.item.type === 'chat' && chatPayload.value?.direction) {
    cls += ` tl-card--chat-${chatPayload.value.direction}`;
  }
  if (props.item.outcome) {
    cls += ` tl-card--${props.item.outcome}`;
  }
  return cls;
});

const cardBorderColor = computed(() => {
  const t = props.item.type;

  if (t === 'chat') {
    const dir = chatPayload.value?.direction;
    // Player messages (incoming) = Green/Success
    if (dir === 'in') return '#5cb85c';
    // Bot messages (outgoing) = Blue/Info
    return '#4a9eff';
  }

  if (t === 'tool') {
    // Tool calls = Purple
    return '#9b59b6';
  }

  if (t === 'skill') {
    // Skills = Teal/Cyan
    return '#00d9ff';
  }

  if (t === 'system') {
    const level = String(props.item.payload?.level || '').toLowerCase();
    if (level === 'error') return '#d9534f';
    if (level === 'warn') return '#f0ad4e';
    if (level === 'success') return '#5cb85c';
    // Default info
    return '#4a9eff';
  }

  // Fallback
  return 'rgba(255, 255, 255, 0.1)';
});

const wrapperClass = computed(() => {
  const t = props.item.type;
  if (t === 'chat') {
    const dir = chatPayload.value?.direction;
    // Player messages on the right (like chat apps)
    return dir === 'in' ? 'tl-wrapper--right' : 'tl-wrapper--left';
  }
  // System messages centered
  if (t === 'system') return 'tl-wrapper--center';
  // Everything else on the left
  return 'tl-wrapper--left';
});

const componentName = computed(() => {
  const t = String(props.item.type || '');
  if (t === 'chat' || t === 'chat-in' || t === 'chat-out') return ChatMessage;
  if (t === 'system') return SystemMessage;
  if (t === 'skill') return SkillMessage;
  if (t === 'tool') return ToolCard;
  return SystemMessage;
});

const hasInspector = computed(() => {
  // Tools and some system messages can be inspected
  return props.item.type === 'tool' || props.item.type === 'system';
});

const identityLabel = computed(() => {
  // Show the stable anchor ID format in the footer
  if (anchorId.value) {
    return anchorId.value;
  }
  // Fallback if no anchor ID
  const type = String(props.item?.type || 'unknown');
  const id = props.item?.id ?? 'n/a';
  return `${type}-${id}`;
});

// Generate anchor ID from item reference using stable identifiers (timestamp + tool)
const anchorId = computed(() => {
  const type = String(props.item?.type || '');
  const ts = props.item?.ts;
  const tool = props.item?.payload?.tool_name || '';

  // Use timestamp as primary identifier (stable across reloads)
  if (ts) {
    // Format: msg-{type}-{timestamp}-{tool}
    const toolPart = tool ? `-${tool.replace(/[^a-z0-9]/gi, '_')}` : '';
    return `msg-${type}-${ts}${toolPart}`;
  }
  return undefined;
});

async function copyReference() {
  try {
    const url = `${window.location.origin}${window.location.pathname}#${anchorId.value}`;
    await navigator.clipboard.writeText(url);
    message.success('Link copied to clipboard', {
      duration: 2000,
    });
  } catch (err) {
    message.error('Failed to copy link');
  }
}

// Check if this message is highlighted via URL hash
function checkHighlight() {
  const hash = window.location.hash.slice(1); // Remove '#'
  if (hash && anchorId.value && hash === anchorId.value) {
    isHighlighted.value = true;
    // Scroll into view
    setTimeout(() => {
      const element = document.getElementById(anchorId.value!);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    // Remove highlight after 3 seconds
    setTimeout(() => {
      isHighlighted.value = false;
    }, 3000);
  }
}

onMounted(() => {
  checkHighlight();
  window.addEventListener('hashchange', checkHighlight);
});

onUnmounted(() => {
  window.removeEventListener('hashchange', checkHighlight);
});
</script>

<style scoped>
/* Wrapper for positioning */
.tl-item-wrapper {
  display: flex;
  width: 100%;
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
  max-width: 85%;
  transition: all 0.2s;
}

.tl-wrapper--center .tl-item {
  max-width: 70%;
}

.tl-item:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.time-text {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.footer-content {
  width: 100%;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 8px;
  margin-top: 4px;
}

.reference-button {
  padding: 0;
  min-width: 0;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.reference-button:hover {
  opacity: 1;
}
</style>
