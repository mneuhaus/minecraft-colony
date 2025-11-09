<template>
  <div v-if="open" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content issues-modal" @click.stop>
      <div class="modal-header">
        <h2>Issues</h2>
        <div class="modal-actions">
          <button class="btn" @click="refresh">Refresh</button>
          <button class="modal-close" @click="$emit('close')">×</button>
        </div>
      </div>
      <div class="modal-body">
        <aside class="modal-sidebar">
          <div class="sidebar-section">
            <label class="sidebar-label">Filter</label>
            <select class="input" v-model="stateFilter">
              <option value="all">All states</option>
              <option v-for="state in states" :key="state" :value="state">{{ formatState(state) }}</option>
            </select>
          </div>
          <div class="sidebar-section">
            <label class="sidebar-label">New Issue</label>
            <input class="input" placeholder="Title" v-model="newTitle" />
            <textarea class="input" rows="3" placeholder="Description (markdown)" v-model="newDescription"></textarea>
            <select class="input" v-model="newSeverity">
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select class="input" v-model="newIssueBot">
              <option :value="''">Any bot</option>
              <option v-for="bot in bots" :key="bot" :value="bot">{{ bot }}</option>
            </select>
            <button class="btn btn-create" :disabled="!canCreate" @click="createIssue">Create</button>
          </div>
          <div class="sidebar-list">
            <div
              v-for="issue in filteredIssues"
              :key="issue.id"
              class="issue-item"
              :class="{ 'issue-item--active': issue.id === selectedIssueId }"
              @click="selectIssue(issue.id)"
            >
              <div class="issue-item__title">{{ issue.title }}</div>
              <div class="issue-item__meta">
                <span class="pill" :data-state="issue.state">{{ formatState(issue.state) }}</span>
                <span class="pill" :data-severity="issue.severity">{{ issue.severity }}</span>
              </div>
              <div class="issue-item__sub">{{ issue.bot_name || '—' }} • {{ formatTimestamp(issue.updated_at) }}</div>
            </div>
            <div v-if="!filteredIssues.length" class="sidebar-empty">No issues</div>
          </div>
        </aside>
        <main class="modal-main">
          <div v-if="detail" class="issue-detail">
            <header class="detail-header">
              <div>
                <h3>{{ detail.issue.title }}</h3>
                <p class="detail-sub">{{ detail.issue.bot_name || 'Unassigned' }} • Created {{ formatTimestamp(detail.issue.created_at) }}</p>
              </div>
              <div class="detail-controls">
                <select class="input" v-model="localState" @change="updateState">
                  <option v-for="state in states" :key="state" :value="state">{{ formatState(state) }}</option>
                </select>
                <select class="input" v-model="localAssignment" @change="assign">
                  <option value="">Assign…</option>
                  <option value="system">System</option>
                  <option value="none">Unassigned</option>
                  <option v-for="bot in bots" :key="`assign-${bot}`" :value="bot">{{ bot }}</option>
                </select>
                <button class="btn" @click="assignCurrentBot" :disabled="!activeBot">Assign to {{ activeBot || 'bot' }}</button>
              </div>
            </header>
            <div class="detail-scroll">
              <section class="detail-description" v-html="renderedDescription"></section>
              <section class="detail-comments">
                <h4>Comments</h4>
                <div v-if="!detail.comments.length" class="comments-empty">No comments yet.</div>
                <div v-for="comment in detail.comments" :key="comment.id" class="comment">
                  <div class="comment-meta">{{ comment.author || 'system' }} • {{ formatTimestamp(comment.created_at) }}</div>
                  <div class="comment-body" v-html="renderMarkdown(comment.body)"></div>
                </div>
                <textarea class="input" rows="3" placeholder="Add comment (markdown)" v-model="newComment"></textarea>
                <div class="detail-actions">
                  <button class="btn" :disabled="!newComment.trim()" @click="addComment">Comment</button>
                </div>
              </section>
            </div>
          </div>
          <div v-else class="detail-empty">
            <div class="empty-icon">🐞</div>
            <div class="empty-text">Select an issue to view details</div>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { marked } from 'marked';

const props = defineProps<{
  open: boolean;
  items: any[];
  activeBot: string | null;
  bots: string[];
}>();

const emits = defineEmits(['close', 'refresh']);

