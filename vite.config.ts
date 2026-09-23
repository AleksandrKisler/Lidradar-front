import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Третий аргумент '' даёт доступ ко всем переменным, включая DEV_API_TARGET
  // без префикса VITE_: она нужна только dev-серверу и в бандл не попадает.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      // Только локальная разработка: /api уходит на учебный стенд бэкенда
      // (docs/runbooks/frontend-development.md). В production проксирует ingress.
      proxy: {
        '/api': { target: env.DEV_API_TARGET || 'http://127.0.0.1:8081', changeOrigin: true },
      },
    },
    build: {
      target: 'es2022',
      // Карты prod не публикуем. Для error tracking загружайте private maps отдельно.
      sourcemap: mode === 'development',
      manifest: true,
    },
  }
})
