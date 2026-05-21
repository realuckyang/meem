import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const extensionBuild = mode === 'extension';
  const input: Record<string, string> = extensionBuild
    ? {
        sidepanel: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, '../extension/src/background.ts'),
      }
    : {
        app: resolve(__dirname, 'index.html'),
      };

  return {
    plugins: [react()],
    base: './',
    publicDir: extensionBuild ? resolve(__dirname, '../extension/public') : false,
    build: {
      outDir: extensionBuild ? resolve(__dirname, '../extension/dist') : 'dist',
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        input,
        output: {
          entryFileNames: (chunk) => chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  };
});
