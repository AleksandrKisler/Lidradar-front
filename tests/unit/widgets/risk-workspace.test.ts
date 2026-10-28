import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore, type AuthMeResponse } from '@/entities/session'
import { RiskWorkspace } from '@/widgets/risk-workspace'
import { riskDetailFixture } from '../fixtures/risk-detail'
import { writePendingCommand } from '@/shared/api/client/pending-command'

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
    if (path === '/api/v1/locations') {
      return Promise.resolve(
        jsonResponse({ items: [{ id: 'loc-1', name: 'Тверская' }], nextCursor: null }),
      )
    }
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
    canCreateOrganization: false,
    user: {
      emailVerifiedAt: null,
      deletionDueAt: null,
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

beforeEach(() => {
  vi.mocked(fetchMe).mockReset()
  localStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

describe('RiskWorkspace', () => {
  it('после reload закрытого риска позволяет повторить только сохранённое действие', async () => {
    const key = 'b9b0c437-e0e6-43f4-ab75-7d037df4b0cf'
    writePendingCommand(JSON.stringify(['u', 'tenant-a', 'action', 'risk-1']), {
      key,
      state: 'submitting',
      body: { type: 'CALL', note: 'Уже позвонили' },
    })
    const fetchMock = stubApi(() => ({
      ...riskDetailFixture,
      risk: { ...riskDetailFixture.risk, status: 'RESOLVED' },
    }))
    const wrapper = await mountWorkspace()
    expect(wrapper.text()).toContain('Проверить незавершённое действие')
    expect(wrapper.text()).toContain('Результат неизвестен')
    expect(wrapper.get('select[name="actionType"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('select[name="outcomeStatus"]').exists()).toBe(false)
    const posts: Request[] = []
    const original = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((request: Request) => {
      if (request.method === 'POST') {
        posts.push(request)
        return Promise.resolve(
          jsonResponse({ action: riskDetailFixture.actions[0], replayed: true }),
        )
      }
      return original(request)
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Повторить отправку')!
      .trigger('click')
    await flushPromises()
    expect(posts).toHaveLength(1)
    expect(posts[0]!.headers.get('Idempotency-Key')).toBe(key)
    expect(await posts[0]!.json()).toEqual({ type: 'CALL', note: 'Уже позвонили' })
    wrapper.unmount()
  })
  it('показывает контекст и команды активного риска владельцу', async () => {
    stubApi(() => riskDetailFixture)
    const wrapper = await mountWorkspace()
    // Дизайн v2: заголовок — тип риска, имя клиента — в подзаголовке.
    expect(wrapper.get('h1').text()).toBe('Нет ответа клиенту')
    const text = wrapper.text()
    expect(text).toContain('Ирина')
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
    expect(wrapper.get('[aria-label="История"]').text()).not.toContain('Думает')
    expect(wrapper.get('[aria-labelledby="risk-last-outcome-title"]').text()).toContain('Думает')
    wrapper.unmount()
  })

  it('показывает конкретную причину и неизвестные услугу и сумму при известном канале', async () => {
    stubApi(() => ({
      ...riskDetailFixture,
      risk: {
        ...riskDetailFixture.risk,
        type: 'UNFINISHED_AGREEMENT',
        severity: 'MEDIUM',
        reason: 'Клиент пока не подтвердил предложенное время записи',
      },
      opportunity: { ...riskDetailFixture.opportunity, serviceId: null, potentialRevenue: null },
      service: null,
      revenue: { currency: 'RUB', potential: '0.00', confirmedRecovered: '0.00' },
    }))
    const wrapper = await mountWorkspace()
    const text = wrapper.text()
    expect(text).toContain('Договорённость требует внимания')
    expect(text).toContain('Клиент пока не подтвердил предложенное время записи')
    // Имя точки — по locationId, а не имя канала.
    expect(text).toMatch(/Услуга не уточнена\s*· Тверская/)
    expect(text).toContain('Сумма не определена')
    const money = wrapper.get('[aria-labelledby="risk-money-title"]').text()
    expect(money).toContain('Потенциал сделки')
    expect(money).toContain('Сумма не определена')
    wrapper.unmount()
  })

  it('показывает срок по правилу и время обнаружения, а не длительность ожидания', async () => {
    stubApi(() => riskDetailFixture)
    const wrapper = await mountWorkspace()
    const hero = wrapper.get('[aria-labelledby="risk-reason-title"]').text()
    expect(hero).toContain('Срок по правилу')
    expect(hero).toContain('18 сентября, 12:00')
    expect(hero).toContain('Риск обнаружен')
    expect(hero).toContain('18 сентября, 13:00')
    expect(hero).toContain('Часовой пояс: Europe/Moscow')
    expect(hero).not.toContain('Ожидание')
    expect(hero).not.toContain('Срок ответа не наступил')
    wrapper.unmount()
  })

  it('срок в будущем, отсутствие даты и закрытый риск не выдумывают ожидание', async () => {
    stubApi(() => ({
      ...riskDetailFixture,
      risk: {
        ...riskDetailFixture.risk,
        type: 'FOLLOW_UP_CANDIDATE',
        status: 'RESOLVED',
        dueAt: '2999-01-01T09:00:00Z',
        detectedAt: null,
      },
    }))
    const wrapper = await mountWorkspace()
    const hero = wrapper.get('[aria-labelledby="risk-reason-title"]').text()
    expect(hero).toContain('1 января, 12:00')
    expect(hero).toContain('Не указан')
    expect(hero).not.toContain('Срок ответа не наступил')
    expect(hero).not.toContain('Ожидание')
    expect(hero).toContain('Риск закрыт')
    wrapper.unmount()
  })

  it('без внешней ссылки показывает отключённую кнопку Telegram и связанное пояснение', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubApi(() => ({
      ...riskDetailFixture,
      externalLink: { url: null, kind: null, unavailableReason: 'PROVIDER_UNSUPPORTED' },
    }))
    const wrapper = await mountWorkspace()
    const button = wrapper.findAll('button').find((item) => item.text() === 'Открыть в Telegram')!
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-describedby')).toBe('telegram-unavailable')
    expect(wrapper.get('#telegram-unavailable').text()).toContain('Читайте переписку в LidRadar')
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
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
    expect(wrapper.get('h1').text()).toBe('Нет ответа клиенту')
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
