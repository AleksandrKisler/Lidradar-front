import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { fetchMe, useSessionStore } from '@/entities/session'
import { ExportOrganizationCard } from '@/features/manage-consent'
import { saveBlob } from '@/shared/lib'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))
vi.mock('@/shared/lib', async (original) => ({
  ...(await original<typeof import('@/shared/lib')>()),
  saveBlob: vi.fn(),
}))
function deferred() {
  let release!: (response: Response) => void
  const promise = new Promise<Response>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
function zip(name = 'privacy.zip') {
  return new Response(new Blob(['synthetic-zip'], { type: 'application/zip' }), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  })
}
function failure(status: number, code: string, retryAfter?: string) {
  return new Response(
    JSON.stringify({ error: { code, message: 'raw-private-error', traceId: 'trace-export' } }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
      },
    },
  )
}

describe('ExportOrganizationCard — US-M14-04', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
  const wrappers: ReturnType<typeof mount>[] = []
  beforeEach(async () => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(fetchMe).mockResolvedValue({
      canCreateOrganization: false,
      user: {
        emailVerifiedAt: null,
        deletionDueAt: null,
        id: 'u',
        email: 'owner@example.test',
        displayName: 'Мария',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [{ tenantId: 'tenant-a', organizationName: 'A', role: 'OWNER' }],
    })
    await useSessionStore().bootstrap()
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers.length = 0
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
  function setup() {
    const wrapper = mount(ExportOrganizationCard, { props: { tenantId: 'tenant-a' } })
    wrappers.push(wrapper)
    return wrapper
  }

  it('saves the response blob and exact filename/size only after a tenant-scoped POST succeeds', async () => {
    const held = deferred()
    fetchMock.mockReturnValue(held.promise)
    const wrapper = setup()
    const action = wrapper.get('[data-testid="export-organization"]')
    expect(action.text()).toBe('Скачать архив ZIP')
    await action.trigger('click')
    await flushPromises()
    expect(action.text()).toBe('Готовим архив…')
    expect(action.attributes('disabled')).toBeDefined()
    expect(action.attributes('aria-busy')).toBe('true')
    await action.trigger('click')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(saveBlob).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="export-organization-saved"]').exists()).toBe(false)
    const request = fetchMock.mock.calls[0]![0]
    expect(request.method).toBe('POST')
    expect(new URL(request.url).pathname).toBe('/api/v1/organization/export')
    expect(request.headers.get('X-Tenant-ID')).toBe('tenant-a')
    expect(await request.text()).toBe('')
    held.release(zip())
    await flushPromises()
    expect(saveBlob).toHaveBeenCalledTimes(1)
    expect(saveBlob).toHaveBeenCalledWith(expect.objectContaining({ size: 13 }), 'privacy.zip')
    const saved = wrapper.get('[data-testid="export-organization-saved"]')
    expect(saved.text()).toContain('Архив готов')
    expect(saved.text()).toContain('privacy.zip')
    expect(saved.text()).toContain('13')
    expect(saved.text()).toContain('Файл передан браузеру для скачивания')
  })

  it('500 keeps safe error and explicit retry can download successfully', async () => {
    fetchMock.mockResolvedValueOnce(failure(500, 'INTERNAL_ERROR')).mockResolvedValueOnce(zip())
    const wrapper = setup()
    await wrapper.get('[data-testid="export-organization"]').trigger('click')
    await flushPromises()
    const alert = wrapper.get('[data-testid="export-organization-error"]')
    expect(alert.text()).not.toContain('raw-private-error')
    expect(alert.text()).toContain('trace-export')
    expect(saveBlob).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="export-organization-saved"]').exists()).toBe(false)
    await wrapper.get('[data-testid="export-organization"]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(saveBlob).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="export-organization-error"]').exists()).toBe(false)
  })

  it.each([
    ['EXPORT_BUSY', 'Сейчас нельзя начать выгрузку', '30', '30 секунд'],
    ['RATE_LIMITED', 'Лимит выгрузок достигнут', '1080', '18 минут'],
  ])(
    '%s distinguishes its reason and forbids resend during Retry-After',
    async (code, title, wait, text) => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-11-01T07:24:00Z'))
      fetchMock.mockResolvedValueOnce(failure(429, code!, wait)).mockResolvedValueOnce(zip())
      const wrapper = setup()
      const action = wrapper.get('[data-testid="export-organization"]')
      await action.trigger('click')
      await flushPromises()
      const alert = wrapper.get('[data-testid="export-organization-error"]')
      expect(alert.text()).toContain(title)
      expect(alert.text()).toContain(text)
      expect(action.attributes('aria-disabled')).toBe('true')
      await action.trigger('click')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(Number(wait) * 1000 - 1)
      expect(action.attributes('aria-disabled')).toBe('true')
      await vi.advanceTimersByTimeAsync(1001)
      expect(action.attributes('aria-disabled')).toBeUndefined()
      await action.trigger('click')
      await flushPromises()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(saveBlob).toHaveBeenCalledTimes(1)
    },
  )

  it('403 refreshes session without saving an archive', async () => {
    fetchMock.mockResolvedValue(failure(403, 'FORBIDDEN'))
    const refresh = vi.spyOn(useSessionStore(), 'refresh').mockResolvedValue()
    const wrapper = setup()
    await wrapper.get('[data-testid="export-organization"]').trigger('click')
    await flushPromises()
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(saveBlob).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="export-organization-error"]').text()).not.toContain(
      'raw-private-error',
    )
  })

  it.each([
    'tenant',
    'tenant-return',
    'user',
    'permission',
    'logout',
    'logout-return',
    'unmount',
  ] as const)('drops stale blob after %s change', async (change) => {
    const held = deferred()
    fetchMock.mockReturnValue(held.promise)
    const wrapper = setup()
    await wrapper.get('[data-testid="export-organization"]').trigger('click')
    await flushPromises()
    if (change.startsWith('tenant')) {
      await wrapper.setProps({ tenantId: 'tenant-b' })
      if (change === 'tenant-return') await wrapper.setProps({ tenantId: 'tenant-a' })
    } else if (change === 'user') {
      useSessionStore().user = { ...useSessionStore().user!, id: 'other-user' }
    } else if (change === 'permission') {
      useSessionStore().memberships = [
        { tenantId: 'tenant-a', organizationName: 'A', role: 'MANAGER' },
      ]
    } else if (change.startsWith('logout')) {
      const session = useSessionStore(),
        actor = session.user
      session.user = null
      session.status = 'guest'
      if (change === 'logout-return') {
        session.user = actor
        session.status = 'authenticated'
      }
    } else wrapper.unmount()
    await flushPromises()
    held.release(zip('old-tenant.zip'))
    await flushPromises()
    expect(saveBlob).not.toHaveBeenCalled()
    if (change !== 'unmount')
      expect(wrapper.find('[data-testid="export-organization-saved"]').exists()).toBe(false)
    expect(fetchMock.mock.calls[0]![0].headers.get('X-Tenant-ID')).toBe('tenant-a')
  })

  it('manager cannot invoke export even when mounted directly', async () => {
    useSessionStore().memberships = [
      { tenantId: 'tenant-a', organizationName: 'A', role: 'MANAGER' },
    ]
    const wrapper = setup()
    for (const action of wrapper.findAll('button')) await action.trigger('click')
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(saveBlob).not.toHaveBeenCalled()
  })
})
