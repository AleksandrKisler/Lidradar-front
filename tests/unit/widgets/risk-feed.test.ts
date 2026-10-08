import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore } from '@/entities/session'
import { RiskFeed } from '@/widgets/risk-feed'
import { riskDetailFixture } from '../fixtures/risk-detail'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function mountFeed(items: unknown[], props: Record<string, unknown> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(jsonResponse({ items, nextCursor: null }))),
  )
  const wrapper = mount(RiskFeed, {
    props: { tenantId: 'tenant-a', filters: {}, timeZone: 'UTC', ...props },
    global: {
      plugins: [
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
      ],
      // Цель ссылки попадает в атрибут: так видно, куда ведёт действие.
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
        },
      },
    },
  })
  await vi.waitFor(() => expect(wrapper.find('[role="status"][aria-label]').exists()).toBe(false), {
    timeout: 2000,
  })
  await flushPromises()
  return wrapper
}

describe('лента Radar: пустое состояние', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.mocked(fetchMe).mockResolvedValue({
      user: {
        id: 'u',
        email: 'a@b.c',
        displayName: 'A',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [{ tenantId: 'tenant-a', organizationName: 'A', role: 'OWNER' }],
    })
    await useSessionStore().bootstrap()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('источник подключён или неизвестен: спокойное «всё под контролем»', async () => {
    const wrapper = await mountFeed([])
    expect(wrapper.text()).toContain('Сейчас всё под контролем')
    expect(wrapper.text()).not.toContain('Источник сообщений не подключён')
    wrapper.unmount()
  })

  it('источник не подключён: честное сообщение и путь к подключению вместо успокоения', async () => {
    const wrapper = await mountFeed([], { sourceMissing: true, canConnectSource: true })
    expect(wrapper.get('h2:not(#risk-feed-title)').text()).toBe('Источник сообщений не подключён')
    expect(wrapper.text()).toContain('Подключите Telegram или webhook')
    expect(wrapper.text()).not.toContain('под контролем')
    const link = wrapper.get('a')
    expect(link.text()).toBe('Подключить источник')
    expect(JSON.parse(link.attributes('data-to')!)).toEqual({ name: 'integrations' })
    wrapper.unmount()
  })

  it('источник не подключён, а прав подключать нет: объяснение без кнопки', async () => {
    const wrapper = await mountFeed([], { sourceMissing: true, canConnectSource: false })
    expect(wrapper.text()).toContain('Источник сообщений не подключён')
    expect(wrapper.text()).toContain('подключает владелец организации')
    expect(wrapper.find('a').exists()).toBe(false)
    wrapper.unmount()
  })

  it('есть риски: показывается список, пустое состояние не нужно', async () => {
    const wrapper = await mountFeed([riskDetailFixture], { sourceMissing: true })
    expect(wrapper.text()).not.toContain('Источник сообщений не подключён')
    expect(wrapper.find('ul[aria-label="Список активных рисков"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
