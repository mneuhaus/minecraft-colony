<template>
  <MessageBlock
    eyebrow="Todo"
    title="TodoWrite"
    :tone="todos.length ? 'info' : 'neutral'"
    padding="md"
  >
    <template #meta>
      <span class="todo-chip">{{ doneCount }} / {{ todos.length }} completed</span>
    </template>
    <ul class="todo-list">
      <li v-for="(t, i) in todos" :key="i" class="todo-row">
        <span class="todo-check">{{ done(t) ? '☑' : '☐' }}</span>
        <span class="todo-text">{{ text(t) }}</span>
      </li>
    </ul>
  </MessageBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MessageBlock from '../../MessageBlock.vue';
const props = defineProps<{ item: any }>();
const payload = computed(()=> props.item.payload || (props.item.data ? { params_summary: props.item.data } : {}) );

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

const todos = computed<any[]>(()=> extractTodos(payload.value));
const done = (t: any) => String(t?.status||'').toLowerCase()==='completed' || t?.done===true;
const text = (t: any) => typeof t?.content==='string' ? t.content : (typeof t?.activeForm==='string' ? t.activeForm : JSON.stringify(t));
const doneCount = computed(()=> todos.value.filter(done).length);
</script>

<style scoped>
.todo-chip { padding: 2px var(--spacing-sm); border-radius: var(--radius-sm); border: 1px solid var(--color-border-subtle); font-size: var(--font-xs); }
.todo-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
.todo-row {
  display: flex;
  gap: var(--spacing-sm);
  align-items: flex-start;
  color: var(--color-text-primary);
  font-size: var(--font-sm);
}
.todo-check {
  width: 20px;
  display: inline-block;
  text-align: center;
  color: var(--color-accent);
}
.todo-text { color: var(--color-text-secondary); }
</style>
