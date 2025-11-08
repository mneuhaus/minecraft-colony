<template>
  <article :class="blockClasses">
    <header class="msg-header" :class="{ 'msg-header--sticky': stickyHeader }">
      <div class="msg-header__text">
        <slot name="eyebrow">
          <span v-if="eyebrow" class="msg-eyebrow">{{ eyebrow }}</span>
        </slot>
        <slot name="title">
          <h3 v-if="title" class="msg-title">{{ title }}</h3>
        </slot>
        <slot name="subtitle">
          <p v-if="subtitle" class="msg-subtitle">{{ subtitle }}</p>
        </slot>
      </div>
      <div class="msg-header__meta">
        <slot name="meta"></slot>
      </div>
      <div class="msg-header__actions">
        <slot name="actions"></slot>
        <button
          v-if="collapsible"
          class="msg-collapse-btn"
          type="button"
          :aria-expanded="!collapsed"
          @click="toggleCollapse"
        >
          <span class="visually-hidden">{{ collapsed ? 'Expand section' : 'Collapse section' }}</span>
          <svg viewBox="0 0 16 16" aria-hidden="true" :class="{ 'is-collapsed': collapsed }">
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </header>

    <transition name="collapse">
      <section v-show="!collapsed" class="msg-body" :class="bodyPaddingClass">
        <slot></slot>
      </section>
    </transition>

    <footer v-if="$slots.footer" class="msg-footer">
      <slot name="footer"></slot>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  shadow?: boolean;
  stickyHeader?: boolean;
}>(), {
  collapsible: false,
  defaultCollapsed: false,
  padding: 'md',
  tone: 'neutral',
  shadow: false,
  stickyHeader: false,
});

const collapsed = ref(props.defaultCollapsed);

watch(
  () => props.defaultCollapsed,
  (val) => {
    collapsed.value = val;
  }
);

const blockClasses = computed(() => [
  'msg-block',
  `msg-block--${props.tone}`,
  props.shadow ? 'msg-block--shadow' : null,
  collapsed.value ? 'msg-block--collapsed' : null,
]);

const bodyPaddingClass = computed(() => `msg-body--padding-${props.padding}`);

const stickyHeader = computed(() => props.stickyHeader);

function toggleCollapse() {
  collapsed.value = !collapsed.value;
}
</script>

<style scoped>
.msg-block {
  width: 100%;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  transition: border-color var(--transition-base), background var(--transition-base), box-shadow var(--transition-base);
}

.msg-block--shadow {
  box-shadow: var(--shadow-soft);
}

.msg-block--info {
  border-color: rgba(0, 217, 255, 0.5);
}
.msg-block--success {
  border-color: rgba(52, 211, 153, 0.5);
}
.msg-block--warning {
  border-color: rgba(255, 184, 108, 0.45);
}
.msg-block--danger {
  border-color: rgba(248, 113, 113, 0.45);
}

.msg-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
}

.msg-header--sticky {
  position: sticky;
  top: 0;
  background: inherit;
  z-index: 1;
}

.msg-block--collapsed .msg-header {
  border-bottom: none;
}

.msg-header__text {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.msg-header__meta,
.msg-header__actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.msg-eyebrow {
  font-size: var(--font-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
}

.msg-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.2;
}

.msg-subtitle {
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.msg-collapse-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  transition: color var(--transition-base), background var(--transition-base);
}

.msg-collapse-btn svg {
  width: 1rem;
  height: 1rem;
  transform-origin: center;
  transition: transform var(--transition-base);
}

.msg-collapse-btn svg.is-collapsed {
  transform: rotate(-90deg);
}

.msg-collapse-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-border-subtle);
}

.msg-body {
  padding: 0 var(--spacing-md) var(--spacing-md);
}

.msg-body--padding-none { padding: 0; }
.msg-body--padding-sm { padding: var(--spacing-sm); }
.msg-body--padding-md { padding: var(--spacing-md); }
.msg-body--padding-lg { padding: var(--spacing-lg); }

.msg-footer {
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: var(--border-width) solid var(--color-border-subtle);
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all var(--transition-base);
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 2000px;
  opacity: 1;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
