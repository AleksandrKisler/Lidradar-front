import { describe, expect, it } from 'vitest'
import { parseEnv } from '@/shared/config'

describe('конфигурация окружения', () => {
  it('принимает пустой origin как «тот же origin»', () => {
    expect(parseEnv({ VITE_APP_ENV: 'dev' }).VITE_API_ORIGIN).toBe('')
    expect(parseEnv({ VITE_APP_ENV: 'prod', VITE_API_ORIGIN: '' }).VITE_API_ORIGIN).toBe('')
  })

  it('принимает абсолютный http(s)-origin без пути', () => {
    expect(
      parseEnv({ VITE_APP_ENV: 'pre-prod', VITE_API_ORIGIN: 'https://api.example.com' })
        .VITE_API_ORIGIN,
    ).toBe('https://api.example.com')
  })

  it.each([
    '/api',
    '//evil.test',
    'javascript:alert(1)',
    'https://api.example.com/api',
    'api.example.com',
  ])('отклоняет небезопасный или неполный origin %s', (origin) => {
    expect(() => parseEnv({ VITE_APP_ENV: 'dev', VITE_API_ORIGIN: origin })).toThrow(
      /VITE_API_ORIGIN/,
    )
  })

  it('отклоняет неизвестное окружение и пустой объект', () => {
    expect(() => parseEnv({ VITE_APP_ENV: 'staging' })).toThrow(/VITE_APP_ENV/)
    expect(() => parseEnv({})).toThrow()
  })
})
