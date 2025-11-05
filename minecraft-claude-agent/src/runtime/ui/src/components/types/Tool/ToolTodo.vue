<template>
  <div class="tl-item__body">
    <div class="todo-header">TodoWrite</div>
    <ul class="todo-list">
      <li v-for="(t, i) in todos" :key="i" class="todo-row">
        <span class="todo-check">{{ done(t) ? '☑' : '☐' }}</span>
        <span class="todo-text">{{ text(t) }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
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
.todo-header {
  font-weight: 600;
  color: #EAEAEA;
  margin-bottom: 12px;
  font-size: 13px;
}
.todo-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.todo-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  color: #EAEAEA;
}
.todo-check {
  width: 18px;
  display: inline-block;
  text-align: center;
  color: #EAEAEA;
}
.todo-text {
  color: #EAEAEA;
  opacity: 0.92;
}
</style>
