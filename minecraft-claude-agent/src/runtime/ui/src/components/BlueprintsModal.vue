<template>
  <div v-if="open" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Blueprints</h2>
        <button class="modal-close" @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <aside class="modal-sidebar">
          <div class="sidebar-header">
            <button class="btn btn-refresh" @click="$emit('refresh')">Refresh</button>
          </div>
          <div class="sidebar-create">
            <input class="input" v-model="name" placeholder="name" @keyup.enter="create" />
            <input class="input" v-model="description" placeholder="description (optional)" @keyup.enter="create" />
            <button class="btn btn-create" @click="create" :disabled="!name.trim()">Create</button>
          </div>
          <div class="sidebar-list">
            <div
              v-for="bp in items"
              :key="bp.name"
              class="bp-item"
              :class="{ 'bp-item--active': selectedBlueprint?.name === bp.name }"
              @click="selectBlueprint(bp)"
            >
              <div class="bp-item__name">{{ bp.name }}</div>
              <div class="bp-item__vox">{{ bp.count }} vox</div>
            </div>
            <div v-if="!items.length" class="sidebar-empty">No blueprints yet.</div>
          </div>
        </aside>
        <main class="modal-main">
          <div v-if="selectedBlueprint" class="detail">
            <div class="detail-header">
              <div>
                <h3 class="detail-title">{{ selectedBlueprint.name }}</h3>
                <p class="detail-desc">{{ selectedBlueprint.description || 'No description' }}</p>
              </div>
              <div class="detail-actions">
                <button class="btn btn-danger" @click="handleRemove(selectedBlueprint.name)">Remove</button>
              </div>
            </div>
            <div class="detail-body">
              <div class="detail-meta">
                <div class="meta-item">
                  <span class="meta-label">Voxels:</span>
                  <span class="meta-value">{{ selectedBlueprint.count }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Updated:</span>
                  <span class="meta-value">{{ formatDate(selectedBlueprint.updated) }}</span>
                </div>
              </div>
              <BlueprintDetail :name="selectedBlueprint.name" :data="blueprintData" :embedded="true" />
            </div>
          </div>
          <div v-else class="detail-empty">
            <div class="empty-icon">📦</div>
            <div class="empty-text">Select a blueprint to view details</div>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import BlueprintDetail from './BlueprintDetail.vue';

const props = defineProps<{
  open: boolean;
  items: any[];
}>();

const emits = defineEmits(['close', 'refresh', 'view', 'remove', 'create']);

const name = ref('');
const description = ref('');
const selectedBlueprint = ref<any>(null);
const blueprintData = ref<any>(null);

async function create() {
  if (!name.value.trim()) return;
  emits('create', { name: name.value.trim(), description: description.value.trim() || undefined });
  name.value = '';
  description.value = '';
}

async function selectBlueprint(bp: any) {
  selectedBlueprint.value = bp;
  // Fetch blueprint data
  try {
    const res = await fetch(`/api/blueprints/${encodeURIComponent(bp.name)}`);
    blueprintData.value = await res.json();
  } catch {
    blueprintData.value = null;
  }
}

async function handleRemove(bpName: string) {
  if (!confirm(`Remove blueprint "${bpName}"?`)) return;
  emits('remove', bpName);
  if (selectedBlueprint.value?.name === bpName) {
    selectedBlueprint.value = null;
    blueprintData.value = null;
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

// Auto-select first blueprint when modal opens
watch(() => props.open, (isOpen) => {
  if (isOpen && props.items.length > 0 && !selectedBlueprint.value) {
    selectBlueprint(props.items[0]);
  }
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #202020;
  border: 1px solid #2E2E2E;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
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

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #EAEAEA;
}

.modal-close {
  background: none;
  border: none;
  color: #EAEAEA;
  font-size: 28px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.2s;
}

.modal-close:hover {
  background: #2A2A2A;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}
</style>
