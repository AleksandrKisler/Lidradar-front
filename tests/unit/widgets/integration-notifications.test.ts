import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { useSessionStore } from '@/entities/session'
import { integrationKeys } from '@/entities/integration'
import IntegrationNotifications from '@/widgets/integrations-list/ui/IntegrationNotifications.vue'
import { TelegramNotifyDialog } from '@/features/link-telegram'

const statusPath = '/api/v1/notifications/telegram-link'
const tokenPath = '/api/v1/notifications/telegram-link-token'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
let client: QueryClient
let wrapper: VueWrapper | undefined
async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      {
        path: '/settings/notifications',
        name: 'settings-notifications',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/')
  await router.isReady()
  wrapper = mount(IntegrationNotifications, {
    props: { tenantId: 'tenant-a', timeZone: 'Europe/Moscow' },
    global: { plugins: [router, [VueQueryPlugin, { queryClient: client }]] },
    attachTo: document.body,
  })
  return wrapper
}
const paths = () => fetchMock.mock.calls.map(([request]) => new URL(request.url).pathname)
const body = () => new DOMWrapper(document.body)

beforeEach(() => {
  setActivePinia(createPinia())
  useSessionStore().$patch({
    tenantId: 'tenant-a',
    memberships: [{ tenantId: 'tenant-a', organizationName: 'A', role: 'MANAGER' }],
  })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  client.clear()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('US-M04: компактная строка личных уведомлений', () => {
  it('shows a neutral pending skeleton without inventing an unlinked state', async () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined))
    const row = await render()
    expect(row.get('[role="status"]').attributes('aria-label')).toBe(
      'Загружаем статус личных уведомлений',
    )
    expect(row.text()).not.toMatch(/Не подключены|Подключены|Статус неизвестен/)
    expect(row.get('a').attributes('href')).toBe('/settings/notifications')
    expect(row.findComponent(TelegramNotifyDialog).exists()).toBe(false)
    expect(row.get('img').attributes()).toMatchObject({ width: '15', height: '15', alt: '' })
  })

  it('shows the approved unlinked copy and settings link without issuing any token', async () => {
    fetchMock.mockResolvedValue(json({ linked: false, linkedAt: null }))
    const row = await render()
    await vi.waitFor(() => expect(row.text()).toContain('Не подключены'))
    expect(row.get('button').text()).toBe('Подключить уведомления в Telegram')
    expect(row.get('a').text()).toBe('Настройки уведомлений')
    expect(row.text()).toContain('Личные оповещения не подключают переписку клиентов.')
    expect(paths()).toEqual([statusPath])
    expect(fetchMock.mock.calls[0]![0].headers.get('X-Tenant-ID')).toBe('tenant-a')
  })

  it('shows the confirmed linked state, opens the existing dialog, destroys it on close and restores focus', async () => {
    fetchMock.mockImplementation(async () =>
      json({ linked: true, linkedAt: '2026-11-03T08:00:00Z' }),
    )
    const row = await render()
    await vi.waitFor(() => expect(row.text()).toContain('Подключены'))
    const trigger = row.get('button')
    expect(trigger.text()).toBe('Уведомления в Telegram')
    expect(row.findComponent(TelegramNotifyDialog).exists()).toBe(false)
    await trigger.trigger('click')
    await vi.waitFor(() => expect(body().find('[role="dialog"]').exists()).toBe(true))
    expect(row.findComponent(TelegramNotifyDialog).exists()).toBe(true)
    await vi.waitFor(() => expect(body().text()).toContain('Уведомления успешно подключены'))
    const close = body()
      .findAll('button')
      .find((button) => button.text() === 'Готово')!
    await close.trigger('click')
    await vi.waitFor(() => expect(row.findComponent(TelegramNotifyDialog).exists()).toBe(false))
    await flushPromises()
    expect(document.activeElement).toBe(trigger.element)
    expect(paths().every((path) => path === statusPath)).toBe(true)
  })

  it('link failure is unknown, retains source cache, hides raw errors and retries only the personal query', async () => {
    const savedSources = [{ id: 'existing-source', status: 'ERROR' }]
    client.setQueryData(integrationKeys.list('tenant-a'), savedSources)
    fetchMock
      .mockResolvedValueOnce(
        json(
          {
            error: {
              code: 'UNAVAILABLE',
              message: 'private backend failure',
              traceId: 'private-trace',
            },
          },
          503,
        ),
      )
      .mockResolvedValueOnce(json({ linked: false, linkedAt: null }))
    const row = await render()
    await vi.waitFor(() => expect(row.find('[role="alert"]').exists()).toBe(true))
    expect(row.text()).toContain('Статус уведомлений недоступен')
    expect(row.text()).not.toMatch(/Не подключены|private backend failure|private-trace/)
    expect(client.getQueryData(integrationKeys.list('tenant-a'))).toEqual(savedSources)
    const retry = row.findAll('button').find((button) => button.text() === 'Повторить')!
    await retry.trigger('click')
    await vi.waitFor(() => expect(row.text()).toContain('Не подключены'))
    expect(row.find('[role="alert"]').exists()).toBe(false)
    expect(paths()).toEqual([statusPath, statusPath])
    expect(client.getQueryData(integrationKeys.list('tenant-a'))).toEqual(savedSources)
  })

  it('a manager can use personal notifications without requesting source management or settings preferences', async () => {
    expect(useSessionStore().can('integration.manage')).toBe(false)
    fetchMock.mockResolvedValue(json({ linked: true, linkedAt: null }))
    const row = await render()
    await vi.waitFor(() => expect(row.text()).toContain('Подключены'))
    expect(row.get('a').attributes('href')).toBe('/settings/notifications')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(paths()).toEqual([statusPath])
    expect(fetchMock.mock.calls[0]![0].method).toBe('GET')
  })

  it('only opening an unlinked dialog issues a token; closing removes its contents from the row', async () => {
    fetchMock.mockImplementation(async (request) =>
      new URL(request.url).pathname === tokenPath
        ? json(
            {
              startUrl: 'https://t.me/lidradar_bot?start=synthetic-test-only',
              expiresAt: new Date(Date.now() + 900_000).toISOString(),
            },
            201,
          )
        : json({ linked: false, linkedAt: null }),
    )
    const row = await render()
    await vi.waitFor(() => expect(row.text()).toContain('Не подключены'))
    expect(paths()).toEqual([statusPath])
    await row.get('button').trigger('click')
    await vi.waitFor(() => expect(body().find('a[href^="https://t.me/"]').exists()).toBe(true))
    expect(paths().filter((path) => path === tokenPath)).toHaveLength(1)
    const close = body()
      .findAll('button')
      .find((button) => button.text() === 'Закрыть')!
    await close.trigger('click')
    await vi.waitFor(() => expect(body().find('[role="dialog"]').exists()).toBe(false))
    expect(row.findComponent(TelegramNotifyDialog).exists()).toBe(false)
    expect(row.html()).not.toContain('synthetic-test-only')
    expect(paths().every((path) => path === statusPath || path === tokenPath)).toBe(true)
  })
})
