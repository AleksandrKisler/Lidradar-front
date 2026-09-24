import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ConversationList } from '@/widgets/conversation-list'
import { conversationItemFixture } from '../fixtures/conversation'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function mountList(items = [conversationItemFixture], filters = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(jsonResponse({ items, nextCursor: null }))),
  )
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/conversations', name: 'conversations', component: { template: '<div />' } },
      {
        path: '/conversations/:conversationId',
        name: 'conversation',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/conversations')
  const wrapper = mount(ConversationList, {
    props: { tenantId: 'tenant-a', filters, selectedId: null, timeZone: 'Europe/Moscow' },
    global: {
      plugins: [
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
        router,
      ],
    },
  })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('ConversationList', () => {
  it('строки — ссылки на переписку с бейджем риска и превью', async () => {
    const wrapper = await mountList()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Дмитрий Соколов'))
    const link = wrapper.get('a[href^="/conversations/"]')
    expect(link.attributes('href')).toBe(
      `/conversations/${conversationItemFixture.conversation.id}`,
    )
    expect(link.text()).toContain('Критичный риск')
    expect(link.text()).toContain('А на какое время можно завтра?')
    expect(wrapper.text()).toContain('Это все переписки по выбранным условиям.')
    wrapper.unmount()
  })

  it('поиск уходит в фильтры с задержкой, переключатель — сразу', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const wrapper = await mountList()
    await wrapper.get('input[name="search"]').setValue('Дима')
    expect(wrapper.emitted('update:filters')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(350)
    expect(wrapper.emitted('update:filters')?.at(-1)).toEqual([{ search: 'Дима' }])
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'С риском')!
      .trigger('click')
    expect(wrapper.emitted('update:filters')?.at(-1)).toEqual([{ withRisk: true }])
    wrapper.unmount()
  })

  it('пустой результат с фильтрами предлагает сброс, без фильтров — предметный zero-state', async () => {
    const filtered = await mountList([], { search: 'нет' })
    await vi.waitFor(() => expect(filtered.text()).toContain('Ничего не найдено'))
    await filtered
      .findAll('button')
      .find((button) => button.text() === 'Сбросить фильтры')!
      .trigger('click')
    expect(filtered.emitted('update:filters')?.at(-1)).toEqual([{}])
    filtered.unmount()
    const empty = await mountList([])
    await vi.waitFor(() => expect(empty.text()).toContain('Переписок пока нет'))
    empty.unmount()
  })
})
