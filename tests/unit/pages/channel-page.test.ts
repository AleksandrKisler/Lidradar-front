import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '@/app/router/routes'
import { fetchMe, useSessionStore } from '@/entities/session'
import { ChannelPage } from '@/pages/onboarding'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

const user = {
  id: 'user-1',
  email: 'a@b.c',
  displayName: 'Мария Владелец',
  status: 'ACTIVE' as const,
  createdAt: '2026-10-13T00:00:00Z',
  updatedAt: '2026-10-13T00:00:00Z',
  emailVerifiedAt: null,
  deletionDueAt: null,
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}
const bot = (overrides: Record<string, unknown> = {}) => ({
  id: 'c-1',
  locationId: null,
  provider: 'CONNECTED_BUSINESS_BOT',
  name: '@LidradarExample_bot',
  status: 'ACTIVE',
  capabilities: ['CAN_RECEIVE_MESSAGES'],
  lastEventAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorCode: null,
  createdAt: '2026-10-23T12:00:00Z',
  updatedAt: '2026-10-23T12:00:00Z',
  ...overrides,
})
const statusBody = (channel: boolean, linked: boolean) => ({
  complete: channel,
  nextStep: channel ? 'TELEGRAM_LINK' : 'CHANNEL',
  steps: [
    { key: 'ORGANIZATION', required: true, done: true },
    { key: 'LOCATION', required: true, done: true },
    { key: 'SERVICES', required: true, done: true },
    { key: 'CHANNEL', required: true, done: channel },
    { key: 'TELEGRAM_LINK', required: false, done: linked },
  ],
  facts: {},
  computedAt: '2026-10-23T12:40:00Z',
})

