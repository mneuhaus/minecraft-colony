<template>
  <MessageBlock
    eyebrow="CraftScript"
    :title="toolTitle"
    :tone="tone"
    padding="md"
    :shadow="true"
  >
    <template #meta>
      <span class="tool-status" :class="statusClass">{{ statusText }}</span>
    </template>

    <div class="fn-meta" v-if="fn">
      <div class="fn-row"><span class="fn-k">name</span><span class="fn-v">{{ fn.name }}</span></div>
      <div class="fn-row" v-if="fn.description"><span class="fn-k">description</span><span class="fn-v">{{ fn.description }}</span></div>
      <div class="fn-row" v-if="fn.version || fn.current_version"><span class="fn-k">version</span><span class="fn-v">{{ fn.version || fn.current_version }}</span></div>
      <div class="fn-row" v-if="fn.change_summary && operation === 'edit'"><span class="fn-k">changes</span><span class="fn-v">{{ fn.change_summary }}</span></div>
    </div>

    <div class="fn-args" v-if="args && args.length">
      <div class="fn-args-header">Arguments</div>
      <div class="arg-row" v-for="(arg, i) in args" :key="i">
        <span class="arg-name">{{ arg.name }}</span>
        <span class="arg-type">{{ arg.type }}</span>
        <span class="arg-optional" v-if="arg.optional">optional</span>
        <span class="arg-default" v-if="arg.default !== undefined">= {{ formatValue(arg.default) }}</span>
      </div>
    </div>

    <div class="fn-body-section" v-if="body && !hasDiff">
      <button class="fn-body-toggle" @click="showBody = !showBody">
        {{ showBody ? '▼' : '▶' }} Function Body
      </button>
      <div v-if="showBody" class="fn-body">
        <pre class="fn-body__code"><code class="language-javascript hljs" v-html="highlightedBody"></code></pre>
      </div>
    </div>

    <div class="fn-diff-section" v-if="hasDiff">
      <button class="fn-diff-toggle" @click="showDiff = !showDiff">
        {{ showDiff ? '▼' : '▶' }} Changes (v{{ previousVersion }} → v{{ fn.version }})
      </button>
      <div v-if="showDiff" class="fn-diff">
        <div class="diff-side">
          <div class="diff-header diff-header--old">v{{ previousVersion }} (Previous)</div>
          <div class="diff-body">
            <div v-for="(row, i) in diffRows" :key="i" class="diff-line" :class="row.leftClass">
              <span class="diff-ln">{{ row.leftNo ?? '' }}</span>
              <code class="diff-code language-javascript hljs" v-html="row.leftHtml"></code>
            </div>
          </div>
        </div>
        <div class="diff-side">
          <div class="diff-header diff-header--new">v{{ fn.version }} (New)</div>
          <div class="diff-body">
            <div v-for="(row, i) in diffRows" :key="i" class="diff-line" :class="row.rightClass">
              <span class="diff-ln">{{ row.rightNo ?? '' }}</span>
              <code class="diff-code language-javascript hljs" v-html="row.rightHtml"></code>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="fn-list" v-if="functionList && functionList.length">
      <div class="fn-list-header">{{ functionList.length }} function{{ functionList.length === 1 ? '' : 's' }}</div>
      <div class="fn-list-item" v-for="func in functionList" :key="func.id || func.name">
        <div class="fn-list-name">{{ func.name }}</div>
        <div class="fn-list-desc">{{ func.description || '—' }}</div>
        <div class="fn-list-version">v{{ func.current_version || func.version || 1 }}</div>
      </div>
    </div>

    <div class="fn-versions" v-if="versions && versions.length">
      <div class="fn-versions-header">Version History</div>
      <div class="version-row" v-for="ver in versions" :key="ver.version">
        <div class="version-num">v{{ ver.version }}</div>
        <div class="version-info">
          <div class="version-summary">{{ ver.change_summary || 'No summary' }}</div>
          <div class="version-meta">{{ formatDate(ver.created_at) }} • {{ ver.created_by || 'unknown' }}</div>
        </div>
      </div>
    </div>

    <div class="fn-error" v-if="error">
      <span class="error-icon">⚠️</span>
      <span class="error-text">{{ error }}</span>
    </div>
  </MessageBlock>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MessageBlock from '../../MessageBlock.vue';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import 'highlight.js/styles/github-dark-dimmed.css';

const HIGHLIGHT_LANG = 'javascript';

if (!hljs.getLanguage(HIGHLIGHT_LANG)) {
  hljs.registerLanguage(HIGHLIGHT_LANG, javascript);
}

const props = defineProps<{ item: any }>();

