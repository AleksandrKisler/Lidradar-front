import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteLocationNormalized } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { installGuards, resolveAccess } from '@/app/router/guards'
import { routes } from '@/app/router/routes'
import { fetchMe, useSessionStore, type AuthMeResponse } from '@/entities/session'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

const user = {
  id: 'user-1',
  email: 'a@b.c',
  displayName: 'A',
  status: 'ACTIVE' as const,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
}

function route(fullPath: string, meta: RouteLocationNormalized['meta']): RouteLocationNormalized {
  return { fullPath, meta } as RouteLocationNormalized
}

type SessionView = Parameters<typeof resolveAccess>[1]

describe('resolveAccess', () => {
  const guest: SessionView = {
    status: 'guest',
    isAuthenticated: false,
    memberships: [],
    hasTenant: false,
  }
  const member: SessionView = {
    status: 'authenticated',
    isAuthenticated: true,
    memberships: [{ tenantId: 't', organizationName: 'T', role: 'OWNER' }],
    hasTenant: true,
  }

  it('гость уходит на вход с путём возврата, кроме адресов по умолчанию', () => {
    expect(resolveAccess(route('/radar?severity=HIGH', { access: 'tenant' }), guest)).toEqual({
      name: 'login',
      query: { redirect: '/radar?severity=HIGH' },
    })
    expect(resolveAccess(route('/radar', { access: 'tenant' }), guest)).toEqual({
      name: 'login',
      query: {},
    })
    expect(resolveAccess(route('/workspaces', { access: 'session' }), guest)).toEqual({
      name: 'login',
      query: { redirect: '/workspaces' },
    })
    expect(resolveAccess(route('/login', { access: 'guest' }), guest)).toBe(true)
  })

  it('авторизованный не видит гостевые страницы и проходит на защищённые', () => {
    expect(resolveAccess(route('/login', { access: 'guest' }), member)).toEqual({ name: 'radar' })
    expect(resolveAccess(route('/radar', { access: 'tenant' }), member)).toBe(true)
    expect(resolveAccess(route('/missing', {}), member)).toBe(true)
  })

  it('без членств — создание организации, без выбора — список пространств', () => {
    expect(
      resolveAccess(route('/radar', { access: 'tenant' }), {
        ...member,
        memberships: [],
        hasTenant: false,
      }),
    ).toEqual({
      name: 'onboarding-company',
    })
    expect(
      resolveAccess(route('/radar?x=1', { access: 'tenant' }), { ...member, hasTenant: false }),
    ).toEqual({
      name: 'workspaces',
      query: { redirect: '/radar?x=1' },
    })
  })

  it('ошибка загрузки блокирует любую навигацию', () => {
    expect(
      resolveAccess(route('/radar', { access: 'tenant' }), { ...guest, status: 'error' }),
    ).toBe(false)
  })
})

describe('guard-ы маршрутизатора', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.mocked(fetchMe).mockReset()
  })

  function makeRouter() {
    const router = createRouter({ history: createMemoryHistory(), routes })
    installGuards(router)
    return router
  }

  it('загружает сессию один раз перед первой навигацией и перенаправляет гостя', async () => {
    vi.mocked(fetchMe).mockRejectedValue(Object.assign(new Error('401'), { httpStatus: 401 }))
    const router = makeRouter()
    await router.push('/radar')
    // Ошибка без ApiError считается сбоем: навигация блокируется.
    expect(router.currentRoute.value.fullPath).toBe('/')
    const session = useSessionStore()
    expect(session.status).toBe('error')
  })

  it('пользователь с одной организацией попадает в Radar, а с нескольких — на выбор', async () => {
    const many: AuthMeResponse = {
      user,
      memberships: [
        { tenantId: 'tenant-a', organizationName: 'A', role: 'OWNER' },
        { tenantId: 'tenant-b', organizationName: 'B', role: 'MANAGER' },
      ],
    }
    vi.mocked(fetchMe).mockResolvedValue(many)
    const router = makeRouter()
    await router.push('/radar?severity=HIGH')
    expect(router.currentRoute.value.name).toBe('workspaces')
    expect(router.currentRoute.value.query.redirect).toBe('/radar?severity=HIGH')
    const session = useSessionStore()
    session.selectTenant('tenant-a')
    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('radar')
    expect(fetchMe).toHaveBeenCalledTimes(1)
  })

  it('пользователь без членств направляется к созданию организации', async () => {
    vi.mocked(fetchMe).mockResolvedValue({ user, memberships: [] })
    const router = makeRouter()
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('onboarding-company')
  })
})

describe('маршрут карточки риска', () => {
  it('объявлен под рабочим пространством с правом risks.read', () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    const resolved = router.resolve('/risks/01990000-0000-7000-8000-000000000301')
    expect(resolved.name).toBe('risk')
    expect(resolved.meta.access).toBe('tenant')
    expect(resolved.meta.permission).toBe('risks.read')
    expect(resolved.params.riskId).toBe('01990000-0000-7000-8000-000000000301')
  })
})
