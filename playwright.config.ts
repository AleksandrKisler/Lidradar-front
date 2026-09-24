import { defineConfig, devices } from '@playwright/test'
// Внешний URL: только smoke-проверки контролируемого pre-prod; не записывайте prod-данные.
const external = process.env.E2E_BASE_URL
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: external || 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Матрица ширин управляет viewport сама и выполняется только в Chromium.
    { name: 'chromium', testIgnore: /stand\//, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      testIgnore: [/stand\//, /responsive\.spec\.ts/],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: [/stand\//, /responsive\.spec\.ts/],
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile',
      testIgnore: [/stand\//, /responsive\.spec\.ts/],
      use: { ...devices['iPhone 13'] },
    },
    {
      // Реальный стенд: детерминированные проверки без повторов и без артефактов,
      // которые могли бы сохранить cookie сессии или содержимое переписок.
      name: 'stand',
      testMatch: /stand\/.*\.spec\.ts/,
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        trace: 'off',
        video: 'off',
        screenshot: 'off',
      },
    },
  ],
  webServer: external
    ? undefined
    : {
        command: 'npm run build:pre-prod && npm run preview',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: false,
        timeout: 120_000,
      },
})
