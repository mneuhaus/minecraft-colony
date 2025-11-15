<template>
  <n-modal
    v-model:show="isOpen"
    preset="card"
    title="Issues"
    :style="{ width: '90%', maxWidth: '1200px', height: '85vh' }"
    :on-after-leave="() => $emit('close')"
  >
    <template #header-extra>
      <n-space>
        <n-button @click="refresh" secondary>
          <template #icon>
            <n-icon><RefreshOutline /></n-icon>
          </template>
          Refresh
        </n-button>
      </n-space>
    </template>

    <n-layout has-sider style="height: calc(85vh - 120px)">
      <n-layout-sider
        bordered
        :width="320"
        :native-scrollbar="false"
        style="background: var(--n-color)"
      >
        <n-scrollbar style="max-height: 100%">
          <n-space vertical :size="12" style="padding: 14px">
            <!-- Filter Section -->
            <n-card size="small" embedded>
              <n-space vertical :size="8">
                <n-text depth="3" style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px">Filter</n-text>
                <n-select
                  v-model:value="stateFilter"
                  :options="filterOptions"
                  size="small"
                />
              </n-space>
            </n-card>

            <!-- New Issue Section -->
            <n-card size="small" embedded>
              <n-space vertical :size="8">
                <n-text depth="3" style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px">New Issue</n-text>
                <n-input
                  v-model:value="newTitle"
                  placeholder="Title"
                  size="small"
                />
                <n-input
                  v-model:value="newDescription"
                  type="textarea"
                  placeholder="Description (markdown)"
                  :rows="3"
                  size="small"
                />
                <n-select
                  v-model:value="newSeverity"
                  :options="severityOptions"
                  size="small"
                />
                <n-select
                  v-model:value="newIssueBot"
                  :options="botOptions"
                  size="small"
                />
                <n-button
                  type="warning"
                  :disabled="!canCreate"
                  @click="createIssue"
                  block
                  size="small"
                >
                  Create
                </n-button>
              </n-space>
            </n-card>

            <!-- Issue List -->
            <n-card size="small" embedded style="flex: 1">
              <n-scrollbar style="max-height: 400px">
                <n-space vertical :size="8">
                  <n-card
                    v-for="issue in filteredIssues"
                    :key="issue.id"
                    size="small"
                    :class="{ 'issue-active': issue.id === selectedIssueId }"
                    @click="selectIssue(issue.id)"
                    hoverable
                    embedded
                    style="cursor: pointer"
                  >
                    <n-space vertical :size="4">
                      <n-text strong>{{ issue.title }}</n-text>
                      <n-space :size="6">
                        <n-tag :type="getStateType(issue.state)" size="small">
                          {{ formatState(issue.state) }}
                        </n-tag>
                        <n-tag :type="getSeverityType(issue.severity)" size="small">
                          {{ issue.severity }}
                        </n-tag>
                      </n-space>
                      <n-text depth="3" style="font-size: 13px">
                        {{ issue.bot_name || '—' }} • {{ formatTimestamp(issue.updated_at) }}
                      </n-text>
                    </n-space>
                  </n-card>
                  <n-empty v-if="!filteredIssues.length" description="No issues" size="small" />
                </n-space>
              </n-scrollbar>
            </n-card>
          </n-space>
        </n-scrollbar>
      </n-layout-sider>

      <n-layout-content :native-scrollbar="false" style="padding: 16px 20px">
        <n-scrollbar style="max-height: 100%">
          <div v-if="detail">
            <!-- Header -->
            <n-space vertical :size="12">
              <n-card embedded>
                <n-space justify="space-between" align="start">
                  <n-space vertical :size="4">
                    <n-h3 style="margin: 0">{{ detail.issue.title }}</n-h3>
                    <n-text depth="3">
                      {{ detail.issue.bot_name || 'Unassigned' }} • Created {{ formatTimestamp(detail.issue.created_at) }}
                    </n-text>
                  </n-space>
                  <n-space :size="8">
                    <n-select
                      v-model:value="localState"
                      :options="stateOptions"
                      @update:value="updateState"
                      style="width: 140px"
                      size="small"
                    />
                    <n-select
                      v-model:value="localAssignment"
                      :options="assignmentOptions"
                      @update:value="assign"
                      placeholder="Assign…"
                      style="width: 140px"
                      size="small"
                    />
                    <n-button
                      :disabled="!activeBot"
                      @click="assignCurrentBot"
                      size="small"
                      secondary
                    >
                      Assign to {{ activeBot || 'bot' }}
                    </n-button>
                  </n-space>
                </n-space>
              </n-card>

              <!-- Description -->
              <n-card title="Bug Description" embedded>
                <div class="markdown-content" v-html="renderedDescription"></div>
              </n-card>

              <!-- Comments -->
              <n-card title="Comments" embedded>
                <n-space vertical :size="12">
                  <n-empty v-if="!detail.comments.length" description="No comments yet" size="small" />
                  <div v-for="comment in detail.comments" :key="comment.id">
                    <n-card size="small" embedded>
                      <template #header>
                        <n-text depth="3" style="font-size: 13px">
                          {{ comment.author || 'system' }} • {{ formatTimestamp(comment.created_at) }}
                        </n-text>
                      </template>
                      <div class="markdown-content" v-html="renderMarkdown(comment.body)"></div>
                    </n-card>
                  </div>
                  <n-space vertical :size="8">
                    <n-input
                      v-model:value="newComment"
                      type="textarea"
                      placeholder="Add comment (markdown)"
                      :rows="3"
                    />
                    <n-space justify="end">
                      <n-button
                        :disabled="!newComment.trim()"
                        @click="addComment"
                        type="primary"
                      >
                        Comment
                      </n-button>
                    </n-space>
                  </n-space>
                </n-space>
              </n-card>
            </n-space>
          </div>
          <n-empty
            v-else
            description="Select an issue to view details"
            style="margin-top: 100px"
          >
            <template #icon>
              <n-text style="font-size: 48px">🐞</n-text>
            </template>
          </n-empty>
        </n-scrollbar>
      </n-layout-content>
    </n-layout>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { marked } from 'marked';
