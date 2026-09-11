import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    env: { VITE_APP_ENV: 'dev', VITE_API_BASE_URL: '/api', VITE_DEMO_MODE: 'true' },
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Покрываем всю бизнес-логику, включая файлы без тестов. UI проверяется также E2E.
      include: [
        'src/**/model/**/*.ts',
        'src/shared/config/env.ts',
        'src/shared/api/**/*.ts',
        'src/entities/**/api/**/*.ts',
      ],
      exclude: ['**/index.ts', '**/*.test.ts'],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 80 },
    },
  },
})
