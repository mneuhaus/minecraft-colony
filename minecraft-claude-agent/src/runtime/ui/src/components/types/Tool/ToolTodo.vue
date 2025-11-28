<template>
  <div class="todo-container">
    <!-- Summary Header -->
    <div class="todo-summary">
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-value">{{ completedCount }}</span>
          <span class="stat-label">Completed</span>
        </div>
        <div class="stat-divider">/</div>
        <div class="stat-item">
          <span class="stat-value">{{ todos.length }}</span>
          <span class="stat-label">Total</span>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
    </div>

    <!-- Todo List -->
    <ul class="todo-list">
      <li
        v-for="(todo, i) in todos"
        :key="i"
        class="todo-item"
        :class="getStatusClass(todo)"
      >
        <div class="todo-status-indicator">
          <n-icon :component="getStatusIcon(todo)" :class="'status-icon-' + getStatus(todo)" />
        </div>
        <div class="todo-content">
          <div class="todo-text">{{ getText(todo) }}</div>
          <div v-if="getStatus(todo) === 'in_progress' && todo.activeForm" class="todo-active-form">
            {{ todo.activeForm }}
          </div>
        </div>
        <div class="todo-status-badge" :class="'badge-' + getStatus(todo)">
          {{ getStatusLabel(todo) }}
        </div>
      </li>
    </ul>

    <!-- Empty State -->
    <div v-if="todos.length === 0" class="empty-state">
      <n-icon :component="CheckmarkDoneOutline" class="empty-icon" />
      <span>No tasks</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NIcon } from 'naive-ui';
import {
  CheckmarkCircleOutline,
  EllipseOutline,
  PlayCircleOutline,
  CheckmarkDoneOutline
} from '@vicons/ionicons5';

const props = defineProps<{ item: any }>();
const payload = computed(() => props.item.payload || (props.item.data ? { params_summary: props.item.data } : {}));

function extractTodos(p: any): any[] {
  // Accept a variety of shapes seen in persistence
  // - params_summary.todos
  // - params_summary.input.todos
  // - input.todos
  // - output.todos
  const ps = p?.params_summary;
  if (Array.isArray(ps?.todos)) return ps.todos;
  if (Array.isArray(ps?.input?.todos)) return ps.input.todos;
  if (Array.isArray(p?.input?.todos)) return p.input.todos;
  if (Array.isArray(p?.output?.todos)) return p.output.todos;
  // Deep fallback: find first array called 'todos'
  const seen = new Set<any>();
  const stack: any[] = [p];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    if (Array.isArray(cur.todos)) return cur.todos;
    for (const v of Object.values(cur)) stack.push(v);
  }
  return [];
}

const todos = computed<any[]>(() => extractTodos(payload.value));

const getStatus = (todo: any): string => {
  const status = String(todo?.status || '').toLowerCase();
  if (status === 'completed') return 'completed';
  if (status === 'in_progress') return 'in_progress';
  if (status === 'pending') return 'pending';
  if (todo?.done === true) return 'completed';
  return 'pending';
};

const getText = (todo: any): string => {
  if (typeof todo?.content === 'string') return todo.content;
  if (typeof todo?.activeForm === 'string') return todo.activeForm;
  return JSON.stringify(todo);
};

const getStatusIcon = (todo: any) => {
  const status = getStatus(todo);
  if (status === 'completed') return CheckmarkCircleOutline;
  if (status === 'in_progress') return PlayCircleOutline;
  return EllipseOutline;
};

const getStatusClass = (todo: any): string => {
  return `status-${getStatus(todo)}`;
};

const getStatusLabel = (todo: any): string => {
  const status = getStatus(todo);
  if (status === 'completed') return 'Done';
  if (status === 'in_progress') return 'Active';
  return 'Pending';
};

const completedCount = computed(() => todos.value.filter(t => getStatus(t) === 'completed').length);
const progressPercent = computed(() =>
  todos.value.length > 0 ? Math.round((completedCount.value / todos.value.length) * 100) : 0
);
</script>

<style scoped>
.todo-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Summary Section */
.todo-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

.summary-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-accent);
}

.stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #95a5a6;
  margin-top: 2px;
}

.stat-divider {
  font-size: 20px;
  color: #7f8c8d;
  margin: 0 4px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-accent), #2ecc71);
  transition: width 0.3s ease;
  border-radius: 3px;
}

/* Todo List */
.todo-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border-left: 3px solid transparent;
  transition: all 0.2s ease;
}

.todo-item:hover {
  background: rgba(0, 0, 0, 0.3);
}

.todo-item.status-completed {
  border-left-color: #2ecc71;
  opacity: 0.7;
}

.todo-item.status-in_progress {
  border-left-color: #e8b86d;
  background: rgba(232, 184, 109, 0.1);
}

.todo-item.status-pending {
  border-left-color: #95a5a6;
}

.todo-status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.todo-status-indicator :deep(.n-icon) {
  font-size: 20px;
}

.status-icon-completed {
  color: #2ecc71;
}

.status-icon-in_progress {
  color: #e8b86d;
}

.status-icon-pending {
  color: #95a5a6;
}

.todo-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.todo-text {
  font-size: 14px;
  line-height: 1.5;
  color: #ecf0f1;
  word-wrap: break-word;
}

.status-completed .todo-text {
  text-decoration: line-through;
  color: #95a5a6;
}

.todo-active-form {
  font-size: 12px;
  color: #e8b86d;
  font-style: italic;
  margin-top: 2px;
}

.todo-status-badge {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

.badge-completed {
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
}

.badge-in_progress {
  background: rgba(232, 184, 109, 0.2);
  color: #e8b86d;
}

.badge-pending {
  background: rgba(149, 165, 166, 0.2);
  color: #95a5a6;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: #95a5a6;
  font-size: 14px;
  gap: 8px;
}

.empty-icon {
  font-size: 32px;
  opacity: 0.5;
}
</style>