const showBody = ref(false);
const showDiff = ref(true); // Default to showing diff for edit operations

const raw = computed(() => {
  const o = props.item?.payload?.output;
  if (typeof o === 'string') {
    try { return JSON.parse(o); } catch { return {}; }
  }
  return o ?? {};
});

const toolName = computed(() => String(props.item?.payload?.tool_name || ''));
const operation = computed(() => {
  const tn = toolName.value.toLowerCase();
  if (tn.includes('create')) return 'create';
  if (tn.includes('edit')) return 'edit';
  if (tn.includes('delete')) return 'delete';
  if (tn.includes('list_function')) return 'list';
  if (tn.includes('list_version')) return 'versions';
  if (tn.includes('get')) return 'get';
  return 'unknown';
});

const toolTitle = computed(() => {
  const op = operation.value;
  if (op === 'create') return 'Create Function';
  if (op === 'edit') return 'Edit Function';
  if (op === 'delete') return 'Delete Function';
  if (op === 'list') return 'List Functions';
  if (op === 'versions') return 'Version History';
  if (op === 'get') return 'Get Function';
  return 'CraftScript Function';
});

const isSuccess = computed(() => raw.value?.ok === true);
const error = computed(() => {
  if (raw.value?.ok === false) {
    return raw.value?.message || raw.value?.error || 'Operation failed';
  }
  return null;
});

const statusClass = computed(() => isSuccess.value ? 'status-success' : (error.value ? 'status-error' : ''));
const statusText = computed(() => {
  if (isSuccess.value) return '✓';
  if (error.value) return '✗';
  return '';
});

// Single function data (for create, edit, get, delete)
const fn = computed(() => {
  if (raw.value?.function) return raw.value.function;
  // For create/edit, the response includes id, name, version directly
  if (raw.value?.name) return raw.value;
  return null;
});

const args = computed(() => {
  if (fn.value?.args) return fn.value.args;
  // For input, check params
  const input = props.item?.payload?.input;
  if (input?.args) return input.args;
  return [];
});

