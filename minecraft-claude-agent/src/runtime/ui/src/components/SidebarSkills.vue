<template>
  <div class="skills-section">
    <n-collapse-item name="skills" title="Skills">
      <template #header>
        <n-space align="center" :size="8">
          <n-icon size="16">
            <BookOutline />
          </n-icon>
          <span>Skills ({{ skills.length }})</span>
          <!-- Show loaded skills even when collapsed -->
          <n-space :size="4" style="margin-left: 8px;">
            <n-tag
              v-for="skill in loadedSkills"
              :key="skill.name"
              :color="{ color: skill.isStale ? '#f0ad4e22' : '#22c55e22', borderColor: skill.isStale ? '#f0ad4e' : '#22c55e', textColor: skill.isStale ? '#f0ad4e' : '#22c55e' }"
              size="small"
              :title="skill.isStale ? 'Skill file updated since last use' : 'Skill loaded'"
            >
              {{ skill.name }}
            </n-tag>
          </n-space>
        </n-space>
      </template>

      <n-space vertical :size="4" v-if="skills.length">
        <div
          v-for="skill in skillsWithState"
          :key="skill.name"
          class="skill-item"
          :title="skill.description"
        >
          <n-space justify="space-between" align="center" :size="8">
            <n-text :depth="3" :size="12">
              {{ skill.name }}
            </n-text>
            <n-space :size="4" align="center">
              <!-- Freshness indicator -->
              <n-tooltip v-if="skill.isStale">
                <template #trigger>
                  <n-icon size="14" color="#f0ad4e">
                    <AlertCircleOutline />
                  </n-icon>
                </template>
                Skill file updated since last use
              </n-tooltip>

              <!-- Last used timestamp -->
              <n-text v-if="skill.lastUsed" :depth="3" :size="11">
                {{ formatRelativeTime(skill.lastUsed) }}
              </n-text>
              <n-text v-else :depth="3" :size="11">
                never
              </n-text>
            </n-space>
          </n-space>
        </div>
      </n-space>

      <n-text v-else depth="3" :size="12">
        No skills available
      </n-text>
    </n-collapse-item>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { NCollapseItem, NSpace, NText, NTooltip, NIcon, NTag } from 'naive-ui';
import { BookOutline, AlertCircleOutline } from '@vicons/ionicons5';
import { inject } from 'vue';

const store: any = inject('store');

interface Skill {
  name: string;
  description: string;
  allowedTools: string[];
  path: string;
  lastModified: number;
  lastModifiedDate: string;
}

interface SkillState {
  name: string;
  lastUsed: number;
  lastUsedDate: string;
}

const skills = ref<Skill[]>([]);
const skillStates = ref<SkillState[]>([]);

const skillsWithState = computed(() => {
  return skills.value.map(skill => {
    const state = skillStates.value.find(s => s.name === skill.name);
    const isStale = state && state.lastUsed < skill.lastModified;

    return {
      ...skill,
      lastUsed: state?.lastUsed || null,
      isStale,
    };
  }).sort((a, b) => {
    // Sort by last used, most recent first
    if (a.lastUsed && b.lastUsed) return b.lastUsed - a.lastUsed;
    if (a.lastUsed) return -1;
    if (b.lastUsed) return 1;
    // Then by name
    return a.name.localeCompare(b.name);
  });
});

const loadedSkills = computed(() => {
  return skillsWithState.value.filter(skill => skill.lastUsed !== null);
});

async function loadSkills() {
  try {
    const response = await fetch('/api/skills');
    const data = await response.json();
    skills.value = data.skills || [];
  } catch (error) {
    console.error('Failed to load skills:', error);
  }
}

async function loadSkillStates() {
  if (!store.activeBot) return;

  try {
    const response = await fetch(`/api/bots/${encodeURIComponent(store.activeBot)}/skills/state`);
    const data = await response.json();
    skillStates.value = data.skillStates || [];
  } catch (error) {
    console.error('Failed to load skill states:', error);
  }
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// Load skills on mount
onMounted(() => {
  loadSkills();
  loadSkillStates();

  // Refresh skill states periodically
  setInterval(() => {
    if (store.activeBot) {
      loadSkillStates();
    }
  }, 30000); // Every 30 seconds
});

// Watch for bot changes
watch(() => store.activeBot, () => {
  loadSkillStates();
});
</script>

<style scoped>
.skills-section {
  width: 100%;
}

.skill-item {
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  transition: all 0.2s;
}

.skill-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}
</style>