const states = ['open', 'triage', 'in_progress', 'testing', 'resolved', 'closed'];
const stateFilter = ref('all');
const selectedIssueId = ref<number | null>(null);
const detail = ref<any>(null);
const loadingDetail = ref(false);
const newTitle = ref('');
const newDescription = ref('');
const newSeverity = ref('medium');
const newIssueBot = ref('');
const newComment = ref('');
const localState = ref('open');
const localAssignment = ref('');

const bots = computed(() => props.bots || []);
const issues = computed(() => props.items || []);

const filteredIssues = computed(() => {
  if (stateFilter.value === 'all') return issues.value;
  return issues.value.filter((i) => i.state === stateFilter.value);
});

const renderedDescription = computed(() => detail.value ? renderMarkdown(detail.value.issue.description) : '');
const canCreate = computed(() => newTitle.value.trim().length >= 5 && newDescription.value.trim().length >= 10);

watch(() => props.open, (open) => {
  if (open) {
    if (!issues.value.length) refresh();
    else selectFirst();
  } else {
    selectedIssueId.value = null;
    detail.value = null;
  }
});

watch(issues, () => {
  if (selectedIssueId.value && !issues.value.find((i) => i.id === selectedIssueId.value)) {
    selectFirst();
  }
});

watch(() => props.activeBot, (bot) => {
  if (!newIssueBot.value) newIssueBot.value = bot || '';
});

function selectFirst() {
  if (issues.value.length) {
    selectIssue(issues.value[0].id);
  }
}

async function loadDetail(id: number) {
  loadingDetail.value = true;
  try {
    const res = await fetch(`/api/issues/${id}`);
    detail.value = await res.json();
    localState.value = detail.value.issue.state;
    localAssignment.value = detail.value.issue.assigned_bot_name || (detail.value.issue.assigned_to === 'system' ? 'system' : '');
  } catch (error) {
    console.error('Failed to load issue detail', error);
    detail.value = null;
  } finally {
    loadingDetail.value = false;
  }
}

function selectIssue(id: number) {
  selectedIssueId.value = id;
  loadDetail(id);
}

async function refresh() {
  emits('refresh');
  if (selectedIssueId.value) await loadDetail(selectedIssueId.value);
}

async function createIssue() {
  if (!canCreate.value) return;
  try {
    await fetch('/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.value.trim(),
        description: newDescription.value.trim(),
        severity: newSeverity.value,
        bot: newIssueBot.value || props.activeBot || undefined
      })
    });
    newTitle.value = '';
    newDescription.value = '';
    newSeverity.value = 'medium';
    newIssueBot.value = props.activeBot || '';
    await refresh();
  } catch (error) {
    console.error('Failed to create issue', error);
  }
}

