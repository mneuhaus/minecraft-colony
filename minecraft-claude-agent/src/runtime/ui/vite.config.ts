import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This config file lives in src/runtime/ui/, so:
// - root should be that folder
// - outDir targets dist/dashboard relative to project root; from compiled server (dist/runtime),
//   dashboardServer.ts expects dist/dashboard/index.html at ../dashboard/index.html

export default defineConfig({
  plugins: [vue()],
  root: __dirname,
  base: '/',
  build: {
    outDir: path.resolve(__dirname, '../../../dist/dashboard'),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
