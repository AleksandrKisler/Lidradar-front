import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { useSessionStore } from '@/entities/session'
import { organizationKeys } from '@/entities/organization'
import {
  integrationKeys,
  type ChannelConnection,
  type ConnectionHealth,
} from '@/entities/integration'
import IntegrationCard from '@/widgets/integrations-list/ui/IntegrationCard.vue'
import IntegrationsList from '@/widgets/integrations-list/ui/IntegrationsList.vue'
import IntegrationsPage from '@/pages/integrations/ui/IntegrationsPage.vue'

const base: ChannelConnection = {
  id: 'connection-a',
  locationId: null,
  provider: 'CONNECTED_BUSINESS_BOT',
  name: 'Клиентская переписка',
  status: 'ACTIVE',
  capabilities: ['CAN_RECEIVE_MESSAGES'],
  lastEventAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorCode: null,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-03T10:00:00Z',
}
const health: ConnectionHealth = {
  status: 'ACTIVE',
  lastEventAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorCode: null,
  checkedAt: '2026-11-03T12:30:00Z',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const failure = (status = 503) =>
  json(
    { error: { code: 'UNAVAILABLE', message: 'private failure', traceId: 'private trace' } },
    status,
  )
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}
let client: QueryClient
let session: ReturnType<typeof useSessionStore>
let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
let wrappers: VueWrapper[] = []
const stubs = {
  ConnectChannelDialog: true,
  TelegramInstructionDialog: true,
  IntegrationNotifications: true,
}
const pathOf = (request: Request) => new URL(request.url).pathname
function fallback(request: Request): Response {
  const path = pathOf(request)
  if (path === '/api/v1/integrations') return json({ items: [base] })
  if (path.endsWith('/health')) return json(health)
  if (path === '/api/v1/locations') return json({ items: [] })
  if (path === '/api/v1/organization') return json({ defaultTimezone: 'Europe/Moscow' })
  throw new Error(`Unexpected endpoint in widget test: ${request.method} ${path}`)
}
function renderCard(connection: ChannelConnection = base) {
  const wrapper = mount(IntegrationCard, {
    props: { tenantId: 'tenant-a', connection, locationName: null, timeZone: 'Europe/Moscow' },
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]], stubs },
  })
  wrappers.push(wrapper)
  return wrapper
}
function renderList(router?: Router) {
  const wrapper = mount(IntegrationsList, {
    props: { tenantId: 'tenant-a', timeZone: 'Europe/Moscow' },
    global: {
      plugins: [...(router ? [router] : []), [VueQueryPlugin, { queryClient: client }]],
      stubs,
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
async function renderPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'radar', component: { template: '<div />' } }],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(IntegrationsPage, {
    global: { plugins: [router, [VueQueryPlugin, { queryClient: client }]], stubs },
  })
  wrappers.push(wrapper)
  return wrapper
}
const button = (wrapper: Pick<VueWrapper, 'findAll'>, label: string) => {
  const found = wrapper.findAll('button').find((item) => item.text() === label)
  expect(found, `button «${label}» must exist`).toBeDefined()
  return found!
}
const badge = (wrapper: Pick<VueWrapper, 'get'>) =>
  wrapper.get('[data-testid="source-status"]').text()

beforeEach(() => {
  setActivePinia(createPinia())
  session = useSessionStore()
  session.$patch({
    status: 'authenticated',
    tenantId: 'tenant-a',
    user: {
      id: 'user-a',
      email: 'test@example.test',
      displayName: 'Test',
      status: 'ACTIVE',
      emailVerifiedAt: null,
      deletionDueAt: null,
      createdAt: '',
      updatedAt: '',
    },
    memberships: [
      { tenantId: 'tenant-a', organizationName: 'A', role: 'OWNER' },
      { tenantId: 'tenant-b', organizationName: 'B', role: 'OWNER' },
    ],
  })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  fetchMock = vi.fn(async (request: Request) => fallback(request))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers = []
  client.clear()
  vi.unstubAllGlobals()
})

describe('US-M04 list and page states', () => {
  it('first request failure is unknown source state, never an empty list', async () => {
    fetchMock.mockImplementation(async (request) =>
      pathOf(request) === '/api/v1/integrations' ? failure() : fallback(request),
    )
    const list = renderList()
    await vi.waitFor(() => expect(list.text()).toContain('Не удалось загрузить источники'))
    expect(list.text()).toContain('Состояние подключений пока неизвестно.')
    expect(list.text()).not.toContain('Подключите первый источник')
    expect(list.find('ul[aria-label="Подключения"]').exists()).toBe(false)
    expect(button(list, 'Повторить').exists()).toBe(true)
    expect(list.text()).not.toMatch(/private failure|private trace/)
  })

  it('skeleton contains field labels without fictional source names, status, dates or empty state', async () => {
    const pending = deferred<Response>()
    fetchMock.mockImplementation((request) =>
      pathOf(request) === '/api/v1/integrations'
        ? pending.promise
        : Promise.resolve(fallback(request)),
    )
    const list = renderList()
    const skeleton = list.get('[aria-label="Загрузка источников"]')
    expect(skeleton.text()).toContain('Последнее событие')
    expect(skeleton.text()).toContain('Успешная операция')
    expect(skeleton.text()).toContain('Последняя ошибка')
    expect(list.text()).not.toMatch(
      /Клиентская переписка|Активно|Подключите первый источник|нояб\./,
    )
    expect(list.find('ul[aria-label="Подключения"]').exists()).toBe(false)
  })

  it('empty state offers Telegram with a 20px logo and keeps unavailable MAX distinct', async () => {
    fetchMock.mockImplementation(async (request) =>
      pathOf(request) === '/api/v1/integrations' ? json({ items: [] }) : fallback(request),
    )
    const list = renderList()
    await vi.waitFor(() => expect(list.text()).toContain('Подключите первый источник'))
    const connect = list.get('.integration-empty').get('button')
    expect(connect.text()).toBe('Подключить Telegram')
    expect(connect.get('img').attributes()).toMatchObject({ width: '20', height: '20', alt: '' })
    expect(connect.get('img').attributes('src')).toContain('telegram-connect.svg')
    const max = list.get('section[aria-label="MAX — интеграция в работе"]')
    expect(max.text()).toContain('В работе')
    expect(max.find('button').exists()).toBe(false)
    await connect.trigger('click')
    expect(list.findComponent({ name: 'ConnectChannelDialog' }).props('open')).toBe(true)
  })

  it('refresh failure keeps known cards and an addressed retry clears the banner after recovery', async () => {
    let listReads = 0
    fetchMock.mockImplementation(async (request) => {
      if (pathOf(request) !== '/api/v1/integrations') return fallback(request)
      listReads++
      return listReads === 2
        ? failure(500)
        : json({
            items: [
              { ...base, name: listReads === 1 ? 'Известный источник' : 'Обновлённый источник' },
            ],
          })
    })
    const list = renderList()
    await vi.waitFor(() => expect(list.text()).toContain('Известный источник'))
    await list.get('button[aria-label="Обновить источники"]').trigger('click')
    await vi.waitFor(() => expect(list.text()).toContain('Не удалось обновить источники'))
    expect(list.text()).toContain('Известный источник')
    expect(list.text()).toContain('Показаны ранее загруженные данные. Время снимка не изменилось.')
    expect(list.text()).not.toContain('Подключите первый источник')
    await button(list, 'Повторить').trigger('click')
    await vi.waitFor(() => expect(list.text()).toContain('Обновлённый источник'))
    expect(list.text()).not.toContain('Не удалось обновить источники')
    expect(listReads).toBe(3)
  })

  it('a manager receives no organization/list/health requests and sees the access explanation', async () => {
    session.memberships[0]!.role = 'MANAGER'
    const page = await renderPage()
    await flushPromises()
    expect(page.text()).toContain('Раздел недоступен')
    expect(page.text()).toContain('Источники сообщений подключает владелец организации.')
    expect(page.get('a').text()).toBe('Вернуться в Radar')
    expect(fetchMock).not.toHaveBeenCalled()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'radar', component: { template: '<div />' } }],
    })
    await router.push('/')
    await router.isReady()
    const list = renderList(router)
    const card = renderCard()
    await flushPromises()
    expect(list.text()).toContain('Раздел недоступен')
    expect(list.text()).toContain('Источники сообщений подключает владелец организации.')
    expect(list.get('a').text()).toBe('Вернуться в Radar')
    expect(list.get('button[aria-label="Обновить источники"]').attributes('disabled')).toBeDefined()
    expect(list.find('ul[aria-label="Подключения"]').exists()).toBe(false)
    expect(card.text()).toBe('')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a late tenant-A list cannot appear in tenant B or populate its cache', async () => {
    const oldList = deferred<Response>()
    fetchMock.mockImplementation(async (request) => {
      if (pathOf(request) === '/api/v1/integrations') {
        return request.headers.get('X-Tenant-ID') === 'tenant-a'
          ? oldList.promise
          : json({ items: [{ ...base, id: 'connection-b', name: 'Источник организации B' }] })
      }
      return fallback(request)
    })
    const page = await renderPage()
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([request]) =>
            pathOf(request) === '/api/v1/integrations' &&
            request.headers.get('X-Tenant-ID') === 'tenant-a',
        ),
      ).toBe(true),
    )
    session.tenantId = 'tenant-b'
    await vi.waitFor(() => expect(page.text()).toContain('Источник организации B'))
    oldList.resolve(json({ items: [{ ...base, name: 'Старый источник организации A' }] }))
    await flushPromises()
    expect(page.text()).not.toContain('Старый источник организации A')
    expect(
      client
        .getQueryData<ChannelConnection[]>(integrationKeys.list('tenant-b'))
        ?.map((item) => item.name),
    ).toEqual(['Источник организации B'])
    const healthRequests = fetchMock.mock.calls.filter(([request]) =>
      pathOf(request).endsWith('/health'),
    )
    expect(healthRequests).toHaveLength(1)
    expect(
      healthRequests.every(
        ([request]) =>
          request.headers.get('X-Tenant-ID') === 'tenant-b' &&
          pathOf(request).includes('connection-b'),
      ),
    ).toBe(true)
  })
})

