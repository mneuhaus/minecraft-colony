<template>
  <div>
    <div v-if="isUpdateMemory && hasDiff" class="mem-header">
      <n-button size="tiny" @click="toggleView">
        <template #icon>
          <n-icon>
            <GitCompare />
          </n-icon>
        </template>
        {{ showDiff ? 'Show Full' : 'Show Diff' }}
      </n-button>
    </div>

    <div v-if="isUpdateMemory">
      <div v-if="showDiff && hasDiff" class="diff-view">
        <div class="diff-line" v-for="(change, idx) in diffLines" :key="idx" :class="change.type">
          <span class="diff-marker">{{ change.marker }}</span>
          <span class="diff-content">{{ change.content }}</span>
        </div>
      </div>

      <div v-else class="full-memory">
        <div class="markdown-content" v-html="renderedMarkdown"></div>
      </div>
    </div>

    <div v-else class="memory-get">
      <div class="markdown-content" v-html="renderedMarkdown"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { NButton, NIcon } from 'naive-ui';
import { GitCompare } from '@vicons/ionicons5';
import { marked } from 'marked';

const props = defineProps<{
  item: any;
}>();

const showDiff = ref(true);

const isUpdateMemory = computed(() => {
  const toolName = props.item.payload?.tool_name || props.item.tool_name || '';
  return toolName === 'update_memory';
});

const memoryContent = computed(() => {
  const payload = props.item.payload || props.item;

  if (isUpdateMemory.value) {
    // For update_memory, get the new content from input/params
    return payload.input?.content || payload.params_summary?.content || '';
  }

  // For get_memory, parse the output
  let output = payload.output;
  if (typeof output === 'string') {
    try {
      output = JSON.parse(output);
    } catch {
      return output;
    }
  }

  return output?.content || output || '';
});

const previousMemory = computed(() => {
  if (!isUpdateMemory.value) return '';

  const payload = props.item.payload || props.item;
  let output = payload.output;

  if (typeof output === 'string') {
    try {
      output = JSON.parse(output);
    } catch {
      return '';
    }
  }

  // The output of update_memory contains the previous content
  return output?.previous_content || '';
});

const diffLines = computed(() => {
  const prev = previousMemory.value;
  const curr = memoryContent.value;

  if (!prev) return [];

  const oldLines = prev.split('\n');
  const newLines = curr.split('\n');
  const diff: Array<{ type: string; marker: string; content: string }> = [];

  // Simple line-by-line diff
  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';

    if (oldLine === newLine) {
      diff.push({ type: 'unchanged', marker: ' ', content: newLine });
    } else if (!oldLine && newLine) {
      diff.push({ type: 'added', marker: '+', content: newLine });
    } else if (oldLine && !newLine) {
      diff.push({ type: 'removed', marker: '-', content: oldLine });
    } else {
      diff.push({ type: 'removed', marker: '-', content: oldLine });
      diff.push({ type: 'added', marker: '+', content: newLine });
    }
  }

  return diff;
});

const hasDiff = computed(() => diffLines.value.some(line => line.type !== 'unchanged'));

const renderedMarkdown = computed(() => {
  try {
    return marked.parse(memoryContent.value);
  } catch (e) {
    return `<pre>${memoryContent.value}</pre>`;
  }
});

function toggleView() {
  showDiff.value = !showDiff.value;
}
</script>

<style scoped>
.mem-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.diff-view {
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  overflow-x: auto;
  background: rgba(0, 0, 0, 0.3);
  padding: 8px;
  border-radius: 10px;
}

.diff-line {
  display: flex;
  white-space: pre;
  padding: 1px 0;
}

.diff-marker {
  width: 20px;
  flex-shrink: 0;
  text-align: center;
  margin-right: 8px;
  font-weight: bold;
}

.diff-line.unchanged {
  color: #95a5a6;
}

.diff-line.added {
  background: rgba(39, 174, 96, 0.15);
  color: #2ecc71;
}

.diff-line.added .diff-marker {
  color: #2ecc71;
}

.diff-line.removed {
  background: rgba(231, 76, 60, 0.15);
  color: #e74c3c;
}

.diff-line.removed .diff-marker {
  color: #e74c3c;
}

.full-memory,
.memory-get {
  overflow-x: auto;
}

.markdown-content {
  font-size: 14px;
  line-height: 1.6;
  ;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4) {
  color: #9b59b6;
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: 600;
}

.markdown-content :deep(h1) { font-size: var(--font-xl); }
.markdown-content :deep(h2) { font-size: 15px; }
.markdown-content :deep(h3) { font-size: 15px; }
.markdown-content :deep(h4) { font-size: 14px; }

.markdown-content :deep(p) {
  margin: 8px 0;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.markdown-content :deep(li) {
  margin: 4px 0;
}

.markdown-content :deep(code) {
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 14px;
  color: #e8b86d;
}

.markdown-content :deep(pre) {
  background: rgba(0, 0, 0, 0.3);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 8px 0;
}

.markdown-content :deep(pre code) {
  background: none;
  padding: 0;
}

.markdown-content :deep(strong) {
  color: #3498db;
  font-weight: 600;
}

.markdown-content :deep(blockquote) {
  border-left: 3px solid #9b59b6;
  padding-left: 12px;
  margin: 8px 0;
  color: #95a5a6;
  font-style: italic;
}

.memory-get h3 {
  margin: 0 0 12px 0;
  font-size: 15px;
  color: #9b59b6;
  font-weight: 600;
}
</style>
