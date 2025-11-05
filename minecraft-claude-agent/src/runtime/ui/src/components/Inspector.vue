<template>
  <aside class="inspector" :class="open && 'inspector--open'">
    <div class="inspector__header">
      <h3 class="inspector__title">Inspector</h3>
      <button class="inspector__close" @click="$emit('close')">×</button>
    </div>
    <div class="inspector__section" v-if="item">
      <div class="inspector__json"><pre>{{ pretty(item) }}</pre></div>
    </div>
  </aside>
</template>

<script setup lang="ts">
defineProps<{ open: boolean; item: any }>();
function pretty(o: any){ try { return JSON.stringify(o, null, 2); } catch { return String(o); } }
</script>

<style scoped>
.inspector { position: fixed; right: -420px; top:0; width: 420px; height: 100vh; background: #202020; border-left: 1px solid #2E2E2E; transition: right .2s ease-in-out; padding: 16px; overflow: auto; }
.inspector--open { right: 0; }
.inspector__header { display: flex; justify-content: space-between; align-items: center; }
.inspector__close { background: none; border: none; color: #EAEAEA; font-size: 20px; cursor: pointer; }
.inspector__json { background: #181818; border: 1px solid #2E2E2E; border-radius: 8px; padding: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; color: #CCC; }
</style>

