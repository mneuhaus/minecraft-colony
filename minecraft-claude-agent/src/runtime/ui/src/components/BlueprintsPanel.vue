<template>
  <div class="bps">
    <div class="bps__hdr">
      <span class="bps__title">Blueprints</span>
      <button class="bps__refresh" @click="$emit('refresh')">Refresh</button>
    </div>
    <div class="bps__create">
      <input class="bps__input" v-model="name" placeholder="name" />
      <input class="bps__input" v-model="description" placeholder="description (optional)" />
      <button class="bps__btn" @click="create" :disabled="!name.trim()">Create</button>
    </div>
    <div class="bps__list" v-if="items.length">
      <div v-for="bp in items" :key="bp.name" class="bps__row">
        <div class="bps__meta">
          <div class="bps__name">{{ bp.name }}</div>
          <div class="bps__desc">{{ bp.description || '—' }}</div>
        </div>
        <div class="bps__stats">{{ bp.count }} vox</div>
        <div class="bps__actions">
          <button class="bps__btn" @click="$emit('view', bp.name)">View</button>
          <button class="bps__btn bps__btn--danger" @click="$emit('remove', bp.name)">Remove</button>
        </div>
      </div>
    </div>
    <div v-else class="bps__empty">No blueprints yet.</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const props = defineProps<{ items: any[] }>();
const emits = defineEmits(['refresh','view','remove','create']);
const name = ref('');
const description = ref('');
async function create(){
  emits('create', { name: name.value.trim(), description: description.value.trim() || undefined });
  name.value=''; description.value='';
}
</script>

<style scoped>
.bps { border: 1px solid #2E2E2E; border-radius: 8px; padding: 10px; background: #1f1f1f; display: flex; flex-direction: column; gap: 8px; }
.bps__hdr { display:flex; justify-content: space-between; align-items:center; }
.bps__title { font-weight: 600; }
.bps__refresh { background:#2a2a2a; color:#eaeaea; border:1px solid #2e2e2e; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:11px; }
.bps__create { display:flex; gap:6px; }
.bps__input { flex:1; background:#2a2a2a; color:#eaeaea; border:1px solid #2e2e2e; border-radius:6px; padding:6px; min-width:0; }
.bps__btn { background:#2a2a2a; color:#eaeaea; border:1px solid #2e2e2e; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:11px; }
.bps__btn--danger { border-color:#5a2a2a; background:#3a1a1a; }
.bps__list { display:flex; flex-direction:column; gap:6px; }
.bps__row { display:grid; grid-template-columns: 1fr auto; gap:8px; align-items:center; border:1px solid #2e2e2e; border-radius:6px; padding:8px; }
.bps__meta { display:flex; flex-direction:column; gap:2px; }
.bps__name { font-weight:600; }
.bps__desc { color:#9a9a9a; font-size:12px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.bps__stats { color:#b3b3b3; font-size:11px; }
.bps__actions { display:flex; gap:6px; justify-self:end; }
.bps__empty { color:#7a7a7a; font-size:12px; }

@media (max-width: 340px) {
  .bps__row { grid-template-columns: 1fr; }
  .bps__actions { justify-self:start; }
}
</style>
