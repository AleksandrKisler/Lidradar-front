import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore, type AuthMeResponse } from '@/entities/session'
import { RiskWorkspace } from '@/widgets/risk-workspace'
import { riskDetailFixture } from '../fixtures/risk-detail'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

const organization = {
  id: 'tenant-a',
  name: 'Студия',
  defaultTimezone: 'Europe/Moscow',
  defaultCurrency: 'RUB',
  status: 'ACTIVE',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Подменяет fetch: организация и карточка риска; карточку можно менять между запросами. */
function stubApi(detail: () => unknown | Error) {
  const fetchMock = vi.fn((request: Request) => {
    const path = new URL(request.url).pathname
    if (path === '/api/v1/organization') return Promise.resolve(jsonResponse(organization))
    // Сделка читается отдельным запросом: история этапов есть только в нём.
    if (path.startsWith('/api/v1/opportunities/')) {
      return Promise.resolve(
        jsonResponse({
          opportunity: { id: 'opp-1', stage: 'NEW', currency: 'RUB' },
          stageHistory: [
            {
              id: 'h-1',
              opportunityId: 'opp-1',
              fromStage: null,
              toStage: 'NEW',
              source: 'RULE',
              confidence: null,
              aiRunId: null,
              actorUserId: null,
              createdAt: '2026-09-18T09:00:00Z',
            },
          ],
        }),
      )
    }
    const current = detail()
    if (current instanceof Error) return Promise.reject(current)
    return Promise.resolve(jsonResponse(current))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function mountWorkspace(role: AuthMeResponse['memberships'][number]['role'] = 'OWNER') {
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
    memberships: [{ tenantId: 'tenant-a', organizationName: 'A', role }],
  })
  await useSessionStore().bootstrap()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = mount(RiskWorkspace, {
    props: { tenantId: 'tenant-a', riskId: 'risk-1' },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  })
  await vi.waitFor(() => expect(wrapper.find('h1').exists()).toBe(true), { timeout: 2000 })
  await flushPromises()
  return wrapper
}

beforeEach(() => vi.mocked(fetchMe).mockReset())
afterEach(() => vi.unstubAllGlobals())

describe('RiskWorkspace', () => {
  it('показывает контекст и команды активного риска владельцу', async () => {
    stubApi(() => riskDetailFixture)
    const wrapper = await mountWorkspace()
    expect(wrapper.get('h1').text()).toBe('Ирина')
    const text = wrapper.text()
    expect(text).toContain('Почему это риск')
    expect(text).toContain('Бизнес не ответил клиенту в течение 60 рабочих минут')
    expect(text).toContain('Ответить клиенту сейчас.')
    expect(text).toContain('Полировка')
    expect(text).toContain('Взять в работу')
    expect(text).toContain('Закрыть риск')
    expect(text).toContain('Записать действие')
    expect(text).toContain('Записать исход')
    expect(text).toContain('Открыть в Telegram')
    expect(wrapper.get('[aria-label="История"]').text()).toContain('Звонок клиенту')
    expect(wrapper.get('[aria-label="История"]').text()).toContain('Думает')
    wrapper.unmount()
  })

  it('терминальный риск — только чтение, без форм и команд', async () => {
    stubApi(() => ({
      ...riskDetailFixture,
      risk: { ...riskDetailFixture.risk, status: 'RESOLVED', resolvedAt: '2026-09-18T12:00:00Z' },
      recommendation: null,
    }))
    const wrapper = await mountWorkspace('MANAGER')
    const text = wrapper.text()
    expect(text).toContain('Риск закрыт: история доступна только для чтения.')
    expect(text).not.toContain('Взять в работу')
    expect(text).not.toContain('Записать действие')
    expect(text).not.toContain('Получить рекомендацию')
    expect(text).toContain('Рекомендации по этому риску пока нет.')
    expect(wrapper.find('select[name="actionType"]').exists()).toBe(false)
    expect(wrapper.find('select[name="outcomeStatus"]').exists()).toBe(false)
    // Оценить сигнал можно и по закрытому риску: панель вердикта остаётся.
    expect(text).toContain('Оценка сигнала')
    expect(wrapper.find('input[value="FALSE_POSITIVE"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('ошибка при обновлении не стирает снимок, ошибка без снимка даёт экран ошибки', async () => {
    let failing = false
    stubApi(() => (failing ? new TypeError('offline') : riskDetailFixture))
    const wrapper = await mountWorkspace()
    failing = true
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Обновить')!
      .trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Не удалось обновить данные'))
    expect(wrapper.get('h1').text()).toBe('Ирина')
    wrapper.unmount()

    const errorWrapper = mount(RiskWorkspace, {
      props: { tenantId: 'tenant-a', riskId: 'risk-1' },
      global: {
        plugins: [
          [
            VueQueryPlugin,
            { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          ],
        ],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await vi.waitFor(() => expect(errorWrapper.text()).toContain('Не удалось загрузить риск'))
    expect(errorWrapper.find('h1').exists()).toBe(false)
    errorWrapper.unmount()
  })
})
