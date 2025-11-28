<template>
  <div class="sidebar-todos">
    <div class="todos-header">
      <h3>Tasks</h3>
      <div v-if="todos.length > 0" class="progress-badge">
        {{ completedCount }}/{{ todos.length }}
      </div>
    </div>

    <div v-if="todos.length === 0" class="empty-state">
      No active tasks
    </div>

    <ul v-else class="todo-list">
      <li v-for="(todo, i) in todos" :key="i" :class="['todo-item', `status-${todo.status}`]">
        <span class="todo-check">
          <span v-if="todo.status === 'completed'">✓</span>
          <span v-else-if="todo.status === 'in_progress'" class="spinner">⟳</span>
          <span v-else>○</span>
        </span>
        <span class="todo-text">
          {{ todo.status === 'in_progress' ? todo.activeForm : todo.content }}
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

interface Todo {
  content: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
}

const todos = ref<Todo[]>([]);

const completedCount = computed(() =>
  todos.value.filter(t => t.status === 'completed').length
);

let ws: WebSocket | null = null;

// Fetch initial todos from API
async function fetchTodos() {
  try {
    // Get the active bot name from the URL or use first available bot
    const urlParams = new URLSearchParams(window.location.search);
    let botName = urlParams.get('bot');

    if (!botName) {
      // Fetch list of bots and use the first one
      const botsResponse = await fetch('/api/bots');
      const bots = await botsResponse.json();
      if (bots.length > 0) {
        botName = bots[0].name;
      } else {
        return; // No bots available
      }
    }

    const response = await fetch(`/api/bots/${botName}/todos`);
    const data = await response.json();

    if (data.ok && data.todos) {
      todos.value = data.todos;
      console.log('Loaded todos from API:', data.todos);
    }
  } catch (err) {
    console.error('Failed to fetch todos:', err);
  }
}

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);

      // Look for write_todo tool calls
      if (message.type === 'tool' && message.details?.tool_name === 'write_todo') {
        console.log('Received write_todo message:', message);

        // Try multiple locations for todos
        const input = message.details?.input;
        const paramsSum = message.details?.params_summary;
        const output = message.details?.output;

        let newTodos = null;

        // Try input.todos first
        if (input?.todos) {
          newTodos = input.todos;
        }
        // Try params_summary.todos
        else if (paramsSum?.todos) {
          newTodos = paramsSum.todos;
        }
        // Try parsing output
        else if (output) {
          try {
            const parsed = JSON.parse(output);
            if (parsed.ok && parsed.todos) {
              newTodos = parsed.todos;
            }
          } catch {
            // Output is not JSON
          }
        }

        if (newTodos) {
          console.log('Updating todos to:', newTodos);
          todos.value = newTodos;
        }
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    // Reconnect after 2 seconds
    setTimeout(connectWebSocket, 2000);
  };
}

onMounted(() => {
  fetchTodos(); // Fetch initial todos
  connectWebSocket();
});

onUnmounted(() => {
  if (ws) {
    ws.close();
    ws = null;
  }
});
</script>

<style scoped>
.sidebar-todos {
  padding: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 16px;
}

.todos-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.todos-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text);
  opacity: 0.9;
}

.progress-badge {
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--color-accent);
  color: var(--color-bg);
  font-size: 11px;
  font-weight: 600;
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
  gap: 8px;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  transition: all 0.2s ease;
}

.todo-item.status-completed {
  opacity: 0.6;
}

.todo-item.status-in_progress {
  background: rgba(var(--color-accent-rgb), 0.1);
  border-left: 3px solid var(--color-accent);
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
  color: var(--color-accent);
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.todo-text {
  flex: 1;
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-text);
}

.status-completed .todo-text {
  text-decoration: line-through;
}

.status-in_progress .todo-text {
  font-weight: 500;
}
</style>
