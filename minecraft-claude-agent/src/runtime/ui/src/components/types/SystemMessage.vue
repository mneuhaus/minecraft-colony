<template>
  <div class="system-block">
    <p class="system-text">{{ message }}</p>
    <n-button
      v-if="jobId"
      size="tiny"
      quaternary
      @click="openDetail"
    >View CraftScript</n-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NButton } from 'naive-ui';
import { useRouter } from 'vue-router';
import { deriveJobIdFromEvent } from '../../utils/craftscriptJob';

const props = defineProps<{ item: any }>();
const router = useRouter();

const level = computed(() => String(props.item.payload?.level || '').toLowerCase());

const tone = computed(() => {
  if (level.value === 'warn') return 'warning';
  if (level.value === 'error') return 'danger';
  return 'info';
});

const message = computed(() => props.item.payload?.message || '');
const jobId = computed(() => deriveJobIdFromEvent(props.item));

function openDetail() {
  const job = jobId.value;
  if (!job) return;
  router.push({ name: 'CraftscriptDetails', params: { jobId: job } }).catch(() => {});
}
</script>

<style scoped>
.system-block {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.system-text {
  line-height: 1.6;
  opacity: 0.9;
  flex: 1;
  margin: 0;
}
</style>
