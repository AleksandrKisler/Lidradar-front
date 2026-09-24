import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { ConversationThread, anchoredScrollTop } from '@/widgets/conversation-thread'
import {
  conversationDetailFixture,
  newestPageFixture,
  olderPageFixture,
} from '../fixtures/conversation'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubApi(options: { detailStatus?: number } = {}) {
  const fetchMock = vi.fn((request: Request) => {
    const url = new URL(request.url)
    if (url.pathname.endsWith('/messages')) {
      const older = url.searchParams.get('cursor') === 'older'
      return Promise.resolve(
        jsonResponse({
          items: older ? olderPageFixture : newestPageFixture,
          nextCursor: older ? null : 'older',
        }),
      )
    }
    if (options.detailStatus && options.detailStatus !== 200) {
      return Promise.resolve(
        jsonResponse(
          { error: { code: 'NOT_FOUND', message: '', traceId: 't' } },
          options.detailStatus,
        ),
      )
    }
    return Promise.resolve(jsonResponse(conversationDetailFixture))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function mountThread() {
  return mount(ConversationThread, {
    props: {
      tenantId: 'tenant-a',
      conversationId: conversationDetailFixture.conversation.id,
      timeZone: 'Europe/Moscow',
    },
    global: {
      plugins: [
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
      ],
    },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('якорь прокрутки', () => {
  it('сдвигает прокрутку на прирост высоты', () => {
    expect(anchoredScrollTop(120, 1000, 1600)).toBe(720)
    expect(anchoredScrollTop(120, 1000, 900)).toBe(120)
  })
})

describe('ConversationThread', () => {
  it('показывает контакт, канал, ссылку и сообщения в хронологическом порядке', async () => {
    stubApi()
    const wrapper = mountThread()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Дмитрий Соколов'))
    await vi.waitFor(() =>
      expect(wrapper.findAll('[aria-label="Сообщения"] li').length).toBeGreaterThan(0),
    )
    expect(wrapper.text()).toContain('Telegram Business · подключён')
    expect(wrapper.get('a[target="_blank"]').attributes('href')).toBe('tg://user?id=123')
    const bubbles = wrapper.findAll('[aria-label="Сообщения"] li[aria-label]')
    expect(bubbles.map((bubble) => bubble.attributes('aria-label')?.split(',')[0])).toEqual([
      'Клиент',
      'Менеджер',
      'Клиент',
    ])
    expect(bubbles[0]!.text()).toContain('Изображение')
    expect(bubbles[0]!.text()).toContain('Вложение недоступно')
    expect(bubbles[2]!.text()).toContain('А на какое время можно завтра?')
    expect(wrapper.text()).toContain('Показать более ранние')
    wrapper.unmount()
  })

  it('подгружает более ранние сообщения сверху и показывает заглушку удалённого', async () => {
    const fetchMock = stubApi()
    const wrapper = mountThread()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Показать более ранние'))
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Показать более ранние')!
      .trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Сообщение удалено в мессенджере.'))
    await flushPromises()
    const bubbles = wrapper.findAll('[aria-label="Сообщения"] li[aria-label]')
    expect(bubbles[0]!.text()).toContain('Сообщение удалено')
    expect(bubbles[0]!.text()).not.toContain('Удалённый текст')
    expect(wrapper.text()).toContain('Начало переписки')
    // Фикстуры датированы 18 сентября 2026 года: разделители — календарные дни, не «Сегодня».
    expect(wrapper.text()).toContain('17 сентября')
    expect(wrapper.text()).toContain('18 сентября')
    const olderCall = fetchMock.mock.calls.find(
      ([request]) => new URL(request.url).searchParams.get('cursor') === 'older',
    )
    expect(olderCall).toBeDefined()
    wrapper.unmount()
  })

  it('404 даёт нейтральное «не найдено» без запроса сообщений на экране', async () => {
    stubApi({ detailStatus: 404 })
    const wrapper = mountThread()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Переписка не найдена'))
    expect(wrapper.find('a[target="_blank"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
