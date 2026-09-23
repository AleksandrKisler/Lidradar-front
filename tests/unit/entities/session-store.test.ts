import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/shared/api'
import { fetchMe, logout, useSessionStore, type AuthMeResponse } from '@/entities/session'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

const user = {
  id: 'user-1',
  email: 'owner@example.test',
  displayName: 'Владелец',
  status: 'ACTIVE' as const,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
}
const one: AuthMeResponse = {
  user,
  memberships: [{ tenantId: 'tenant-a', organizationName: 'A', role: 'OWNER' }],
}
const many: AuthMeResponse = {
  user,
  memberships: [
    { tenantId: 'tenant-a', organizationName: 'A', role: 'OWNER' },
    { tenantId: 'tenant-b', organizationName: 'B', role: 'MANAGER' },
  ],
}
const unauthenticated = () => new ApiError({ httpStatus: 401, code: 'UNAUTHENTICATED' })

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.mocked(fetchMe).mockReset()
  vi.mocked(logout).mockReset()
})

describe('загрузка сессии', () => {
  it('401 делает пользователя гостем без ошибки', async () => {
    vi.mocked(fetchMe).mockRejectedValue(unauthenticated())
    const session = useSessionStore()
    await session.bootstrap()
    expect(session.status).toBe('guest')
    expect(session.booted).toBe(true)
    expect(session.bootError).toBeNull()
  })

  it('сетевая ошибка даёт состояние error, а повтор загружает заново', async () => {
    vi.mocked(fetchMe)
      .mockRejectedValueOnce(ApiError.network(new Error('offline')))
      .mockResolvedValueOnce(one)
    const session = useSessionStore()
    await session.bootstrap()
    expect(session.status).toBe('error')
    expect(session.bootError).toBeInstanceOf(ApiError)
    await session.bootstrap()
    expect(session.status).toBe('authenticated')
    expect(session.tenantId).toBe('tenant-a')
  })

  it('параллельные вызовы bootstrap делают один запрос', async () => {
    vi.mocked(fetchMe).mockResolvedValue(one)
    const session = useSessionStore()
    await Promise.all([session.bootstrap(), session.bootstrap()])
    await session.bootstrap()
    expect(fetchMe).toHaveBeenCalledTimes(1)
  })

  it('единственное членство выбирается автоматически и запоминается', async () => {
    vi.mocked(fetchMe).mockResolvedValue(one)
    const session = useSessionStore()
    await session.bootstrap()
    expect(session.tenantId).toBe('tenant-a')
    expect(session.role).toBe('OWNER')
    expect(session.hasTenant).toBe(true)
    expect(localStorage.getItem('lidradar.tenant.user-1')).toBe('tenant-a')
  })

  it('несколько членств без запомненного выбора оставляют организацию невыбранной', async () => {
    vi.mocked(fetchMe).mockResolvedValue(many)
    const session = useSessionStore()
    await session.bootstrap()
    expect(session.tenantId).toBeNull()
    expect(session.hasTenant).toBe(false)
    expect(session.can('risks.read')).toBe(false)
  })

  it('восстанавливает только действительный запомненный выбор пользователя', async () => {
    localStorage.setItem('lidradar.tenant.user-1', 'tenant-b')
    vi.mocked(fetchMe).mockResolvedValue(many)
    const session = useSessionStore()
    await session.bootstrap()
    expect(session.tenantId).toBe('tenant-b')
    expect(session.role).toBe('MANAGER')
    expect(session.can('risks.read')).toBe(true)
    expect(session.can('analytics.read')).toBe(false)
  })

  it('удаляет подменённый или устаревший запомненный выбор', async () => {
    localStorage.setItem('lidradar.tenant.user-1', 'tenant-foreign')
    vi.mocked(fetchMe).mockResolvedValue(many)
    const session = useSessionStore()
    await session.bootstrap()
    expect(session.tenantId).toBeNull()
    expect(localStorage.getItem('lidradar.tenant.user-1')).toBeNull()
  })

  it('refresh сохраняет действующий выбор и не меняет статус на загрузку', async () => {
    vi.mocked(fetchMe).mockResolvedValue(many)
    const session = useSessionStore()
    await session.bootstrap()
    expect(session.selectTenant('tenant-a')).toBe(true)
    vi.mocked(fetchMe).mockResolvedValue(many)
    await session.refresh()
    expect(session.tenantId).toBe('tenant-a')
    expect(session.status).toBe('authenticated')
  })

  it('refresh пробрасывает ошибку сервера', async () => {
    vi.mocked(fetchMe)
      .mockResolvedValueOnce(one)
      .mockRejectedValueOnce(new ApiError({ httpStatus: 500, code: 'INTERNAL_ERROR' }))
    const session = useSessionStore()
    await session.bootstrap()
    await expect(session.refresh()).rejects.toBeInstanceOf(ApiError)
  })
})

describe('выбор организации и выход', () => {
  it('отклоняет идентификатор вне членств', async () => {
    vi.mocked(fetchMe).mockResolvedValue(many)
    const session = useSessionStore()
    await session.bootstrap()
    expect(session.selectTenant('tenant-foreign')).toBe(false)
    expect(session.tenantId).toBeNull()
    expect(session.selectTenant('tenant-b')).toBe(true)
    session.clearTenant()
    expect(session.tenantId).toBeNull()
    expect(localStorage.getItem('lidradar.tenant.user-1')).toBe('tenant-b')
  })

  it('выход очищает состояние и запомненный выбор даже без подтверждения сервера', async () => {
    vi.mocked(fetchMe).mockResolvedValue(one)
    vi.mocked(logout).mockRejectedValue(ApiError.network(new Error('offline')))
    const session = useSessionStore()
    await session.bootstrap()
    const result = await session.logout()
    expect(result.confirmed).toBe(false)
    expect(session.status).toBe('guest')
    expect(session.user).toBeNull()
    expect(session.memberships).toEqual([])
    expect(session.signOutReason).toBe('manual')
    expect(localStorage.getItem('lidradar.tenant.user-1')).toBeNull()
  })

  it('подтверждённый выход и потеря сессии различаются причиной', async () => {
    vi.mocked(fetchMe).mockResolvedValue(one)
    vi.mocked(logout).mockResolvedValue(undefined)
    const session = useSessionStore()
    await session.bootstrap()
    expect((await session.logout()).confirmed).toBe(true)
    vi.mocked(fetchMe).mockResolvedValue(one)
    await session.refresh()
    session.markExpired()
    expect(session.status).toBe('guest')
    expect(session.signOutReason).toBe('expired')
  })
})
