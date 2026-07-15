import { defineConfig } from 'vite';

// 静的ホスティング(GitHub Pages等)でも動くよう相対パス基準にする
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