/** Шаг 4 «Источник сообщений» (US-M02-03/04): состояния по макетам «Исходное», «Ошибка», «Проверяем», «Подключён», «Всё подключено». */
describe('страница «Источник сообщений» (шаг 4)', () => {
  let statusResponse: () => Promise<Response>
  let integrationsResponse: () => Promise<Response>
  let statusCalls: number

  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    statusCalls = 0
    vi.mocked(fetchMe).mockResolvedValue({
      user,
      memberships: [{ tenantId: 't-1', organizationName: 'Студия', role: 'OWNER' }],
      canCreateOrganization: false,
    })
    await useSessionStore().bootstrap()
    statusResponse = async () => json(statusBody(false, false))
    integrationsResponse = async () => json({ items: [] })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        const path = new URL(request.url).pathname
        if (path === '/api/v1/organization/onboarding') {
          statusCalls += 1
          return statusResponse()
        }
        if (path === '/api/v1/integrations') return integrationsResponse()
        if (path === '/api/v1/locations') return json({ items: [] })
        if (path === '/api/v1/me/telegram-link' || path.endsWith('/telegram-link'))
          return json({ linked: false })
        if (path === '/api/v1/organization')
          return json({
            id: 't-1',
            name: 'Студия',
            defaultTimezone: 'Europe/Moscow',
            defaultCurrency: 'RUB',
            status: 'ACTIVE',
            createdAt: '2026-09-01T00:00:00Z',
            updatedAt: '2026-09-01T00:00:00Z',
          })
        return json({ error: { code: 'NOT_FOUND', message: 'x', traceId: 't' } }, 404)
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  async function mountPage() {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/onboarding/channel')
    await router.isReady()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = mount(ChannelPage, {
      attachTo: document.body,
      global: { plugins: [router, [VueQueryPlugin, { queryClient: client }]] },
    })
    await settle()
    return { wrapper, router, client }
  }
  const button = (wrapper: ReturnType<typeof mount>, text: string) =>
    wrapper.findAll('button').find((b) => b.text() === text)

  it('источника нет: «Подключите Telegram», кнопка подключения, MAX недоступен, «Подключу позже»', async () => {
    const { wrapper } = await mountPage()
    expect(wrapper.get('h1').text()).toBe('Источник сообщений')
    expect(wrapper.get('#source-title').text()).toBe('Подключите Telegram')
    expect(button(wrapper, 'Подключить Telegram')).toBeDefined()
    expect(button(wrapper, 'Подключить MAX')!.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Интеграция с MAX в работе.')
    expect(wrapper.text()).toContain('Уведомления в Telegram')
    expect(wrapper.text()).toContain('— личные, необязательно')
    expect(wrapper.text()).toContain('Без источника в LidRadar не появится ни одного риска.')
    expect(button(wrapper, 'Подключу позже')).toBeDefined()
    expect(button(wrapper, 'Перейти в Radar')).toBeUndefined()
    wrapper.unmount()
  })

  it('«Подключу позже» ведёт в Radar, «Назад» — к шагу 3', async () => {
    const { wrapper, router } = await mountPage()
    await button(wrapper, 'Назад')!.trigger('click')
    await settle()
    expect(router.currentRoute.value.name).toBe('onboarding-services')
    await router.push('/onboarding/channel')
    await button(wrapper, 'Подключу позже')!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('radar'), { timeout: 3000 })
    wrapper.unmount()
  })

  it('первичная загрузка статуса: каркас карточки, подключить нельзя', async () => {
    statusResponse = () => new Promise(() => {})
    const { wrapper } = await mountPage()
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe(
      'Загрузка статуса источника',
    )
    expect(button(wrapper, 'Подключить Telegram')).toBeUndefined()
    expect(button(wrapper, 'Подключу позже')).toBeDefined()
    wrapper.unmount()
  })

  it('сбой проверки: «Повторить проверку» и сообщение; повтор перечитывает статус', async () => {
    statusResponse = async () =>
      json({ error: { code: 'INTERNAL', message: 'x', traceId: 't-3' } }, 500)
    const { wrapper } = await mountPage()
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось проверить подключение')
    const calls = statusCalls
    statusResponse = async () => json(statusBody(false, false))
    await button(wrapper, 'Повторить проверку')!.trigger('click')
    await settle()
    expect(statusCalls).toBeGreaterThan(calls)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(button(wrapper, 'Подключить Telegram')).toBeDefined()
    wrapper.unmount()
  })

  it('источник подключён: карточка, имя подключения, «Слушает входящие», «Перейти в Radar»', async () => {
    statusResponse = async () => json(statusBody(true, false))
    integrationsResponse = async () => json({ items: [bot()] })
    const { wrapper } = await mountPage()
    expect(wrapper.get('#source-title').text()).toBe('Telegram подключён')
    expect(wrapper.text()).toContain('Источник переписки · @LidradarExample_bot')
    expect(wrapper.text()).toContain('Слушает входящие')
    expect(wrapper.text()).toContain(
      'Источник подключён. Личные уведомления можно настроить позже.',
    )
    expect(button(wrapper, 'Перейти в Radar')).toBeDefined()
    expect(button(wrapper, 'Подключу позже')).toBeUndefined()
    expect(wrapper.get('a[href="/integrations"]').text()).toBe('Управлять в «Интеграциях»')
    wrapper.unmount()
  })

  it('подключение с перебоями: честное состояние вместо «Слушает входящие»', async () => {
    statusResponse = async () => json(statusBody(true, false))
    integrationsResponse = async () => json({ items: [bot({ status: 'DEGRADED' })] })
    const { wrapper } = await mountPage()
    expect(wrapper.text()).not.toContain('Слушает входящие')
    expect(wrapper.text()).toContain('С перебоями')
    expect(wrapper.text()).toContain('Подключение требует внимания')
    expect(wrapper.text()).toContain('Источник подключён, но работает не полностью.')
    wrapper.unmount()
  })

  it('источник и уведомления подключены: «— подключены», итоговый текст, без бейджа', async () => {
    statusResponse = async () => json(statusBody(true, true))
    integrationsResponse = async () => json({ items: [bot()] })
    const { wrapper } = await mountPage()
    expect(wrapper.text()).toContain('— подключены')
    expect(wrapper.text()).toContain(
      'Источник и личные уведомления подключены. Можно перейти в Radar.',
    )
    expect(wrapper.text()).not.toContain('Слушает входящие')
    wrapper.unmount()
  })

  it('менеджер без права на интеграции: источник подключён — без утверждений о состоянии и без запроса подключений', async () => {
    vi.mocked(fetchMe).mockResolvedValue({
      user,
      memberships: [{ tenantId: 't-1', organizationName: 'Студия', role: 'MANAGER' }],
      canCreateOrganization: false,
    })
    await useSessionStore().refresh()
    statusResponse = async () => json(statusBody(true, false))
    const integrations = vi.fn(async () => json({ items: [bot()] }))
    integrationsResponse = integrations
    const { wrapper } = await mountPage()
    expect(wrapper.get('#source-title').text()).toBe('Telegram подключён')
    expect(wrapper.text()).not.toContain('требует внимания')
    expect(wrapper.text()).not.toContain('Слушает входящие')
    expect(wrapper.text()).toContain('Состояние подключения смотрите в «Интеграциях».')
    expect(integrations).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('источник подключён, а чтение подключений упало: «Telegram подключён» и предупреждение с повтором, без «Подключите»', async () => {
    statusResponse = async () => json(statusBody(true, false))
    integrationsResponse = async () =>
      json({ error: { code: 'INTERNAL', message: 'x', traceId: 't-8' } }, 500)
    const { wrapper } = await mountPage()
    expect(wrapper.get('#source-title').text()).toBe('Telegram подключён')
    expect(wrapper.text()).not.toContain('Подключите Telegram')
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось проверить состояние')
    integrationsResponse = async () => json({ items: [bot()] })
    await button(wrapper, 'Повторить проверку')!.trigger('click')
    await settle()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Слушает входящие')
    wrapper.unmount()
  })

  it.each(['ERROR', 'DEGRADED'])(
    'подключение в статусе %s не называется «Слушает входящие»',
    async (state) => {
      statusResponse = async () => json(statusBody(true, false))
      integrationsResponse = async () => json({ items: [bot({ status: state })] })
      const { wrapper } = await mountPage()
      expect(wrapper.text()).not.toContain('Слушает входящие')
      expect(wrapper.text()).toContain('Подключение требует внимания')
      wrapper.unmount()
    },
  )

  it('«Повторить проверку»: на время проверки кнопка «Проверяем…» с прежним именем, сообщение скрыто', async () => {
    statusResponse = async () =>
      json({ error: { code: 'INTERNAL', message: 'x', traceId: 't-3' } }, 500)
    const { wrapper } = await mountPage()
    let finish: (response: Response) => void = () => {}
    statusResponse = () => new Promise((resolve) => (finish = resolve))
    await button(wrapper, 'Повторить проверку')!.trigger('click')
    await settle()
    const busy = wrapper.get('button[aria-busy="true"]')
    expect(busy.get('span[aria-hidden="true"]').text()).toBe('Проверяем…')
    expect(busy.get('.sr-only').text()).toBe('Повторить проверку')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    finish(json(statusBody(false, false)))
    await settle()
    expect(button(wrapper, 'Подключить Telegram')).toBeDefined()
    wrapper.unmount()
  })

  it('фоновое обновление (возврат во вкладку) не подменяет «Подключить Telegram» на «Проверяем…»', async () => {
    const { wrapper, client } = await mountPage()
    let finish: (response: Response) => void = () => {}
    statusResponse = () => new Promise((resolve) => (finish = resolve))
    void client.refetchQueries()
    await settle()
    expect(button(wrapper, 'Подключить Telegram')!.attributes('disabled')).toBeUndefined()
    expect(wrapper.find('button[aria-busy="true"]').exists()).toBe(false)
    finish(json(statusBody(false, false)))
    await settle()
    wrapper.unmount()
  })

  it('«Уведомления в Telegram» открывает окно с личной привязкой', async () => {
    const { wrapper } = await mountPage()
    await button(wrapper, 'Уведомления в Telegram')!.trigger('click')
    await settle()
    const dialog = new DOMWrapper(document.body).find('[role="dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.text()).toContain('Личная привязка · Необязательная настройка')
    wrapper.unmount()
  })
})
