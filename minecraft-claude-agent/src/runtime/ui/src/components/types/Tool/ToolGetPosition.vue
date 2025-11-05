<template>
  <div class="tl-item__body">
    <div class="tl-kv">
      <span class="tl-kv__key">pos</span> <span class="tl-kv__val">{{ pos }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ item: any }>();
const out = computed(()=> props.item.payload?.output || {});
const pos = computed(()=> out.value && out.value.x!==undefined ? `(${out.value.x}, ${out.value.y}, ${out.value.z})` : 'requested');
</script>

