import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/site-[hash].js',
        chunkFileNames: 'assets/site-[hash].js',
        assetFileNames: 'assets/site-[hash][extname]',
      },
    },
  },
});
