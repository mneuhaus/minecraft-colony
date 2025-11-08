<template>
  <MessageBlock
    :eyebrow="isUpdateMemory ? 'Memory' : 'Context'"
    :title="isUpdateMemory ? 'Memory Update' : 'Memory Retrieved'"
    :tone="isUpdateMemory ? (hasDiff ? 'warning' : 'info') : 'neutral'"
    padding="lg"
    :shadow="true"
  >
    <template #actions>
      <button v-if="isUpdateMemory" @click="toggleView" class="view-toggle">
        {{ showDiff ? 'Show Full Memory' : 'Show Diff' }}
      </button>
    </template>

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
  </MessageBlock>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { marked } from 'marked';
import MessageBlock from '../../MessageBlock.vue';

const props = defineProps<{
  item: any;
}>();

const showDiff = ref(true);

const isUpdateMemory = computed(() => props.item.tool_name === 'update_memory');

const memoryContent = computed(() => {
  if (isUpdateMemory.value) {
    return props.item.input?.content || props.item.params_summary?.content || '';
  }
  return props.item.output || '';
});

const previousMemory = ref<string>(''); // In a real implementation, fetch from history

const diffLines = computed(() => {
  if (!previousMemory.value) return [];

  const oldLines = previousMemory.value.split('\n');
  const newLines = memoryContent.value.split('\n');
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
.view-toggle {
  padding: 4px 12px;
  background: rgba(155, 89, 182, 0.2);
  border: 1px solid #9b59b6;
  border-radius: var(--radius-sm);
  color: #9b59b6;
  cursor: pointer;
  font-size: var(--font-sm);
  transition: all 0.2s;
}

.view-toggle:hover {
  background: rgba(155, 89, 182, 0.3);
}

.diff-view {
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: var(--font-sm);
  line-height: 1.6;
  overflow-x: auto;
  background: rgba(0, 0, 0, 0.3);
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
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
  font-size: var(--font-sm);
  line-height: 1.6;
  color: var(--color-text-primary);
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
.markdown-content :deep(h3) { font-size: 14px; }
.markdown-content :deep(h4) { font-size: 13px; }

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
  font-size: 12px;
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
  font-size: 14px;
  color: #9b59b6;
  font-weight: 600;
}
</style>
