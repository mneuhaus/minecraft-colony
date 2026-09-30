<template>
  <div class="todo-container">
    <div v-if="todos.length === 0" class="empty-state">
      No active tasks
    </div>

    <ul v-else class="todo-list">
      <li v-for="(todo, i) in todos" :key="i" :class="['todo-item', `status-${getStatus(todo)}`]">
        <span class="todo-check">
          <span v-if="getStatus(todo) === 'completed'">&#10003;</span>
          <span v-else-if="getStatus(todo) === 'in_progress'" class="spinner">&#10227;</span>
          <span v-else>&#9675;</span>
        </span>
        <span class="todo-text">
          {{ getStatus(todo) === 'in_progress' && todo.activeForm ? todo.activeForm : getText(todo) }}
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ item: any }>();
const payload = computed(() => props.item.payload || (props.item.data ? { params_summary: props.item.data } : {}));

function extractTodos(p: any): any[] {
  const ps = p?.params_summary;
  if (Array.isArray(ps?.todos)) return ps.todos;
  if (Array.isArray(ps?.input?.todos)) return ps.input.todos;
  if (Array.isArray(p?.input?.todos)) return p.input.todos;
  if (Array.isArray(p?.output?.todos)) return p.output.todos;
  // Deep fallback
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
</script>

<style scoped>
.todo-container {
  padding: 8px 0;
}

.empty-state {
  padding: 12px;
  text-align: center;
  color: var(--color-text);
  opacity: 0.5;
  font-size: 13px;
  font-style: italic;
}

.todo-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
}

.todo-item.status-completed {
  opacity: 0.6;
}

.todo-item.status-in_progress {
  background: rgba(232, 184, 109, 0.1);
  border-left: 3px solid #e8b86d;
  padding-left: 7px;
}

.todo-check {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 14px;
  color: #e8b86d;
}

.status-completed .todo-check {
  color: #2ecc71;
}

.status-pending .todo-check {
  color: #95a5a6;
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.todo-text {
  flex: 1;
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-text);
}

.status-completed .todo-text {
  text-decoration: line-through;
  color: #95a5a6;
}

.status-in_progress .todo-text {
  font-weight: 500;
}
</style>
