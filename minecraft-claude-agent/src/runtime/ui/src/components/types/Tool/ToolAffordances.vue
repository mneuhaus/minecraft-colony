<template>
  <div class="tl-item__body">
    <div class="tl-kv">
      <span class="tl-kv__key">can_stand</span> <span class="tl-kv__val">{{ yesNo(out.can_stand) }}</span>
      <span class="tl-kv__key">safe_up</span> <span class="tl-kv__val">{{ yesNo(out.safe_step_up) }}</span>
      <span class="tl-kv__key">safe_down</span> <span class="tl-kv__val">{{ yesNo(out.safe_step_down) }}</span>
      <span class="tl-kv__key" v-if="faces.length">faces</span> <span v-if="faces.length" class="tl-kv__val">{{ faces.join(', ') }}</span>
      <span class="tl-kv__key" v-if="out.tools?.break_best">break_best</span> <span v-if="out.tools?.break_best" class="tl-kv__val">{{ out.tools.break_best }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ item: any }>();
const out = computed(()=> props.item.payload?.output || {});
function yesNo(v: any){ return v ? '✓' : (v===false ? '✗' : '—'); }
const faces = computed(()=> Array.isArray(out.value?.placeable_faces) ? out.value.placeable_faces : []);
</script>

