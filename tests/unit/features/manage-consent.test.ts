import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore } from '@/entities/session'
import { consentKeys, type MLConsentStatus } from '@/entities/consent'
import { ConsentControls } from '@/features/manage-consent'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))
const inactive: MLConsentStatus = { scope: 'DATASETS', active: false, consent: null }
const active: MLConsentStatus = {
  scope: 'DATASETS',
  active: true,
  consent: { id: 'c-1', scope: 'DATASETS', grantedBy: 'u', grantedAt: '2026-11-01T07:24:00Z' },
}
function json(body: unknown, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
function deferred() {
  let release!: (response: Response) => void
  const promise = new Promise<Response>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
const body = () => new DOMWrapper(document.body)
const dialog = () => body().get('[role="dialog"]')
function button(text: string) {
  return dialog()
    .findAll('button')
    .find((item) => item.text() === text)!
}
function command(text: string) {
  return dialog()
    .findAll('button')
    .find((item) => (item.attributes('aria-label') ?? item.text()) === text)!
}
async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 25))
  await flushPromises()
}

describe('ConsentControls — US-M14-01/02', () => {
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
        email: 'o@b.c',
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
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })
  function setup(status = inactive) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const wrapper = mount(ConsentControls, {
      props: { tenantId: 'tenant-a', status, desktop: true },
      global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
      attachTo: document.body,
    })
    wrappers.push(wrapper)
    return { wrapper, invalidate }
  }
  async function open(wrapper: ReturnType<typeof setup>['wrapper']) {
    await wrapper.get('button').trigger('click')
    await vi.dynamicImportSettled()
    await flushPromises()
  }

  it.each([201, 200])(
    'grant%d sends one tenant-scoped POST only after confirmation',
    async (status) => {
      fetchMock.mockResolvedValue(json(active, status))
      const { wrapper, invalidate } = setup()
      await open(wrapper)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(dialog().text()).toContain('90 до 365 дней')
      expect(dialog().text()).toContain('можно отозвать')
      expect(dialog().text()).not.toMatch(/данные будут удалены/i)
      await button('Дать согласие').trigger('click')
      await settle()
      const request = fetchMock.mock.calls[0]![0]
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(request.method).toBe('POST')
      expect(request.headers.get('X-Tenant-ID')).toBe('tenant-a')
      expect(new URL(request.url).pathname).toBe('/api/v1/organization/ml-consent')
      expect(await request.text()).toBe('')
      expect(wrapper.emitted('changed')).toEqual([[active]])
      expect(wrapper.text()).toContain(status === 200 ? 'уже действовало' : 'Согласие выдано')
      expect(wrapper.emitted('notice')?.at(-1)).toEqual(
        status === 200 ? ['grant', true] : ['grant'],
      )
      expect(body().find('[role="dialog"]').exists()).toBe(false)
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: consentKeys.status('tenant-a'),
        refetchType: 'active',
      })
    },
  )

  it('revoke preserves history and emits success only after DELETE204', async () => {
    const held = deferred()
    fetchMock.mockReturnValue(held.promise)
    const { wrapper } = setup(active)
    await open(wrapper)
    expect(dialog().text()).toContain('История выдачи и отзыва согласия сохранится')
    expect(dialog().text()).not.toMatch(/история.*удалена/i)
    await button('Отозвать').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('changed')).toBeUndefined()
    expect(wrapper.emitted('notice')?.filter(([value]) => value !== null)).toEqual([])
    expect(fetchMock.mock.calls[0]![0].method).toBe('DELETE')
    expect(fetchMock.mock.calls[0]![0].headers.get('X-Tenant-ID')).toBe('tenant-a')
    held.release(new Response(null, { status: 204 }))
    await settle()
    expect(wrapper.emitted('changed')).toEqual([[null]])
    expect(wrapper.emitted('notice')?.at(-1)).toEqual(['revoke'])
  })

  it.each(['grant', 'revoke'] as const)('%s cancellation sends no mutation', async (kind) => {
    const { wrapper } = setup(kind === 'grant' ? inactive : active)
    await open(wrapper)
    await button('Отмена').trigger('click')
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.emitted('changed')).toBeUndefined()
    expect(body().find('[role="dialog"]').exists()).toBe(false)
  })

  it.each(['grant', 'revoke'] as const)(
    '%s pending forbids duplicates, cancellation and Escape',
    async (kind) => {
      const held = deferred()
      fetchMock.mockReturnValue(held.promise)
      const { wrapper } = setup(kind === 'grant' ? inactive : active)
      await open(wrapper)
      const label = kind === 'grant' ? 'Дать согласие' : 'Отозвать'
      await button(label).trigger('click')
      await flushPromises()
      expect(command(label).attributes('disabled')).toBeDefined()
      expect(command(label).attributes('aria-busy')).toBe('true')
      expect(command(label).text()).toContain(kind === 'grant' ? 'Сохраняем…' : 'Отзываем…')
      expect(button('Отмена').attributes('disabled')).toBeDefined()
      expect(dialog().get('button[aria-label="Закрыть"]').attributes('disabled')).toBeDefined()
      await dialog().get('button[aria-label="Закрыть"]').trigger('click')
      await command(label).trigger('click')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flushPromises()
      expect(body().find('[role="dialog"]').exists()).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      held.release(kind === 'grant' ? json(active, 201) : new Response(null, { status: 204 }))
      await settle()
    },
  )

  it.each(['grant', 'revoke'] as const)(
    '%s error keeps dialog and permits explicit retry',
    async (kind) => {
      fetchMock
        .mockResolvedValueOnce(
          json(
            {
              error: { code: 'INTERNAL_ERROR', message: 'raw-private-error', traceId: 'trace-14' },
            },
            500,
          ),
        )
        .mockResolvedValueOnce(
          kind === 'grant' ? json(active, 201) : new Response(null, { status: 204 }),
        )
      const { wrapper } = setup(kind === 'grant' ? inactive : active)
      await open(wrapper)
      await button(kind === 'grant' ? 'Дать согласие' : 'Отозвать').trigger('click')
      await settle()
      expect(dialog().get('[role="alert"]').text()).not.toContain('raw-private-error')
      expect(dialog().get('[role="alert"]').text()).toContain('trace-14')
      expect(wrapper.emitted('changed')).toBeUndefined()
      await button('Повторить').trigger('click')
      await settle()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(wrapper.emitted('changed')).toEqual([[kind === 'grant' ? active : null]])
    },
  )

  it('403 invalidates original tenant, refreshes permissions and never emits success', async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: 'FORBIDDEN', message: 'raw', traceId: 't-3' } }, 403),
    )
    const refresh = vi.spyOn(useSessionStore(), 'refresh').mockResolvedValue()
    const { wrapper, invalidate } = setup()
    await open(wrapper)
    await button('Дать согласие').trigger('click')
    await settle()
    expect(dialog().get('[role="alert"]').text()).not.toContain('raw')
    expect(dialog().get('[role="alert"]').text()).toContain('t-3')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: consentKeys.status('tenant-a'),
      refetchType: 'active',
    })
    expect(wrapper.emitted('changed')).toBeUndefined()
  })

  it.each(['tenant', 'tenant-return', 'user', 'permission', 'logout', 'logout-return'] as const)(
    'ignores held grant after %s context changes',
    async (change) => {
      const held = deferred()
      fetchMock.mockReturnValue(held.promise)
      const { wrapper, invalidate } = setup()
      await open(wrapper)
      await button('Дать согласие').trigger('click')
      await flushPromises()
      const session = useSessionStore()
      if (change.startsWith('tenant')) {
        await wrapper.setProps({ tenantId: 'tenant-b' })
        if (change === 'tenant-return') await wrapper.setProps({ tenantId: 'tenant-a' })
      } else if (change === 'user') {
        session.user = { ...session.user!, id: 'other-user' }
      } else if (change === 'permission') {
        session.memberships = session.memberships.map((item) => ({ ...item, role: 'MANAGER' }))
      } else {
        const actor = session.user
        session.user = null
        session.status = 'guest'
        if (change === 'logout-return') {
          session.user = actor
          session.status = 'authenticated'
        }
      }
      await flushPromises()
      held.release(json(active, 201))
      await settle()
      expect(wrapper.emitted('changed')).toBeUndefined()
      expect(wrapper.emitted('notice')?.filter(([value]) => value !== null)).toEqual([])
      expect(body().find('[role="dialog"]').exists()).toBe(false)
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: consentKeys.status('tenant-a'),
        refetchType: 'none',
      })
      expect(invalidate).not.toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: consentKeys.status('tenant-b') }),
      )
    },
  )

  it('blocked stale status and manager permission cannot issue commands', async () => {
    const { wrapper } = setup()
    await wrapper.setProps({ blocked: true })
    await wrapper.get('button').trigger('click')
    await vi.dynamicImportSettled()
    await flushPromises()
    expect(body().find('[role="dialog"]').exists()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    await wrapper.setProps({ blocked: false })
    useSessionStore().memberships = [
      { tenantId: 'tenant-a', organizationName: 'A', role: 'MANAGER' },
    ]
    await flushPromises()
    for (const action of wrapper.findAll('button')) await action.trigger('click')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(body().find('[role="dialog"]').exists()).toBe(false)
  })
})
