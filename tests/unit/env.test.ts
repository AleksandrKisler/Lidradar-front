import { expect, it } from 'vitest'
import { parseEnv } from '@/shared/config/env'
const base = { VITE_APP_ENV: 'dev', VITE_API_BASE_URL: '/api', VITE_DEMO_MODE: 'false' }
it('parses false explicitly', () => {
  expect(parseEnv(base).VITE_DEMO_MODE).toBe(false)
})
it('accepts enabled demo and HTTPS', () => {
  expect(
    parseEnv({ ...base, VITE_DEMO_MODE: 'true', VITE_API_BASE_URL: 'https://api.example.com' })
      .VITE_DEMO_MODE,
  ).toBe(true)
})
it.each(['//evil.test', 'javascript:alert(1)', 'api'])('rejects unsafe API URL %s', (url) => {
  expect(() => parseEnv({ ...base, VITE_API_BASE_URL: url })).toThrow()
})
it('rejects missing configuration', () => {
  expect(() => parseEnv({})).toThrow()
})