describe('US-M04 source card states', () => {
  it('an ACTIVE source without events asks for a real new message and does not claim confirmed delivery', async () => {
    const card = renderCard()
    await vi.waitFor(() => expect(card.text()).toContain('Состояние прочитано'))
    expect(badge(card)).toBe('Активно')
    expect(card.text()).toContain('Новых событий пока нет')
    expect(card.text()).toContain('Отправьте сообщение в доступный боту чат и обновите экран.')
    expect(card.text()).not.toContain('Регистрация подтверждена.')
    expect(card.text()).not.toContain('Связь с Telegram проверена')
    expect(
      card
        .get('dl')
        .findAll('dd')
        .every((value) => value.text() === 'Ещё не было'),
    ).toBe(true)
  })

  it('DEGRADED is attention with preserved data and an addressable check, never ACTIVE or NoEvents', async () => {
    fetchMock.mockResolvedValue(json({ ...health, status: 'DEGRADED' }))
    const card = renderCard()
    await vi.waitFor(() => expect(card.text()).toContain('Подключение требует внимания'))
    expect(badge(card)).toBe('Требует внимания')
    expect(card.text()).toContain('Последние известные данные сохранены.')
    expect(button(card, 'Проверить связь').exists()).toBe(true)
    expect(card.text()).not.toContain('Новых событий пока нет')
    expect(card.text()).not.toContain('Связь с Telegram проверена')
  })

  it('check transport error is separate from the confirmed ACTIVE source and includes the approved 20px icon', async () => {
    fetchMock.mockImplementation(async (request) =>
      pathOf(request).endsWith('/health/check') ? failure() : fallback(request),
    )
    const card = renderCard()
    await vi.waitFor(() => expect(card.text()).toContain('Состояние прочитано'))
    await button(card, 'Проверить связь').trigger('click')
    await vi.waitFor(() => expect(card.text()).toContain('Не удалось проверить связь'))
    expect(badge(card)).toBe('Активно')
    expect(card.text()).not.toContain('Ошибка источника')
    expect(card.text()).not.toContain('Настройка Telegram изменилась')
    expect(card.get('[role="alert"]').get('img').attributes()).toMatchObject({
      width: '20',
      height: '20',
      alt: '',
    })
    expect(card.text()).not.toMatch(/private failure|private trace/)
  })

  it('REMOTE with ERROR exposes the provider error and never announces an active or successful connection', async () => {
    fetchMock.mockImplementation(async (request) =>
      pathOf(request).endsWith('/health/check')
        ? json({
            verification: 'REMOTE',
            health: { ...health, status: 'ERROR', lastErrorCode: 'TELEGRAM_WEBHOOK_MISMATCH' },
          })
        : fallback(request),
    )
    const card = renderCard()
    await vi.waitFor(() => expect(card.text()).toContain('Состояние прочитано'))
    await button(card, 'Проверить связь').trigger('click')
    await vi.waitFor(() => expect(card.text()).toContain('Удалённая проверка выполнена'))
    expect(badge(card)).toBe('Ошибка')
    expect(card.text()).toContain('Настройка Telegram изменилась')
    expect(card.text()).toContain('Получение сообщений не подтверждено.')
    expect(card.text()).not.toContain('Связь с Telegram проверена')
    expect(card.text()).not.toContain('Регистрация подтверждена.')
  })

  it('LOCAL explicitly reports a saved snapshot without claiming a remote probe', async () => {
    fetchMock.mockImplementation(async (request) =>
      pathOf(request).endsWith('/health/check')
        ? json({ verification: 'LOCAL', health })
        : fallback(request),
    )
    const card = renderCard()
    await vi.waitFor(() => expect(card.text()).toContain('Состояние прочитано'))
    await button(card, 'Проверить связь').trigger('click')
    await vi.waitFor(() => expect(card.text()).toContain('Показано сохранённое состояние'))
    expect(card.text()).toContain('Удалённая проверка не выполнялась.')
    expect(card.text()).not.toContain('Связь с Telegram проверена')
    expect(card.text()).not.toContain('Регистрация подтверждена.')
    expect(card.text()).not.toContain('Проверка выполнена')
    expect(badge(card)).toBe('Активно')
  })

  it('metadata uses the organization timezone and GET checkedAt is labelled as a read, not a probe', async () => {
    fetchMock.mockResolvedValue(json({ ...health, lastEventAt: '2026-11-03T21:15:00Z' }))
    const card = renderCard()
    await vi.waitFor(() => expect(card.text()).toContain('Состояние прочитано'))
    expect(card.get('dl').text()).toMatch(/4 нояб\.,\s+00:15/)
    expect(card.get('dl').text()).toContain('Ещё не было')
    expect(card.text()).toMatch(/Состояние прочитано 3 нояб\.,\s+15:30/)
    expect(card.text()).not.toContain('Проверка выполнена')
    expect(card.text()).not.toContain('Связь с Telegram проверена')
  })

  it('a confirmed DISCONNECTED source hides ordinary commands but keeps instruction and preserved-history explanation', async () => {
    fetchMock.mockResolvedValue(json({ ...health, status: 'DISCONNECTED' }))
    const card = renderCard({ ...base, status: 'DISCONNECTED' })
    await vi.waitFor(() => expect(card.text()).toContain('Состояние прочитано'))
    expect(badge(card)).toBe('Отключено')
    expect(card.findAll('button').map((item) => item.text())).toEqual(['Инструкция'])
    expect(card.text()).toContain('Новые сообщения не поступают')
    expect(card.text()).toContain('Сохранённые диалоги и риски остаются доступны.')
    expect(card.text()).not.toContain('Удаление настройки у Telegram не подтверждено')
  })

  it.each([
    ['TEST', 'Тестовый источник'],
    ['IMPORT', 'Импорт истории'],
    ['GENERIC_WEBHOOK', 'Webhook'],
  ] as const)(
    'uses the real %s provider, generic action and no Telegram instruction',
    async (provider, label) => {
      const card = renderCard({ ...base, name: 'Внешний источник', provider })
      await vi.waitFor(() => expect(card.text()).toContain('Состояние прочитано'))
      expect(card.text()).toContain(`${label} · Вся организация`)
      expect(button(card, 'Обновить статус').exists()).toBe(true)
      expect(card.findAll('button').some((item) => item.text() === 'Инструкция')).toBe(false)
      expect(card.text()).not.toContain('Telegram')
      expect(card.find('img[src*="/telegram.svg"]').exists()).toBe(false)
      if (provider === 'GENERIC_WEBHOOK') expect(badge(card)).toBe('Ожидает первое событие')
    },
  )
})

