<template>
  <div class="sidebar-missions">
    <div class="missions-header">
      <h3>Core Missions</h3>
      <n-button size="tiny" @click="showAddModal = true" quaternary>
        <template #icon>
          <n-icon :component="AddCircleOutline" />
        </template>
        Add
      </n-button>
    </div>

    <div v-if="missions.length === 0" class="empty-state">
      No core missions set
    </div>

    <div v-else class="mission-list">
      <div
        v-for="mission in missions"
        :key="mission.id"
        class="mission-item"
      >
        <div class="mission-content">
          <div class="mission-text">{{ mission.content }}</div>
          <div v-if="mission.description" class="mission-description">
            {{ mission.description }}
          </div>
        </div>
        <div class="mission-actions">
          <n-button size="tiny" text @click="editMission(mission)">
            <n-icon :component="CreateOutline" />
          </n-button>
          <n-button size="tiny" text @click="deleteMission(mission.id)" type="error">
            <n-icon :component="TrashOutline" />
          </n-button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <n-modal
      v-model:show="showAddModal"
      preset="card"
      title="Core Mission"
      style="width: 500px"
    >
      <n-form>
        <n-form-item label="Mission">
          <n-input
            v-model:value="editingMission.content"
            placeholder="What should the bot work on?"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </n-form-item>
        <n-form-item label="Description (optional)">
          <n-input
            v-model:value="editingMission.description"
            placeholder="Additional details..."
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </n-form-item>
        <n-form-item label="Priority">
          <n-input-number
            v-model:value="editingMission.priority"
            :min="0"
            :max="100"
            placeholder="0 = lowest, 100 = highest"
            style="width: 100%"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showAddModal = false">Cancel</n-button>
          <n-button type="primary" @click="saveMission" :loading="saving">
            Save
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { NIcon, NButton, NModal, NForm, NFormItem, NInput, NInputNumber, NSpace, useMessage } from 'naive-ui';
import { AddCircleOutline, CreateOutline, TrashOutline } from '@vicons/ionicons5';

const message = useMessage();
const missions = ref<any[]>([]);
const showAddModal = ref(false);
const saving = ref(false);
const editingMission = ref<any>({
  id: null,
  content: '',
  description: '',
  priority: 0
});

async function loadMissions() {
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
        return;
      }
    }

    const response = await fetch(`/api/bots/${botName}/missions`);
    const data = await response.json();

    if (data.ok && data.missions) {
      missions.value = data.missions;
    }
  } catch (err) {
    console.error('Failed to load missions:', err);
    message.error('Failed to load missions');
  }
}

function editMission(mission: any) {
  editingMission.value = {
    id: mission.id,
    content: mission.content,
    description: mission.description || '',
    priority: mission.priority || 0
  };
  showAddModal.value = true;
}

async function saveMission() {
  try {
    saving.value = true;

    const urlParams = new URLSearchParams(window.location.search);
    let botName = urlParams.get('bot');

    if (!botName) {
      const botsResponse = await fetch('/api/bots');
      const bots = await botsResponse.json();
      if (bots.length > 0) {
        botName = bots[0].name;
      }
    }

    if (!editingMission.value.content.trim()) {
      message.error('Mission content is required');
      return;
    }

    const isEdit = editingMission.value.id !== null;
    const url = isEdit
      ? `/api/bots/${botName}/missions/${editingMission.value.id}`
      : `/api/bots/${botName}/missions`;

    const response = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: editingMission.value.content,
        description: editingMission.value.description || null,
        priority: editingMission.value.priority || 0
      })
    });

    const data = await response.json();

    if (data.ok) {
      message.success(isEdit ? 'Mission updated' : 'Mission added');
      showAddModal.value = false;
      editingMission.value = { id: null, content: '', description: '', priority: 0 };
      await loadMissions();
    } else {
      message.error(data.error || 'Failed to save mission');
    }
  } catch (err) {
    console.error('Failed to save mission:', err);
    message.error('Failed to save mission');
  } finally {
    saving.value = false;
  }
}

async function deleteMission(id: number) {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    let botName = urlParams.get('bot');

    if (!botName) {
      const botsResponse = await fetch('/api/bots');
      const bots = await botsResponse.json();
      if (bots.length > 0) {
        botName = bots[0].name;
      }
    }

    const response = await fetch(`/api/bots/${botName}/missions/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.ok) {
      message.success('Mission deleted');
      await loadMissions();
    } else {
      message.error(data.error || 'Failed to delete mission');
    }
  } catch (err) {
    console.error('Failed to delete mission:', err);
    message.error('Failed to delete mission');
  }
}

onMounted(() => {
  loadMissions();
});
</script>

<style scoped>
.sidebar-missions {
  padding: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 16px;
}

.missions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.missions-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text);
  opacity: 0.9;
}

.empty-state {
  padding: 12px;
  text-align: center;
  color: var(--color-text);
  opacity: 0.5;
  font-size: 13px;
  font-style: italic;
}

.mission-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mission-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  border-left: 3px solid var(--color-accent);
  transition: all 0.2s ease;
}

.mission-item:hover {
  background: rgba(0, 0, 0, 0.3);
}

.mission-content {
  flex: 1;
  min-width: 0;
}

.mission-text {
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-text);
  font-weight: 500;
  word-wrap: break-word;
}

.mission-description {
  font-size: 12px;
  line-height: 1.3;
  color: var(--color-text);
  opacity: 0.7;
  margin-top: 4px;
  word-wrap: break-word;
}

.mission-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
</style>
