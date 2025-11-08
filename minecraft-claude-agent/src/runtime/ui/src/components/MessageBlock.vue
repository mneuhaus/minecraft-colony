<template>
  <div class="msg-block" :class="{ 'msg-block--collapsed': collapsed }">
    <div class="msg-header">
      <div class="msg-header__content">
        <slot name="title">
          <span class="msg-title">{{ title }}</span>
        </slot>
        <slot name="meta"></slot>
      </div>
      <div class="msg-header__actions">
        <slot name="actions"></slot>
        <button v-if="collapsible" class="msg-collapse-btn" @click="toggleCollapse">
          {{ collapsed ? '▶' : '▼' }}
        </button>
      </div>
    </div>

    <div v-if="!collapsed" class="msg-body">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(defineProps<{
  title?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}>(), {
  collapsible: false,
  defaultCollapsed: false
});

const collapsed = ref(props.defaultCollapsed);

function toggleCollapse() {
  collapsed.value = !collapsed.value;
}
</script>

<style scoped>
.msg-block {
  width: 100%;
}

.msg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid #2E2E2E;
  user-select: none;
}

.msg-block--collapsed .msg-header {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.msg-header--clickable {
  cursor: pointer;
}

.msg-header__content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.msg-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.msg-title {
  font-weight: 600;
  font-size: 13px;
  color: #EAEAEA;
}

.msg-collapse-btn {
  background: none;
  border: none;
  color: #7A7A7A;
  font-size: 10px;
  cursor: pointer;
  padding: 2px 6px;
  transition: color 0.2s;
}

.msg-collapse-btn:hover {
  color: #EAEAEA;
}

.msg-body {
  margin-top: 0;
}
</style>
