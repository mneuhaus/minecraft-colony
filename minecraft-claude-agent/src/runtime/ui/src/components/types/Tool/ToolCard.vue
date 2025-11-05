<template>
  <component :is="toolComponent" :item="normalized" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ToolTodo from './ToolTodo.vue';
import ToolNav from './ToolNav.vue';
import ToolGetPosition from './ToolGetPosition.vue';
import ToolNearest from './ToolNearest.vue';
import ToolVox from './ToolVox.vue';
import ToolAffordances from './ToolAffordances.vue';
import ToolCraftScript from './ToolCraftScript.vue';
import ToolGeneric from './ToolGeneric.vue';

const props = defineProps<{ item: any }>();
const normalized = computed(() => {
  if (props.item.payload) return props.item;
  // Live WS tool messages arrive with tool fields at top-level; wrap into payload for uniformity
  const { tool_name, params_summary, input, output, duration_ms } = (props.item as any);
  return {
    ...props.item,
    payload: { tool_name, params_summary, input, output, duration_ms },
  } as any;
});

const toolName = computed(()=> String(normalized.value.payload?.tool_name || 'tool'));
const humanTitle = (raw: string) => {
  const stripped = raw.replace(/^mcp__[^_]+__/, '').replace(/_/g, ' ');
  return stripped.replace(/\b\w/g, (c) => c.toUpperCase());
};
const title = computed(()=> humanTitle(toolName.value));

const key = computed(()=> {
  const n = toolName.value.toLowerCase();
  if (n === 'todowrite') return 'todo';
  if (/^mcp__/.test(n)) {
    if (/craftscript/.test(n)) return 'craftscript';
    if (/__get_vox$/.test(n)) return 'vox';
    if (/__affordances$/.test(n)) return 'affordances';
    if (/__nearest$/.test(n)) return 'nearest';
    if (/__get_position$/.test(n)) return 'get_position';
    if (/__nav$/.test(n)) return 'nav';
  }
  return 'generic';
});

const toolComponent = computed(()=> ({
  todo: ToolTodo,
  nav: ToolNav,
  get_position: ToolGetPosition,
  nearest: ToolNearest,
  vox: ToolVox,
  affordances: ToolAffordances,
  craftscript: ToolCraftScript,
  generic: ToolGeneric,
}[key.value] || ToolGeneric));
</script>
