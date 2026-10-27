import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { createStageProxy } from './tooling/vite/stage-proxy.ts'

export default defineConfig(({ mode, command, isPreview }) => {
  // Третий аргумент '' даёт доступ ко всем переменным, включая DEV_API_TARGET
  // без префикса VITE_: она нужна только dev-серверу и в бандл не попадает.
  const env = loadEnv(mode, process.cwd(), '')
  const stage = mode === 'stage'
  if (stage && (command !== 'serve' || isPreview)) {
    throw new Error(
      'Режим stage предназначен только для npm run dev:stage, не для сборки или preview.',
    )
  }
  return {
    plugins: [vue(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      // Обычный dev использует локальный backend; dev:stage — отдельный прокси на VPS.
      // В production проксирует ingress.
      proxy: {
        '/api': stage
          ? createStageProxy(env)
          : { target: env.DEV_API_TARGET || 'http://127.0.0.1:8081', changeOrigin: true },
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
