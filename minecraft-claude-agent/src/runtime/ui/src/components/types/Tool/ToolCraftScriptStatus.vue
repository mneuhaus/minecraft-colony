<template>
  <MessageBlock
    eyebrow="CraftScript"
    title="Status"
    :tone="tone"
    padding="sm"
  >
    <template #meta>
      <span class="status-badge">{{ status.state }}</span>
    </template>

    <div class="grid">
      <div class="k">job</div><div class="v mono">{{ status.id || '—' }}</div>
      <div class="k">duration</div><div class="v mono">{{ status.duration_ms }} ms</div>
      <template v-if="status.error">
        <div class="k">error</div><div class="v mono">{{ status.error.type }} — {{ status.error.message }}</div>
        <div class="k" v-if="status.error.op">command</div><div class="v mono" v-if="status.error.op">{{ status.error.op }}</div>
        <div class="k" v-if="status.error.line">line</div><div class="v mono" v-if="status.error.line">{{ status.error.line }}:{{ status.error.column || 1 }}</div>
      </template>
    </div>

    <pre class="script" v-if="status.script"><code>{{ status.script }}</code></pre>
  </MessageBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MessageBlock from '../../MessageBlock.vue';

const props = defineProps<{ item: any }>();

const raw = computed(()=>{
  let out = props.item?.payload?.output;
  try { if (typeof out === 'string') out = JSON.parse(out); } catch {}
  try { if (typeof out === 'string') out = JSON.parse(out); } catch {}
  return out || {};
});

const status = computed(()=> {
  const o:any = raw.value || {};
  const id = o.id || o.job_id || props.item?.payload?.params_summary?.job_id || '';
  const state = o.state || 'unknown';
  const duration_ms = o.duration_ms ?? 0;
  const script = o.script || '';
  const error = o.error || null;
  return { id, state, duration_ms, script, error };
});

const tone = computed(() => {
  const state = status.value.state.toLowerCase();
  if (state === 'failed' || state === 'error') return 'danger';
  if (state === 'completed' || state === 'ok') return 'success';
  if (state === 'running' || state === 'queued') return 'info';
  return 'neutral';
});
</script>

<style scoped>
.status-badge {
  padding: 2px var(--spacing-sm);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  font-size: var(--font-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
}

.grid {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: var(--spacing-xs) var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-sm);
}

.k {
  color: var(--color-text-muted);
  text-transform: lowercase;
}

.v {
  color: var(--color-text-primary);
}

.mono {
  font-family: 'Monaco','Menlo','Courier New',monospace;
}

.script {
  margin-top: var(--spacing-sm);
  background: var(--color-bg-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--spacing-sm);
  color: #c9d1d9;
  max-height: 200px;
  overflow: auto;
  font-size: var(--font-sm);
}
</style>
