import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests/e2e', testMatch: /_shots\.spec\.ts/, reporter: 'list', use: { baseURL: 'http://127.0.0.1:4173', channel: 'chrome' } })
