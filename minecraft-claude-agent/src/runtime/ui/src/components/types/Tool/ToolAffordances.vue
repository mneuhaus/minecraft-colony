<template>
  <MessageBlock
    eyebrow="Spatial"
    title="Affordances"
    padding="md"
    :tone="tone"
  >
    <div class="affordance-row">
      <span class="aff-key">can stand</span> <span class="aff-val">{{ yesNo(out.can_stand) }}</span>
      <span class="aff-key">safe up</span> <span class="aff-val">{{ yesNo(out.safe_step_up) }}</span>
      <span class="aff-key">safe down</span> <span class="aff-val">{{ yesNo(out.safe_step_down) }}</span>
      <span class="aff-key" v-if="faces.length">faces</span> <span v-if="faces.length" class="aff-val">{{ faces.join(', ') }}</span>
      <span class="aff-key" v-if="out.tools?.break_best">break best</span> <span v-if="out.tools?.break_best" class="aff-val">{{ out.tools.break_best }}</span>
    </div>
  </MessageBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MessageBlock from '../../MessageBlock.vue';
const props = defineProps<{ item: any }>();
const out = computed(()=> props.item.payload?.output || {});
function yesNo(v: any){ return v ? '✓' : (v===false ? '✗' : '—'); }
const faces = computed(()=> Array.isArray(out.value?.placeable_faces) ? out.value.placeable_faces : []);
const tone = computed(() => out.value?.can_stand ? 'success' : 'warning');
</script>

<style scoped>
.affordance-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, auto));
  gap: var(--spacing-sm);
  font-size: var(--font-sm);
}
.aff-key { color: var(--color-text-muted); text-transform: uppercase; font-size: var(--font-xs); }
.aff-val { font-family: 'Monaco','Courier New',monospace; color: var(--color-text-primary); }
</style>
