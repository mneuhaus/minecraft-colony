import { createApp, reactive, h } from 'vue';
import { createRouter, createWebHistory, RouterView } from 'vue-router';
import App from './App.vue';
import './styles.css';

// Naive UI imports
import naive from 'naive-ui';

// Import theme
import { themeOverrides } from './theme';

export type TimelineItem = any;

export const store = reactive({
  bots: [] as any[],
  items: [] as TimelineItem[],
  activeBot: '' as string,
  viewMode: 'single' as 'single' | 'all',
  craftModal: {
    open: false,
    jobId: null as string | null,
    seed: null as TimelineItem | null,
  },
});

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Dashboard',
      component: App,
    },
    {
      path: '/craftscript/:jobId',
      name: 'CraftscriptDetails',
      component: App,
    },
  ],
});

const app = createApp({
  render: () => h(RouterView),
});

app.use(naive);
app.use(router);
app.provide('store', store);
app.mount('#app');
