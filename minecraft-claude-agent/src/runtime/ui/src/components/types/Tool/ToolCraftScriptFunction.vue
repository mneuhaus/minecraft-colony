<template>
  <div class="tl-item__body tool-csfunction">
    <div class="tool-header">
      <span class="tool-icon">⚙️</span>
      <span class="tool-name">{{ toolTitle }}</span>
      <span class="tool-status" :class="statusClass">{{ statusText }}</span>
    </div>

    <div class="fn-meta" v-if="fn">
      <div class="fn-row"><span class="fn-k">name</span><span class="fn-v">{{ fn.name }}</span></div>
      <div class="fn-row" v-if="fn.description"><span class="fn-k">description</span><span class="fn-v">{{ fn.description }}</span></div>
      <div class="fn-row" v-if="fn.version || fn.current_version"><span class="fn-k">version</span><span class="fn-v">{{ fn.version || fn.current_version }}</span></div>
      <div class="fn-row" v-if="fn.change_summary && operation === 'edit'"><span class="fn-k">changes</span><span class="fn-v">{{ fn.change_summary }}</span></div>
    </div>

    <!-- Arguments list -->
    <div class="fn-args" v-if="args && args.length">
      <div class="fn-args-header">Arguments</div>
      <div class="arg-row" v-for="(arg, i) in args" :key="i">
        <span class="arg-name">{{ arg.name }}</span>
        <span class="arg-type">{{ arg.type }}</span>
        <span class="arg-optional" v-if="arg.optional">optional</span>
        <span class="arg-default" v-if="arg.default !== undefined">= {{ formatValue(arg.default) }}</span>
      </div>
    </div>

    <!-- Function body (collapsible) -->
    <div class="fn-body-section" v-if="body && !hasDiff">
      <button class="fn-body-toggle" @click="showBody = !showBody">
        {{ showBody ? '▼' : '▶' }} Function Body
      </button>
      <div v-if="showBody" class="fn-body">
        <pre class="fn-body__code"><code class="language-javascript hljs" v-html="highlightedBody"></code></pre>
      </div>
    </div>

    <!-- Diff view (for edit operations) -->
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

    <!-- Function list (for list_craftscript_functions) -->
    <div class="fn-list" v-if="functionList && functionList.length">
      <div class="fn-list-header">{{ functionList.length }} function{{ functionList.length === 1 ? '' : 's' }}</div>
      <div class="fn-list-item" v-for="func in functionList" :key="func.id || func.name">
        <div class="fn-list-name">{{ func.name }}</div>
        <div class="fn-list-desc">{{ func.description || '—' }}</div>
        <div class="fn-list-version">v{{ func.current_version || func.version || 1 }}</div>
      </div>
    </div>

    <!-- Version history (for list_function_versions) -->
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

    <!-- Error display -->
    <div class="fn-error" v-if="error">
      <span class="error-icon">⚠️</span>
      <span class="error-text">{{ error }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
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
.tool-csfunction {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  color: #EAEAEA;
  font-size: 13px;
}

.tool-icon {
  font-size: 16px;
}

.tool-name {
  flex: 1;
}

.tool-status {
  font-size: 14px;
  font-weight: bold;
}

.status-success {
  color: #4ADE80;
}

.status-error {
  color: #F87171;
}

/* Metadata grid */
.fn-meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 12px;
  margin-bottom: 12px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  border: 1px solid #2E2E2E;
}

.fn-row {
  display: contents;
}

.fn-k {
  color: #B3B3B3;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.fn-v {
  color: #EAEAEA;
  font-size: 12px;
  font-family: 'Monaco', 'Courier New', monospace;
}

/* Arguments */
.fn-args {
  margin-bottom: 12px;
  border: 1px solid #2E2E2E;
  border-radius: 6px;
  overflow: hidden;
}

.fn-args-header {
  background: rgba(74, 158, 255, 0.1);
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #4A9EFF;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.arg-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-top: 1px solid #2E2E2E;
  font-size: 12px;
}

.arg-name {
  color: #EAEAEA;
  font-family: 'Monaco', 'Courier New', monospace;
  font-weight: 600;
}

.arg-type {
  color: #4A9EFF;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 11px;
}

.arg-optional {
  color: #B3B3B3;
  font-size: 10px;
  font-style: italic;
}

.arg-default {
  color: #FCD34D;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  margin-left: auto;
}

/* Function body */
.fn-body-section {
  margin-bottom: 12px;
}

