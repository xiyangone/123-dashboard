import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri 在打包 Webview 时使用 frontendDist=../dist；dev 模式连接 devUrl=127.0.0.1:5173。
// 这里维持端口/host 与 tauri.conf.json devUrl 一致。
export default defineConfig({
  plugins: [react()],
  // Tauri webview 内文件路径基于 file:// 协议，绝对路径会失效，
  // 把 base 设为相对路径，确保 build 出来的资源能在 webview 内正确加载。
  base: './',
  clearScreen: false,
  server: {
    port: 5173,
    host: '127.0.0.1',
    strictPort: true,
    // Tauri dev 时 webview 连接的是 vite dev server；HMR 需指向同 host
    hmr: {
      host: '127.0.0.1',
      port: 5173,
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
      '/sse': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
    },
  },
  // Tauri 的 webview 不支持 esbuild 默认的某些较新 target
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
  },
});