const body = computed(() => {
  if (fn.value?.body) return fn.value.body;
  // For create, body is in input
  const input = props.item?.payload?.input;
  if (input?.body) return input.body;
  return null;
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlightSnippet(code: string | null | undefined): string {
  const source = code ?? '';
  if (!source) return '';
  try {
    return hljs.highlight(source, { language: HIGHLIGHT_LANG, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(source);
  }
}

function highlightDiffLine(code: string | null | undefined): string {
  const highlighted = highlightSnippet(code);
  return highlighted === '' ? '&nbsp;' : highlighted;
}

// Syntax highlighting for CraftScript
const highlightedBody = computed(() => {
  if (!body.value) return '';
  return highlightSnippet(body.value);
});

// Diff support for edit operations
const hasDiff = computed(() => {
  return operation.value === 'edit' && raw.value?.previous_body && raw.value?.new_body;
});

const previousVersion = computed(() => raw.value?.previous_version || '?');
const previousBody = computed(() => raw.value?.previous_body || '');
const newBody = computed(() => raw.value?.new_body || '');

// Build a simple side-by-side diff (line-based) using LCS
type Row = { leftNo?: number, rightNo?: number, leftHtml: string, rightHtml: string, leftClass: string, rightClass: string };

function lcsMatrix(a: string[], b: string[]) {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

function buildRows(a: string, b: string): Row[] {
  const aLines = (a || '').split(/\r?\n/);
  const bLines = (b || '').split(/\r?\n/);
  const dp = lcsMatrix(aLines, bLines);
  let i = aLines.length, j = bLines.length;
  const ops: Array<{ t: 'same' | 'del' | 'add', a?: string, b?: string }> = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) { ops.push({ t: 'same', a: aLines[i - 1], b: bLines[j - 1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { ops.push({ t: 'add', b: bLines[j - 1] }); j--; }
    else { ops.push({ t: 'del', a: aLines[i - 1] }); i--; }
  }
  ops.reverse();

  const rows: Row[] = [];
  let lnA = 1, lnB = 1;
  for (const op of ops) {
    if (op.t === 'same') {
      rows.push({
        leftNo: lnA++, rightNo: lnB++,
        leftHtml: highlightDiffLine(op.a || ''),
        rightHtml: highlightDiffLine(op.b || ''),
        leftClass: 'is-same', rightClass: 'is-same'
      });
    } else if (op.t === 'del') {
      rows.push({
        leftNo: lnA++, rightNo: undefined,
        leftHtml: highlightDiffLine(op.a || ''),
        rightHtml: '',
        leftClass: 'is-del', rightClass: 'is-empty'
      });
    } else { // add
      rows.push({
        leftNo: undefined, rightNo: lnB++,
        leftHtml: '',
        rightHtml: highlightDiffLine(op.b || ''),
        leftClass: 'is-empty', rightClass: 'is-add'
      });
    }
  }
  return rows;
}

const diffRows = computed<Row[]>(() => buildRows(previousBody.value, newBody.value));

// Function list (for list_craftscript_functions)
const functionList = computed(() => {
  if (raw.value?.functions && Array.isArray(raw.value.functions)) {
    return raw.value.functions;
  }
  return null;
});

// Version history (for list_function_versions)
const versions = computed(() => {
  if (raw.value?.versions && Array.isArray(raw.value.versions)) {
    return raw.value.versions;
  }
  return null;
});

function formatValue(val: any): string {
  if (typeof val === 'string') return `"${val}"`;
  return String(val);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
</script>

<style scoped>
.tool-status { font-size: var(--font-md); font-weight: 600; }
.status-success { color: var(--color-success); }
.status-error { color: var(--color-danger); }

.fn-meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--spacing-xs) var(--spacing-md);
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm);
  background: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}
.fn-row { display: contents; }
.fn-k {
  color: var(--color-text-muted);
  font-size: var(--font-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.fn-v {
  color: var(--color-text-primary);
  font-size: var(--font-sm);
  font-family: 'Monaco','Courier New',monospace;
}

.fn-args {
  margin-bottom: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.fn-args-header {
  background: var(--color-accent-soft);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-xs);
  font-weight: 600;
  color: var(--color-accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.arg-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-top: 1px solid var(--color-border);
  font-size: var(--font-sm);
}
.arg-name { font-weight: 600; color: var(--color-text-primary); }
.arg-type { color: var(--color-text-muted); font-size: var(--font-xs); text-transform: uppercase; }
.arg-optional { color: var(--color-accent); font-size: var(--font-xs); }
.arg-default { color: var(--color-text-secondary); font-family: 'Monaco','Courier New',monospace; }

.fn-body-section { margin-bottom: var(--spacing-md); }
.fn-body-toggle,
.fn-diff-toggle {
  background: none;
  border: none;
  color: var(--color-accent);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}
.fn-body {
  margin-top: var(--spacing-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-muted);
  overflow: auto;
}
.fn-body__code { margin: 0; padding: var(--spacing-sm); font-size: var(--font-sm); }

.fn-diff-section { margin-top: var(--spacing-lg); }
.fn-diff {
  margin-top: var(--spacing-xs);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
  font-size: var(--font-xs);
}
.diff-side {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.diff-header {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: var(--font-xs);
}
.diff-header--old { background: rgba(248,113,113,0.12); color: var(--color-danger); }
.diff-header--new { background: var(--color-accent-soft); color: var(--color-accent); }
.diff-body { max-height: 300px; overflow: auto; }
.diff-line {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.diff-ln {
  font-size: 10px;
  font-family: 'Monaco','Courier New',monospace;
  color: var(--color-text-muted);
  padding: 0 6px;
  border-right: 1px solid rgba(255,255,255,0.04);
}
.diff-code {
  display: block;
  font-family: 'Monaco','Courier New',monospace;
  padding: 2px 6px;
  white-space: pre-wrap;
}
.is-del { background: rgba(248,113,113,0.08); }
.is-add { background: rgba(52,211,153,0.08); }

.fn-list, .fn-versions {
  margin-top: var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.fn-list-header,
.fn-versions-header {
  padding: var(--spacing-sm) var(--spacing-md);
  font-weight: 600;
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid var(--color-border);
}
.fn-list-item {
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid rgba(255,255,255,0.04);
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: var(--spacing-sm);
  font-size: var(--font-sm);
}
.fn-list-name { font-weight: 600; color: var(--color-text-primary); }
.fn-list-desc { color: var(--color-text-secondary); }
.fn-list-version { color: var(--color-text-muted); font-family: 'Monaco','Courier New',monospace; }

.version-row {
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid rgba(255,255,255,0.04);
  display: flex;
  gap: var(--spacing-md);
}
.version-num { font-family: 'Monaco','Courier New',monospace; color: var(--color-accent); }
.version-summary { font-weight: 500; color: var(--color-text-primary); }
.version-meta { font-size: var(--font-xs); color: var(--color-text-muted); }

.fn-error {
  margin-top: var(--spacing-lg);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid rgba(248,113,113,0.6);
  border-radius: var(--radius-md);
  background: rgba(248,113,113,0.12);
  color: #fca5a5;
}
</style>
