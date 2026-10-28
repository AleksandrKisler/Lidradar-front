/**
 * Съёмка кадров frontend v2 для сверки с Figma (не часть CI-матрицы).
 * Запуск: `npm run visual:capture`, сравнение: `npm run visual:compare`.
 * Результаты лежат в `artifacts/frontend-v2/` (игнорируется git) и не стираются
 * обычным `playwright test`, который чистит `test-results/`.
 */
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: /capture\.spec\.ts$/,
  workers: 1,
  reporter: [['list']],
  outputDir: '../../artifacts/frontend-v2/.pw',
  // Язык интерфейса браузера — русский: поля времени показывают 24-часовой формат, как у пользователей.
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    launchOptions: { args: ['--lang=ru-RU'] },
  },
  webServer: {
    command: 'npm run build:pre-prod && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
