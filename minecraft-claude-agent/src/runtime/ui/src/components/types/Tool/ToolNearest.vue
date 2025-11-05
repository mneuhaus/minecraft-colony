<template>
  <div class="tl-item__body">
    <div class="tl-kv">
      <span class="tl-kv__key">query</span>
      <span class="tl-kv__val">{{ query }}</span>
    </div>
    <table v-if="rows.length" class="tl-table">
      <thead><tr><th>dist</th><th>reach</th><th>sel</th><th>world</th></tr></thead>
      <tbody>
        <tr v-for="r in rows.slice(0,5)" :key="r.key">
          <td>{{ r.dist }}</td>
          <td>{{ r.reach }}</td>
          <td><code>{{ r.sel }}</code></td>
          <td>{{ r.world }}</td>
        </tr>
      </tbody>
    </table>
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
  sel: String(m?.selector||''),
  world: Array.isArray(m?.world) && m.world.length===3 ? `(${m.world[0]}, ${m.world[1]}, ${m.world[2]})` : ''
})) : []);
</script>

