import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      // Только локальная разработка; prod-проксирование настраивается на ingress.
      proxy: {
        '/api': { target: env.DEV_API_TARGET || 'http://127.0.0.1:8080', changeOrigin: true },
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
