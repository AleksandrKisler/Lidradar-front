import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import { resolveAccess } from '@/app/router/guards'
import { routes } from '@/app/router/routes'

/**
 * Маршруты безопасности учётной записи (ADR 0058). Ссылки из писем открывают в любом браузере, с сессией и
 * без неё, а запрос письма сброса доступен только гостю.
 */

function flatten(list: RouteRecordRaw[]): RouteRecordRaw[] {
  return list.flatMap((item) => [item, ...flatten(item.children ?? [])])
}
const byName = (name: string) => flatten(routes).find((item) => item.name === name)

function route(fullPath: string, meta: RouteLocationNormalized['meta']): RouteLocationNormalized {
  return { fullPath, meta } as RouteLocationNormalized
}

type SessionView = Parameters<typeof resolveAccess>[1]
const guest: SessionView = {
  status: 'guest',
  isAuthenticated: false,
  memberships: [],
  hasTenant: false,
  canCreateOrganization: false,
}
const signedIn: SessionView = {
  status: 'authenticated',
  isAuthenticated: true,
  memberships: [],
  hasTenant: false,
  canCreateOrganization: false,
}

describe('маршруты безопасности учётной записи', () => {
  it('ссылки из писем открыты и гостю, и вошедшему, даже без организации', () => {
    for (const name of ['reset-password', 'verify-email']) {
      const meta = byName(name)?.meta ?? {}
      expect(meta.access, name).toBe('open')
      expect(resolveAccess(route(`/${name}`, meta), guest), name).toBe(true)
      expect(resolveAccess(route(`/${name}`, meta), signedIn), name).toBe(true)
    }
  })

  it('запрос письма сброса доступен только гостю', () => {
    const meta = byName('forgot-password')?.meta ?? {}
    expect(meta.access).toBe('guest')
    expect(resolveAccess(route('/forgot-password', meta), guest)).toBe(true)
    expect(resolveAccess(route('/forgot-password', meta), signedIn)).toEqual({ name: 'radar' })
  })

  it('«Аккаунт» относится к пользователю: нужна организация, но не право роли', () => {
    const meta = byName('settings-account')?.meta ?? {}
    expect(meta.access).toBe('tenant')
    expect(meta.permission).toBeUndefined()
  })

  it('страницы ссылок не требуют сессии и не записывают путь возврата с токеном', () => {
    // Токен лежит во фрагменте, который в `fullPath` гостевого перехода на вход не попадает.
    for (const name of ['reset-password', 'verify-email']) {
      const meta = byName(name)?.meta ?? {}
      expect(resolveAccess(route(`/${name}#token=abc`, meta), guest)).toBe(true)
    }
  })
})
