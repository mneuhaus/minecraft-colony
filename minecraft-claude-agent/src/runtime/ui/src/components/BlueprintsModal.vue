<template>
  <div v-if="open" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Blueprints</h2>
        <button class="modal-close" @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <BlueprintsPanel :items="items" @refresh="$emit('refresh')" @view="$emit('view', $event)" @remove="$emit('remove', $event)" @create="$emit('create', $event)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BlueprintsPanel from './BlueprintsPanel.vue';

defineProps<{
  open: boolean;
  items: any[];
}>();

defineEmits(['close', 'refresh', 'view', 'remove', 'create']);
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
