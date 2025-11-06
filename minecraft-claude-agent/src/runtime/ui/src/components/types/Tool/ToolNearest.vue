<template>
  <div class="tl-item__body tool-nearest">
    <div class="tool-header">
      <span class="tool-name">Nearest</span>
    </div>
    <div class="query-row">
      <span class="query-key">query</span>
      <span class="query-val">{{ query }}</span>
    </div>
    <table v-if="rows.length" class="nearest-table">
      <thead>
        <tr>
          <th>dist</th>
          <th>reach</th>
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
    <div v-else class="query-val">querytarget</div>
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
.tool-header {
  font-weight: 600;
  color: #EAEAEA;
  margin-bottom: 8px;
  font-size: 13px;
}
.query-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 8px;
}
.query-key {
  color: #B3B3B3;
  font-size: 11px;
}
.query-val {
  color: #EAEAEA;
  font-size: 12px;
  font-family: 'Monaco', 'Courier New', monospace;
}
.nearest-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  font-size: 11px;
}
.nearest-table th {
  text-align: left;
  padding: 4px 6px;
  color: #B3B3B3;
  font-weight: 600;
  border-bottom: 1px solid #2E2E2E;
}
.nearest-table td {
  padding: 4px 6px;
  color: #EAEAEA;
}
.td-dist {
  font-family: 'Monaco', 'Courier New', monospace;
}
.td-reach {
  text-align: center;
}
.td-sel code {
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 10px;
}
.td-world {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 10px;
}
</style>
