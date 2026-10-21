import { defineConfig } from 'vite';
import { holodeckHostPlugin } from './server/host.mjs';
export default defineConfig({
  plugins:[holodeckHostPlugin()],
  server: { watch: { ignored: ['**/evidence/**', '**/private/**', '**/research-private/**'] } },
  resolve: { dedupe: ['three', 'react', 'react-dom'] },
  optimizeDeps: { exclude: ['@pmndrs/glyph'] },
  worker: { format: 'es' },
  build: { rollupOptions: { input: { main: 'index.html', design: 'design.html', walkthrough: 'walkthrough.html', prototype: 'prototype.html' } } },
});