async function updateState() {
  if (!selectedIssueId.value) return;
  try {
    await fetch(`/api/issues/${selectedIssueId.value}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: localState.value })
    });
    await refresh();
  } catch (error) {
    console.error('Failed to update state', error);
  }
}

async function assign() {
  if (!selectedIssueId.value || !localAssignment.value) return;
  try {
    let payload: any = {};
    if (localAssignment.value === 'system') {
      payload = { assigned_to: 'system', assigned_bot: null, state: 'triage' };
    } else if (localAssignment.value === 'none') {
      payload = { assigned_to: 'human', assigned_bot: null, state: 'open' };
    } else {
      payload = { assigned_bot: localAssignment.value, state: 'testing' };
    }
    await fetch(`/api/issues/${selectedIssueId.value}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    await refresh();
  } catch (error) {
    console.error('Failed to assign bot', error);
  }
}

async function assignCurrentBot() {
  if (!props.activeBot || !selectedIssueId.value) return;
  localAssignment.value = props.activeBot;
  await assign();
}

async function addComment() {
  if (!selectedIssueId.value || !newComment.value.trim()) return;
  try {
    await fetch(`/api/issues/${selectedIssueId.value}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: newComment.value.trim(), author: 'system' })
    });
    newComment.value = '';
    await refresh();
  } catch (error) {
    console.error('Failed to add comment', error);
  }
}

function formatTimestamp(ts: number) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}

function formatState(state: string) {
  return state.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function renderMarkdown(text: string) {
  return marked.parse(text || '');
}

onMounted(() => {
  newIssueBot.value = props.activeBot || '';
});
</script>


<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.issues-modal {
  width: 90%;
  max-width: 1200px;
  height: 85vh;
  border: 1px solid #2E2E2E;
  border-radius: 12px;
  background: linear-gradient(135deg, #1d1a1a 0%, #111113 60%);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #2E2E2E;
}

.modal-actions { display: flex; gap: 8px; align-items: center; }
.modal-close { background: none; border: none; color: #EAEAEA; font-size: 28px; cursor: pointer; border-radius: 6px; width: 32px; height: 32px; }
.modal-close:hover { background: rgba(255,255,255,0.08); }

.modal-body { display: flex; flex: 1; overflow: hidden; }

.modal-sidebar {
  width: 310px;
  border-right: 1px solid #2E2E2E;
  background: #171515;
  display: flex;
  flex-direction: column;
  padding: 14px;
  gap: 14px;
}

.sidebar-section,
.sidebar-list {
  background: #1e1b1b;
  border: 1px solid #2b2626;
  border-radius: 10px;
  padding: 12px;
}

.sidebar-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.sidebar-label { font-size: 13px; text-transform: uppercase; letter-spacing: 0.6px; color: #a6a1a1; }

.issue-item {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #2E2E2E;
  background: #1d1d1d;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s;
}
.issue-item:hover { border-color: #e96d2f; }
.issue-item--active { border-color: #e96d2f; box-shadow: 0 0 0 1px rgba(233,109,47,0.35); }
.issue-item__title { font-weight: 600; color: #EAEAEA; margin-bottom: 4px; }
.issue-item__meta { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
.issue-item__sub { color: #8f8e8e; font-size: 13px; }

.pill { font-size: 12px; padding: 2px 8px; border-radius: 999px; border: 1px solid transparent; text-transform: uppercase; }
.pill[data-state="open"] { background: rgba(233,109,47,0.15); color: #f48c53; border-color: rgba(233,109,47,0.4); }
.pill[data-state="triage"] { background: rgba(251,191,36,0.15); color: #FBBF24; }
.pill[data-state="in_progress"] { background: rgba(251,191,36,0.1); color: #f6d481; }
.pill[data-state="testing"] { background: rgba(96,165,250,0.15); color: #93C5FD; }
.pill[data-state="resolved"], .pill[data-state="closed"] { background: rgba(74,222,128,0.15); color: #4ADE80; }
.pill[data-severity="high"], .pill[data-severity="critical"] { background: rgba(248,113,113,0.18); color: #F87171; }

.modal-main { flex: 1; padding: 16px 20px; overflow-y: auto; }
.issue-detail { display: flex; flex-direction: column; gap: 16px; height: 100%; }
.detail-scroll { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding-right: 6px; }
.detail-header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #302828; padding-bottom: 12px; }
.detail-sub { color: #b6a9a2; font-size: 14px; margin-top: 4px; }
.detail-controls { display: flex; gap: 8px; }
.detail-description { background: #131111; border: 1px solid #2b2626; border-radius: 10px; padding: 14px; min-height: 140px; }
.detail-description :deep(p) { margin-bottom: 10px; }
.detail-description :deep(h1), .detail-description :deep(h2), .detail-description :deep(h3) { margin: 12px 0 6px; font-weight: 600; }
.detail-description :deep(pre) { background: #0d0d0d; padding: 8px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; }
.detail-comments { background: #131111; border: 1px solid #2b2626; border-radius: 10px; padding: 14px; }
.comment { border-bottom: 1px solid #2b2626; padding: 10px 0; }
.comment:last-child { border-bottom: none; }
.comment-meta { font-size: 13px; color: #8a8585; margin-bottom: 6px; }
.comment-body { font-size: 14px; }
.comment-body :deep(p) { margin-bottom: 6px; }
.comment-body :deep(h1), .comment-body :deep(h2), .comment-body :deep(h3) { margin: 12px 0 6px; font-weight: 600; font-size: 15px; }
.comments-empty { font-size: 14px; color: #7A7A7A; margin-bottom: 8px; }
.detail-actions { margin-top: 10px; display: flex; justify-content: flex-end; }
.detail-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; color: #7A7A7A; }
.empty-icon { font-size: 42px; }
.sidebar-empty { text-align: center; color: #7A7A7A; margin-top: 20px; font-style: italic; }

.btn { border: 1px solid #2E2E2E; background: #232020; color: #EAEAEA; padding: 6px 12px; border-radius: 8px; cursor: pointer; }
.btn-create { background: #e96d2f; border-color: #e96d2f; color: #fff; font-weight: 600; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.input, textarea.input { width: 100%; background: #111; border: 1px solid #2E2E2E; border-radius: 8px; padding: 6px 10px; color: #fff; font-size: 14px; }
</style>
