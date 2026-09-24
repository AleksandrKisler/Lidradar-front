import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { notificationKeys } from '@/entities/notification'
import { TelegramLinkCard, useTelegramLink } from '@/features/link-telegram'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const errorResponse = (status: number, code: string) =>
  jsonResponse({ error: { code, message: 'raw', traceId: 't-1' } }, status)

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const futureToken = () => ({
  startUrl: 'https://t.me/lidradar_bot?start=one-time',
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
})

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

/** Разбирает вызовы `fetch` по методу и пути, чтобы проверять только смысл. */
function calls(fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>) {
  return fetchMock.mock.calls.map(
    ([request]) => `${request.method} ${new URL(request.url).pathname}`,
  )
}

describe('useTelegramLink', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
  let queryClient: QueryClient

  beforeEach(() => {
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
    queryClient = makeQueryClient()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  function mountLink(options: Parameters<typeof useTelegramLink>[1]) {
    let link!: ReturnType<typeof useTelegramLink>
    const wrapper = mount(
      defineComponent({
        setup() {
          link = useTelegramLink('tenant-a', options)
          return () => h('div')
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    )
    return { link, wrapper }
  }

  it('после выпуска ссылки опрашивает статус ограниченное число раз и останавливается', async () => {
    fetchMock.mockImplementation(async (request) =>
      request.method === 'POST'
        ? jsonResponse(futureToken(), 201)
        : jsonResponse({ linked: false }),
    )
    const { link, wrapper } = mountLink({ pollIntervalMs: 5, maxPolls: 2, isVisible: () => true })
    link.issue.mutate()
    await flushPromises()
    expect(link.token.value?.startUrl).toBe('https://t.me/lidradar_bot?start=one-time')
    await wait(60)
    await flushPromises()
    expect(calls(fetchMock).filter((call) => call.startsWith('GET'))).toEqual([
      'GET /api/v1/notifications/telegram-link',
      'GET /api/v1/notifications/telegram-link',
    ])
    expect(link.polls.value).toBe(2)
    expect(link.pollsExhausted.value).toBe(true)
    // Ссылка остаётся: пользователь может проверить вручную.
    expect(link.token.value).not.toBeNull()
    wrapper.unmount()
  })

  it('скрытая вкладка не опрашивает сервер и не расходует попытки', async () => {
    let visible = false
    fetchMock.mockImplementation(async (request) =>
      request.method === 'POST'
        ? jsonResponse(futureToken(), 201)
        : jsonResponse({ linked: false }),
    )
    const { link, wrapper } = mountLink({
      pollIntervalMs: 5,
      maxPolls: 3,
      isVisible: () => visible,
    })
    link.issue.mutate()
    await flushPromises()
    await wait(40)
    expect(calls(fetchMock).filter((call) => call.startsWith('GET'))).toHaveLength(0)
    expect(link.polls.value).toBe(0)
    visible = true
    await wait(40)
    await flushPromises()
    expect(link.polls.value).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('успешная привязка снимает ссылку, кладёт статус в кеш и перечитывает онбординг', async () => {
    let status = { linked: false }
    fetchMock.mockImplementation(async (request) =>
      request.method === 'POST' ? jsonResponse(futureToken(), 201) : jsonResponse(status),
    )
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { link, wrapper } = mountLink({ pollIntervalMs: 5, maxPolls: 5, isVisible: () => true })
    link.issue.mutate()
    await flushPromises()
    status = { linked: true, linkedAt: '2026-09-24T10:00:00Z' } as typeof status
    await wait(30)
    await flushPromises()
    expect(link.token.value).toBeNull()
    expect(queryClient.getQueryData(notificationKeys.link('tenant-a'))).toEqual(status)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tenant', 'tenant-a', 'onboarding'] })
    wrapper.unmount()
  })

  it('истёкшая ссылка помечается и больше не опрашивается', async () => {
    fetchMock.mockImplementation(async (request) =>
      request.method === 'POST'
        ? jsonResponse(
            { startUrl: 'https://t.me/bot?start=x', expiresAt: '2026-09-24T10:00:00Z' },
            201,
          )
        : jsonResponse({ linked: false }),
    )
    const { link, wrapper } = mountLink({
      pollIntervalMs: 5,
      isVisible: () => true,
      now: () => Date.parse('2026-09-24T10:00:01Z'),
    })
    link.issue.mutate()
    await flushPromises()
    await wait(30)
    expect(link.expired.value).toBe(true)
    expect(calls(fetchMock).filter((call) => call.startsWith('GET'))).toHaveLength(0)
    wrapper.unmount()
  })

  it('ручная проверка сообщает «ещё не привязан», отключение инвалидирует статус', async () => {
    fetchMock.mockImplementation(async (request) => {
      if (request.method === 'DELETE') return new Response(null, { status: 204 })
      return jsonResponse({ linked: false })
    })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { link, wrapper } = mountLink({ isVisible: () => true })
    await link.check.mutateAsync()
    expect(link.check.data.value).toBe(false)
    await link.disable.mutateAsync()
    expect(calls(fetchMock)).toContain('DELETE /api/v1/notifications/telegram-link')
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['tenant', 'tenant-a', 'telegram-link'],
    })
    wrapper.unmount()
  })
})

describe('TelegramLinkCard', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
  const body = () => new DOMWrapper(document.body)

  beforeEach(() => {
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  function mountCard() {
    return mount(TelegramLinkCard, {
      props: { tenantId: 'tenant-a', timeZone: 'Europe/Moscow' },
      global: { plugins: [[VueQueryPlugin, { queryClient: makeQueryClient() }]] },
      attachTo: document.body,
    })
  }

  it('не подключён: выпускает ссылку, открывает её безопасно и проверяет привязку', async () => {
    fetchMock.mockImplementation(async (request) =>
      request.method === 'POST'
        ? jsonResponse(futureToken(), 201)
        : jsonResponse({ linked: false }),
    )
    const wrapper = mountCard()
    await flushPromises()
    expect(wrapper.text()).toContain('Не подключены')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    const anchor = wrapper.get('a')
    expect(anchor.attributes('href')).toBe('https://t.me/lidradar_bot?start=one-time')
    expect(anchor.attributes('target')).toBe('_blank')
    expect(anchor.attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.text()).toContain('Ссылка действует до')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Проверить привязку')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('Привязка ещё не завершена')
    wrapper.unmount()
  })

  it('ссылка с чужой схемой не попадает в href', async () => {
    fetchMock.mockImplementation(async (request) =>
      request.method === 'POST'
        ? jsonResponse(
            {
              startUrl: 'javascript:alert(1)',
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
            201,
          )
        : jsonResponse({ linked: false }),
    )
    const wrapper = mountCard()
    await flushPromises()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toContain('Ссылка привязки непригодна')
    wrapper.unmount()
  })

  it('подключён: отключение требует подтверждения, ошибка показывается без серверного текста', async () => {
    fetchMock.mockImplementation(async (request) => {
      if (request.method === 'DELETE') return errorResponse(400, 'VALIDATION_FAILED')
      return jsonResponse({ linked: true, linkedAt: '2026-09-24T09:30:00Z' })
    })
    const wrapper = mountCard()
    await flushPromises()
    expect(wrapper.text()).toContain('Подключены')
    expect(wrapper.text()).toContain('Привязка активна с 24 сент.')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    const dialog = body().get('[role="dialog"]')
    expect(dialog.text()).toContain('Источник переписки организации это не затрагивает')
    await dialog
      .findAll('button')
      .find((button) => button.text() === 'Отключить')!
      .trigger('click')
    await flushPromises()
    expect(calls(fetchMock)).toContain('DELETE /api/v1/notifications/telegram-link')
    expect(wrapper.text()).not.toContain('raw')
    expect(wrapper.get('[role="alert"]').text()).toContain('t-1')
    wrapper.unmount()
  })
})