describe('F-INT-01 organization timezone through the real page', () => {
  const eventAt = '2026-11-03T11:20:00Z'
  const datedHealth: ConnectionHealth = { ...health, lastEventAt: eventAt }

  it('keeps ready sources and commands during organization pending, withholding metadata and GET read times until Moscow is known', async () => {
    const organization = deferred<Response>()
    fetchMock.mockImplementation((request) => {
      const path = pathOf(request)
      if (path === '/api/v1/organization') return organization.promise
      if (path.endsWith('/health')) return Promise.resolve(json(datedHealth))
      return Promise.resolve(fallback(request))
    })
    const page = await renderPage()
    await vi.waitFor(() =>
      expect(client.getQueryData(integrationKeys.health('tenant-a', base.id))).toEqual(datedHealth),
    )
    const card = page.getComponent(IntegrationCard)
    await vi.waitFor(() => expect(card.get('dl').text()).toContain('Часовой пояс не загружен'))
    expect(card.get('dl').text()).toContain('Ещё не было')
    expect(badge(card)).toBe('Активно')
    expect(button(card, 'Проверить связь').attributes('disabled')).toBeUndefined()
    expect(button(card, 'Отключить').attributes('disabled')).toBeUndefined()
    expect(card.get('.source-read').text()).toContain('Часовой пояс не загружен')
    expect(card.text()).not.toMatch(/11:20|12:30/)
    expect(page.text()).not.toContain('Подключите первый источник')

    organization.resolve(json({ defaultTimezone: 'Europe/Moscow' }))
    await vi.waitFor(() => expect(card.get('dl').text()).toMatch(/3 нояб\.,\s+14:20/))
    expect(card.get('.source-read').text()).toMatch(/3 нояб\.,\s+15:30/)
    expect(card.text()).not.toContain('Часовой пояс не загружен')
  })

  it('cold organization failure keeps sources and null timestamps truthful; targeted timezone retry recovers without refreshing source endpoints', async () => {
    let organizationReads = 0
    fetchMock.mockImplementation(async (request) => {
      const path = pathOf(request)
      if (path === '/api/v1/organization') {
        organizationReads++
        return organizationReads === 1 ? failure() : json({ defaultTimezone: 'Europe/Moscow' })
      }
      if (path.endsWith('/health')) return json(datedHealth)
      return fallback(request)
    })
    const page = await renderPage()
    await vi.waitFor(() =>
      expect(page.findAll('button').some((item) => item.text() === 'Загрузить часовой пояс')).toBe(
        true,
      ),
    )
    await vi.waitFor(() => expect(page.findComponent(IntegrationCard).exists()).toBe(true))
    const card = page.getComponent(IntegrationCard)
    await vi.waitFor(() => expect(card.get('dl').text()).toContain('Часовой пояс не загружен'))
    expect(
      card
        .get('dl')
        .findAll('dd')
        .map((value) => value.text()),
    ).toEqual(['Часовой пояс не загружен', 'Ещё не было', 'Ещё не было'])
    expect(card.get('.source-read').text()).toContain('Часовой пояс не загружен')
    expect(badge(card)).toBe('Активно')
    expect(button(card, 'Проверить связь').exists()).toBe(true)
    expect(page.text()).not.toMatch(
      /Подключите первый источник|Ошибка источника|private failure|private trace|11:20|12:30/,
    )
    const callsBeforeRetry = fetchMock.mock.calls.length
    const cachedSources = client.getQueryData(integrationKeys.list('tenant-a'))
    const cachedHealth = client.getQueryData(integrationKeys.health('tenant-a', base.id))

    await button(page, 'Загрузить часовой пояс').trigger('click')
    await vi.waitFor(() => expect(card.get('dl').text()).toMatch(/3 нояб\.,\s+14:20/))
    expect(
      fetchMock.mock.calls.slice(callsBeforeRetry).map(([request]) => pathOf(request)),
    ).toEqual(['/api/v1/organization'])
    expect(client.getQueryData(integrationKeys.list('tenant-a'))).toEqual(cachedSources)
    expect(client.getQueryData(integrationKeys.health('tenant-a', base.id))).toEqual(cachedHealth)
    expect(card.get('.source-read').text()).toMatch(/3 нояб\.,\s+15:30/)
    expect(page.findAll('button').some((item) => item.text() === 'Загрузить часовой пояс')).toBe(
      false,
    )
    expect(organizationReads).toBe(2)
  })

  it('a failed organization background refresh retains the cached Moscow timezone for metadata and GET read time', async () => {
    client.setQueryData(
      organizationKeys.detail('tenant-a'),
      { defaultTimezone: 'Europe/Moscow' },
      {
        updatedAt: Date.now() - 6 * 60_000,
      },
    )
    fetchMock.mockImplementation(async (request) => {
      const path = pathOf(request)
      if (path === '/api/v1/organization') return failure()
      if (path.endsWith('/health')) return json(datedHealth)
      return fallback(request)
    })
    const page = await renderPage()
    await vi.waitFor(() =>
      expect(client.getQueryState(organizationKeys.detail('tenant-a'))?.status).toBe('error'),
    )
    await vi.waitFor(() => expect(page.findComponent(IntegrationCard).exists()).toBe(true))
    const card = page.getComponent(IntegrationCard)
    await vi.waitFor(() => expect(card.get('dl').text()).toMatch(/3 нояб\.,\s+14:20/))
    expect(card.get('.source-read').text()).toMatch(/3 нояб\.,\s+15:30/)
    expect(card.text()).not.toContain('Часовой пояс не загружен')
    expect(card.text()).not.toMatch(/11:20|12:30/)
    expect(badge(card)).toBe('Активно')
    expect(button(card, 'Проверить связь').exists()).toBe(true)
    expect(client.getQueryData(organizationKeys.detail('tenant-a'))).toEqual({
      defaultTimezone: 'Europe/Moscow',
    })
    expect(
      fetchMock.mock.calls.filter(([request]) => pathOf(request) === '/api/v1/organization'),
    ).toHaveLength(1)
  })

  it('tenant B never inherits tenant A timezone; a REMOTE result stays undated until B organization recovers, then uses its own timezone', async () => {
    const organizationB = deferred<Response>()
    fetchMock.mockImplementation((request) => {
      const path = pathOf(request)
      const tenant = request.headers.get('X-Tenant-ID')
      if (path === '/api/v1/organization')
        return tenant === 'tenant-b'
          ? organizationB.promise
          : Promise.resolve(json({ defaultTimezone: 'Europe/Moscow' }))
      if (path === '/api/v1/integrations')
        return Promise.resolve(
          json({
            items: [
              tenant === 'tenant-b'
                ? { ...base, id: 'connection-b', name: 'Источник организации B' }
                : base,
            ],
          }),
        )
      if (path.endsWith('/health/check'))
        return Promise.resolve(
          json({
            verification: 'REMOTE',
            health: { ...datedHealth, checkedAt: eventAt },
          }),
        )
      if (path.endsWith('/health')) return Promise.resolve(json(datedHealth))
      return Promise.resolve(fallback(request))
    })
    const page = await renderPage()
    await vi.waitFor(() =>
      expect(page.getComponent(IntegrationCard).get('dl').text()).toMatch(/3 нояб\.,\s+14:20/),
    )
    session.tenantId = 'tenant-b'
    await vi.waitFor(() => expect(page.text()).toContain('Источник организации B'))
    const cardB = page.getComponent(IntegrationCard)
    await vi.waitFor(() => expect(cardB.get('dl').text()).toContain('Часовой пояс не загружен'))
    expect(cardB.get('.source-read').text()).toContain('Часовой пояс не загружен')
    expect(cardB.text()).not.toMatch(/11:20|12:30|14:20|15:30/)

    await button(cardB, 'Проверить связь').trigger('click')
    await vi.waitFor(() => expect(cardB.text()).toContain('Связь с Telegram проверена'))
    expect(cardB.get('.source-read').text()).toContain('Часовой пояс не загружен')
    expect(cardB.text()).not.toMatch(/11:20|14:20/)
    const probes = fetchMock.mock.calls.filter(([request]) =>
      pathOf(request).endsWith('/health/check'),
    )
    expect(probes).toHaveLength(1)
    expect(probes[0]![0].headers.get('X-Tenant-ID')).toBe('tenant-b')
    expect(pathOf(probes[0]![0])).toContain('/connection-b/')

    organizationB.resolve(json({ defaultTimezone: 'Asia/Yekaterinburg' }))
    await vi.waitFor(() => expect(cardB.get('dl').text()).toMatch(/3 нояб\.,\s+16:20/))
    expect(cardB.get('.source-read').text()).toMatch(/Проверка выполнена 3 нояб\.,\s+16:20/)
    expect(cardB.text()).not.toContain('Часовой пояс не загружен')
    expect(cardB.text()).not.toMatch(/11:20|14:20/)
    expect(badge(cardB)).toBe('Активно')
  })
})
