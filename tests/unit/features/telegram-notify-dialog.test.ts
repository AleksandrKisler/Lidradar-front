import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { TelegramNotifyDialog } from '@/features/link-telegram'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const token = (ms = 15 * 60_000) => ({
  startUrl: 'https://t.me/lidradar_bot?start=one-time',
  expiresAt: new Date(Date.now() + ms).toISOString(),
})

const body = () => new DOMWrapper(document.body)
const dialog = () => body().get('[role="dialog"]')

describe('окно «Уведомления в Telegram»', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>

  beforeEach(() => {
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  function mountDialog() {
    return mount(TelegramNotifyDialog, {
      props: { tenantId: 'tenant-a' },
      global: {
        plugins: [
          [
            VueQueryPlugin,
            { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          ],
        ],
      },
      attachTo: document.body,
    })
  }

  const posts = () => fetchMock.mock.calls.filter(([request]) => request.method === 'POST').length

  it('без привязки сам выпускает ссылку один раз и показывает остаток срока', async () => {
    fetchMock.mockImplementation(async (request) =>
      request.method === 'POST' ? jsonResponse(token(), 201) : jsonResponse({ linked: false }),
    )
    const wrapper = mountDialog()
    await flushPromises()
    expect(posts()).toBe(1)
    const link = dialog().get('a[href^="https://t.me/"]')
    expect(link.text()).toBe('Открыть бота')
    expect(link.attributes('rel')).toContain('noopener')
    expect(dialog().text()).toMatch(/Ссылка действует ещё 15 минут/)
    expect(dialog().text()).toContain('Что не меняется')
    expect(dialog().text()).toContain('Личные уведомления можно настроить позже.')
    wrapper.unmount()
  })

  it('уже подключённый аккаунт: ссылка не выпускается, показано подтверждение и «Готово»', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ linked: true, linkedAt: '2026-10-23T12:00:00Z' }),
    )
    const wrapper = mountDialog()
    await flushPromises()
    expect(posts()).toBe(0)
    expect(dialog().text()).toContain('Уведомления успешно подключены')
    expect(dialog().text()).toContain('Привязка действует для вашего аккаунта.')
    await dialog()
      .findAll('button')
      .find((button) => button.text() === 'Готово')!
      .trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('ссылка не со схемой Telegram не вставляется в href', async () => {
    fetchMock.mockImplementation(async (request) =>
      request.method === 'POST'
        ? jsonResponse({ ...token(), startUrl: 'javascript:alert(1)' }, 201)
        : jsonResponse({ linked: false }),
    )
    const wrapper = mountDialog()
    await flushPromises()
    expect(dialog().find('a[href]').exists()).toBe(false)
    expect(dialog().text()).toContain('Ссылка привязки непригодна')
    // Кнопка не называется «Открыть бота», пока открывать нечего.
    expect(
      dialog()
        .findAll('button')
        .map((button) => button.text()),
    ).toContain('Обновить ссылку')
    expect(dialog().text()).not.toContain('Открыть бота')
    wrapper.unmount()
  })

  it('«Обновить ссылку» после сбоя выпуска выпускает новую, «Проверить привязку» читает статус', async () => {
    let issued = 0
    fetchMock.mockImplementation(async (request) => {
      if (request.method === 'POST') {
        issued += 1
        return issued === 1
          ? jsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'raw', traceId: 't-1' } }, 500)
          : jsonResponse(token(), 201)
      }
      return jsonResponse({ linked: false })
    })
    const wrapper = mountDialog()
    await flushPromises()
    const refresh = dialog()
      .findAll('button')
      .find((button) => button.text() === 'Обновить ссылку')!
    expect(refresh.exists()).toBe(true)
    await refresh.trigger('click')
    await flushPromises()
    expect(issued).toBe(2)
    expect(dialog().find('a[href^="https://t.me/"]').exists()).toBe(true)
    await dialog()
      .findAll('button')
      .find((button) => button.text() === 'Проверить привязку')!
      .trigger('click')
    await flushPromises()
    expect(dialog().text()).toContain('Привязка ещё не завершена')
    wrapper.unmount()
  })

  it('пока статус читается, показана загрузка, а не кнопки', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const wrapper = mountDialog()
    await flushPromises()
    expect(dialog().find('[role="status"][aria-label="Загружаем статус"]').exists()).toBe(true)
    expect(dialog().text()).not.toContain('Открыть бота')
    expect(posts()).toBe(0)
    wrapper.unmount()
  })

  it('закрытие окна до ответа выпуска не запускает опрос статуса', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] })
    let release!: () => void
    fetchMock.mockImplementation(async (request) => {
      if (request.method === 'POST') {
        await new Promise<void>((resolve) => (release = resolve))
        return jsonResponse(token(), 201)
      }
      return jsonResponse({ linked: false })
    })
    const wrapper = mountDialog()
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    expect(posts()).toBe(1)
    wrapper.unmount()
    release()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    const gets = fetchMock.mock.calls.filter(([request]) => request.method === 'GET').length
    expect(gets).toBe(1)
    vi.useRealTimers()
  })

  it('сбой чтения статуса: «Повторить» читает снова и после успеха выпускает ссылку', async () => {
    let reads = 0
    fetchMock.mockImplementation(async (request) => {
      if (request.method === 'POST') return jsonResponse(token(), 201)
      reads += 1
      return reads === 1
        ? jsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'raw', traceId: 't-1' } }, 500)
        : jsonResponse({ linked: false })
    })
    const wrapper = mountDialog()
    await flushPromises()
    expect(dialog().text()).toContain('Не удалось прочитать статус привязки')
    expect(posts()).toBe(0)
    await dialog()
      .findAll('button')
      .find((button) => button.text() === 'Повторить')!
      .trigger('click')
    await flushPromises()
    expect(posts()).toBe(1)
    expect(dialog().find('a[href^="https://t.me/"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