import {
  NModal,
  NLayout,
  NLayoutSider,
  NLayoutContent,
  NCard,
  NSpace,
  NButton,
  NInput,
  NSelect,
  NTag,
  NText,
  NH3,
  NEmpty,
  NScrollbar,
  NIcon
} from 'naive-ui';
import { RefreshOutline } from '@vicons/ionicons5';

const props = defineProps<{
  open: boolean;
  items: any[];
  activeBot: string | null;
  bots: string[];
}>();

const emits = defineEmits(['close', 'refresh']);

const states = ['open', 'triage', 'in_progress', 'testing', 'resolved', 'closed'];
const isOpen = ref(false);
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

const filterOptions = computed(() => [
  { label: 'All states', value: 'all' },
  ...states.map(s => ({ label: formatState(s), value: s }))
]);

const severityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' }
];

const botOptions = computed(() => [
  { label: 'Any bot', value: '' },
  ...bots.value.map(b => ({ label: b, value: b }))
]);

const stateOptions = states.map(s => ({ label: formatState(s), value: s }));

const assignmentOptions = computed(() => [
  { label: 'System', value: 'system' },
  { label: 'Unassigned', value: 'none' },
  ...bots.value.map(b => ({ label: b, value: b }))
]);

const renderedDescription = computed(() => detail.value ? renderMarkdown(detail.value.issue.description) : '');
const canCreate = computed(() => newTitle.value.trim().length >= 5 && newDescription.value.trim().length >= 10);

watch(() => props.open, (open) => {
  isOpen.value = open;
  if (open) {
    if (!issues.value.length) refresh();
    else selectFirst();
  } else {
    selectedIssueId.value = null;
    detail.value = null;
  }
});

watch(isOpen, (open) => {
  if (!open) emits('close');
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

function getStateType(state: string): 'default' | 'info' | 'success' | 'warning' | 'error' {
  switch (state) {
    case 'open': return 'warning';
    case 'triage': return 'info';
    case 'in_progress': return 'info';
    case 'testing': return 'info';
    case 'resolved':
    case 'closed': return 'success';
    default: return 'default';
  }
}

function getSeverityType(severity: string): 'default' | 'info' | 'success' | 'warning' | 'error' {
  switch (severity) {
    case 'low': return 'default';
    case 'medium': return 'info';
    case 'high': return 'warning';
    case 'critical': return 'error';
    default: return 'default';
  }
}

onMounted(() => {
  newIssueBot.value = props.activeBot || '';
});
</script>

<style scoped>
.issue-active {
  border-color: var(--n-border-color-hover) !important;
  box-shadow: 0 0 0 2px rgba(233, 109, 47, 0.2);
}

.markdown-content :deep(p) {
  margin-bottom: 10px;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3) {
  margin: 12px 0 6px;
  font-weight: 600;
}

.markdown-content :deep(pre) {
  background: var(--n-color-embedded);
  padding: 8px;
  border-radius: 6px;
  overflow-x: auto;
  white-space: pre-wrap;
}

.markdown-content :deep(code) {
  background: var(--n-color-embedded);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin-left: 20px;
  margin-bottom: 10px;
}
</style>
