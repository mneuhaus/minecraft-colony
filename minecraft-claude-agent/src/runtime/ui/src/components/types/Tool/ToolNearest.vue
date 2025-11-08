<template>
  <MessageBlock
    eyebrow="Spatial"
    title="Nearest"
    :tone="rows.length ? 'info' : 'neutral'"
    padding="md"
  >
    <template #meta>
      <span class="query-chip">query {{ query }}</span>
      <span class="query-chip" v-if="rows.length">{{ rows.length }} match{{ rows.length === 1 ? '' : 'es' }}</span>
    </template>

    <table v-if="rows.length" class="nearest-table">
      <thead>
        <tr>
          <th>dist</th>
          <th>reachable</th>
          <th>world</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows.slice(0,5)" :key="r.key">
          <td class="td-dist">{{ r.dist }}</td>
          <td class="td-reach">{{ r.reach }}</td>
          <td class="td-world">{{ r.world }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="query-val">No matches for query</div>
  </MessageBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MessageBlock from '../../MessageBlock.vue';
const props = defineProps<{ item: any }>();
const p = computed(()=> props.item.payload?.params_summary ?? props.item.payload?.input ?? {});
const out = computed(()=> props.item.payload?.output);
const query = computed(()=> p.value.block_id || p.value.entity_id || 'target');
const rows = computed(()=> Array.isArray(out.value) ? out.value.map((m: any, i: number)=> ({
  key: String(i),
  dist: (m?.dist!==undefined) ? Number(m.dist).toFixed(1) : '',
  reach: m?.reachable===undefined ? '—' : (m.reachable ? '✓' : '✗'),
  world: Array.isArray(m?.world) && m.world.length===3 ? `(${m.world[0]}, ${m.world[1]}, ${m.world[2]})` : ''
})) : []);
</script>

<style scoped>
.query-chip {
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
  font-size: var(--font-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.query-val {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  font-family: 'Monaco', 'Courier New', monospace;
}
.nearest-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--spacing-sm);
  font-size: var(--font-sm);
}
.nearest-table th {
  text-align: left;
  padding: var(--spacing-xs) var(--spacing-sm);
  color: var(--color-text-muted);
  font-weight: 600;
  border-bottom: 1px solid var(--color-border-subtle);
  text-transform: uppercase;
  font-size: var(--font-xs);
}
.nearest-table td {
  padding: var(--spacing-xs) var(--spacing-sm);
  color: var(--color-text-primary);
}
.td-dist,
.td-world {
  font-family: 'Monaco', 'Courier New', monospace;
}
.td-reach { text-align: center; }
</style>