.fn-body-toggle {
  background: rgba(74, 158, 255, 0.1);
  border: 1px solid rgba(74, 158, 255, 0.3);
  color: #4A9EFF;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  text-align: left;
  font-weight: 600;
}

.fn-body-toggle:hover {
  background: rgba(74, 158, 255, 0.15);
}

.fn-body {
  margin-top: 8px;
  padding: 10px;
  background: #1a1a1a;
  border: 1px solid #2E2E2E;
  border-radius: 6px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.5;
  overflow-x: auto;
}

.fn-body__code {
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  font: inherit;
  color: inherit;
  white-space: pre-wrap;
  word-break: break-word;
}

.fn-body__code code {
  display: block;
  font: inherit;
  color: inherit;
  background: transparent;
}

.fn-body :deep(.hljs) {
  background: transparent;
  color: #EAEAEA;
  letter-spacing: 0.02em;
}

/* Function list */
.fn-list {
  border: 1px solid #2E2E2E;
  border-radius: 6px;
  overflow: hidden;
}

.fn-list-header {
  background: rgba(74, 158, 255, 0.1);
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #4A9EFF;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.fn-list-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid #2E2E2E;
}

.fn-list-name {
  color: #EAEAEA;
  font-family: 'Monaco', 'Courier New', monospace;
  font-weight: 600;
  font-size: 12px;
}

.fn-list-desc {
  color: #B3B3B3;
  font-size: 11px;
  grid-column: 1;
}

.fn-list-version {
  color: #4A9EFF;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  grid-column: 2;
  grid-row: 1 / 3;
  display: flex;
  align-items: center;
}

/* Version history */
.fn-versions {
  border: 1px solid #2E2E2E;
  border-radius: 6px;
  overflow: hidden;
}

.fn-versions-header {
  background: rgba(74, 158, 255, 0.1);
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #4A9EFF;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.version-row {
  display: flex;
  gap: 10px;
  padding: 8px 10px;
  border-top: 1px solid #2E2E2E;
}

.version-num {
  color: #4A9EFF;
  font-family: 'Monaco', 'Courier New', monospace;
  font-weight: 600;
  font-size: 12px;
  min-width: 40px;
}

.version-info {
  flex: 1;
}

.version-summary {
  color: #EAEAEA;
  font-size: 12px;
  margin-bottom: 3px;
}

.version-meta {
  color: #7A7A7A;
  font-size: 10px;
}

/* Error */
.fn-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: 6px;
  margin-top: 12px;
}

.error-icon {
  font-size: 16px;
}

.error-text {
  color: #F87171;
  font-size: 12px;
}

/* Diff view */
.fn-diff-section {
  margin-bottom: 12px;
}

.fn-diff-toggle {
  background: rgba(147, 197, 253, 0.1);
  border: 1px solid rgba(147, 197, 253, 0.3);
  color: #93C5FD;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  text-align: left;
  font-weight: 600;
}

.fn-diff-toggle:hover {
  background: rgba(147, 197, 253, 0.15);
}

.fn-diff {
  margin-top: 8px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  border: 1px solid #2E2E2E;
  border-radius: 6px;
  overflow: hidden;
}

.diff-side {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.diff-header {
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #2E2E2E;
}

.diff-header--old {
  background: rgba(248, 113, 113, 0.15);
  color: #F87171;
}

.diff-header--new {
  background: rgba(74, 222, 128, 0.15);
  color: #4ADE80;
}

.diff-body {
  padding: 10px;
  background: #1a1a1a;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.5;
  overflow-x: auto;
  flex: 1;
  white-space: pre; /* keep alignment */
  word-wrap: normal;
  color: #EAEAEA;
}

.diff-side:first-child {
  border-right: 1px solid #2E2E2E;
}

.diff-body :deep(.hljs) {
  background: transparent;
  color: inherit;
}

/* Side-by-side rows and line numbers */
.diff-line { display: flex; align-items: flex-start; gap: 8px; padding: 1px 4px; }
.diff-ln { display: inline-block; width: 36px; text-align: right; color: #7A7A7A; user-select: none; }
.diff-code {
  flex: 1;
  display: block;
  white-space: pre;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  color: #EAEAEA;
  background: transparent;
  padding: 0;
  margin: 0;
}
.diff-code:empty::after {
  content: '\00a0';
}
.is-add { background: rgba(74, 222, 128, 0.12); }
.is-del { background: rgba(248, 113, 113, 0.12); }
.is-same { background: transparent; }
.is-empty { opacity: 0.6; }
</style>
