import { createApp, reactive } from 'vue';
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
});

const app = createApp(App);
app.use(naive);
app.provide('store', store);
app.mount('#app');
