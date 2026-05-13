import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// 关 vite → 浏览器 的 Nagle:SSE 经过 vite proxy 转发时,vite 写回
// 浏览器的 TCP socket 默认还是开 Nagle,小 delta 会被合包延迟 ~200ms。
// http-proxy 的 'proxyRes' 事件里能拿到指向浏览器的 res.socket。
const noDelayConfigure = (proxy) => {
  proxy.on('proxyRes', (_proxyRes, _req, res) => {
    res.socket?.setNoDelay?.(true)
  })
}

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api':  { target: 'http://localhost:9507', changeOrigin: true, configure: noDelayConfigure },
      '/apps': { target: 'http://localhost:9507', changeOrigin: true, configure: noDelayConfigure },
      '/ws':   { target: 'ws://localhost:9507',   changeOrigin: true, ws: true },
    },
  },
  build: {
    outDir: 'dist',
  },
})
