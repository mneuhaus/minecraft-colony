<template>
  <div>
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
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
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.query-val {
  opacity: 0.65;
  font-size: 14px;
  font-family: 'Monaco', 'Courier New', monospace;
}
.nearest-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  font-size: 14px;
}
.nearest-table th {
  text-align: left;
  padding: 4px 8px;
  opacity: 0.65;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  text-transform: uppercase;
  font-size: 13px;
}
.nearest-table td {
  padding: 4px 8px;
  ;
}
.td-dist,
.td-world {
  font-family: 'Monaco', 'Courier New', monospace;
}
.td-reach { text-align: center; }
</style>
