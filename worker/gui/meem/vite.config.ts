import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Meem 控制台只构建 /meem 页面;extension 在仓库根 /extension。
export default defineConfig({
  plugins: [react()],
  base: '/meem/',
  build: {
    outDir: '../dist/meem',
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
