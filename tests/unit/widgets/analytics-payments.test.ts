import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { AnalyticsSummary, Payment } from '@/entities/report'
import { useSessionStore } from '@/entities/session'
import PaymentsPanel from '@/widgets/analytics/ui/PaymentsPanel.vue'
import PaymentsTable from '@/widgets/analytics/ui/PaymentsTable.vue'

const payment: Payment = {
  eventId: 'event-1',
  opportunityId: 'opportunity-1',
  conversationId: 'conversation-1',
  contactId: 'contact-1',
  contactDisplayName: 'Дмитрий Соколов',
  serviceName: 'Полировка кузова',
  amount: '31000.05',
  currency: 'RUB',
  attribution: 'RECOVERED',
  riskId: 'risk-1',
  confirmedBy: 'user-1',
  confirmedAt: '2026-10-25T12:10:00Z',
}
const summary: AnalyticsSummary = {
  period: {
    fromDate: '2026-09-26',
    toDate: '2026-10-25',
    timezone: 'Europe/Moscow',
    from: '2026-09-25T21:00:00Z',
    to: '2026-10-25T21:00:00Z',
  },
  messages: { total: 0, incoming: 0, outgoing: 0, conversations: 0 },
  opportunities: { created: 0, booked: 0, won: 0, lost: 0 },
  risks: { detected: 0, acted: 0, resolved: 0, falsePositive: 0, byType: [] },
  outcomes: { booked: 0, paid: 0, lost: 0 },
  revenue: {
    currency: 'RUB',
    potential: '0.00',
    atRiskPotential: '0.00',
    atRiskOpportunities: 0,
    atRiskUnknownAmountOpportunities: 0,
    confirmed: '73500.46',
    confirmedRecovered: '49500.05',
    confirmedPayments: 5,
  },
  series: [],
  attribution: [
    { type: 'RECOVERED', amount: '49500.05', count: 2 },
    { type: 'ORGANIC', amount: '24000.41', count: 3 },
    { type: 'UNKNOWN', amount: '0.00', count: 0 },
  ],
}
const baseProps = { items: [payment], hasMore: true, loadingMore: false, timeZone: 'Europe/Moscow' }
const unmounts: (() => void)[] = []
afterEach(() => {
  unmounts.splice(0).forEach((unmount) => unmount())
})

async function context() {
  const pinia = createPinia()
  const session = useSessionStore(pinia)
  session.memberships = [{ tenantId: 'tenant-1', organizationName: 'Студия', role: 'OWNER' }]
  session.tenantId = 'tenant-1'
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/analytics', name: 'analytics', component: { template: '<div />' } },
      { path: '/risks/:riskId', name: 'risk', component: { template: '<div />' } },
      {
        path: '/conversations/:conversationId',
        name: 'conversation',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/analytics?tab=payments&from=2026-09-26&to=2026-10-25')
  await router.isReady()
  return { session, router, global: { plugins: [pinia, router] } }
}

async function table(
  overrides: Partial<typeof baseProps> & { nextError?: unknown; invalidCursor?: boolean } = {},
) {
  const ctx = await context()
  const wrapper = mount(PaymentsTable, {
    props: { ...baseProps, ...overrides },
    global: ctx.global,
  })
  unmounts.push(() => wrapper.unmount())
  return { wrapper, ...ctx }
}

describe('аналитика · журнал оплат', () => {
  it('сохраняет точные суммы, исходные валюты, timezone и nullable подписи', async () => {
    const { wrapper } = await table({
      items: [
        { ...payment, amount: '9007199254740993.05', contactDisplayName: null, serviceName: null },
        {
          ...payment,
          eventId: 'event-2',
          amount: '999.99',
          currency: 'USD',
          attribution: 'UNKNOWN',
          riskId: null,
        },
      ],
    })
    expect(wrapper.get('[data-payment-id="event-1"]').text()).toContain(
      '9 007 199 254 740 993,05 ₽',
    )
    expect(wrapper.text()).toContain('999,99 USD')
    expect(wrapper.text()).toContain('Клиент без имени')
    expect(wrapper.text()).toContain('Услуга не указана')
    expect(wrapper.text()).toContain('Связь не определена')
    expect(wrapper.get('time').text()).toContain('15:10')
    expect(wrapper.get('time').text()).toContain('МСК')
    expect(wrapper.findAll('time')[1]!.attributes('datetime')).toBe(payment.confirmedAt)
  })

  it('ссылки зависят от ID и текущих прав, а не атрибуции', async () => {
    const { wrapper, session } = await table({
      items: [
        { ...payment, attribution: 'ORGANIC' },
        { ...payment, eventId: 'event-2', riskId: null },
      ],
    })
    expect(wrapper.findAll('.payment-link-risk')).toHaveLength(1)
    expect(wrapper.findAll('.payment-link-conversation')).toHaveLength(2)
    session.tenantId = null
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('a')).toHaveLength(0)
  })

  it('передаёт исходный URL и eventId для возврата из обоих объектов', async () => {
    const { wrapper, router } = await table()
    const origin = router.currentRoute.value.fullPath
    for (const selector of ['.payment-link-risk', '.payment-link-conversation']) {
      const href = wrapper.get(selector).attributes('href')!
      const resolved = router.resolve(href)
      expect(resolved.query.returnTo).toBe(origin)
    }
    await wrapper.get('.payment-link-risk').trigger('click')
    expect(wrapper.emitted('navigate')).toEqual([[{ eventId: payment.eventId, link: 'risk' }]])
  })

  it('ошибка следующей страницы сохраняет DOM записей и повторяет только more', async () => {
    const { wrapper } = await table()
    const row = wrapper.get('[data-payment-id="event-1"]').element
    await wrapper.setProps({ nextError: new Error('network') })
    expect(wrapper.get('[data-payment-id="event-1"]').element).toBe(row)
    expect(wrapper.get('[role="alert"]').text()).toContain('Показанные записи сохранены')
    expect(wrapper.get('button').text()).toBe('Повторить')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('more')).toEqual([[]])
    expect(wrapper.emitted('reset')).toBeUndefined()
  })

  it('недействительный continuation предлагает reset, сохраняя строки до действия', async () => {
    const { wrapper } = await table({ nextError: new Error('cursor'), invalidCursor: true })
    expect(wrapper.findAll('[data-payment-id]')).toHaveLength(1)
    expect(wrapper.get('[role="alert"]').text()).toContain('Список изменился')
    expect(wrapper.get('button').text()).toBe('Обновить список')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('reset')).toEqual([[]])
    expect(wrapper.emitted('more')).toBeUndefined()
  })

  it('busy сохраняет строки, блокирует повтор, конец списка убирает кнопку', async () => {
    const { wrapper } = await table({ loadingMore: true })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button').attributes('aria-busy')).toBe('true')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('more')).toBeUndefined()
    await wrapper.setProps({ loadingMore: false, hasMore: false })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain('Все оплаты загружены')
    expect(wrapper.get('[role="status"]').text()).toContain('Загружено 1 оплата')
  })

  it('повторные eventIds не дублируют записи, порядок сервера сохраняется', async () => {
    const second = { ...payment, eventId: 'event-2', amount: '150.00', currency: 'EUR' }
    const { wrapper } = await table({ items: [payment, second, payment] })
    expect(
      wrapper.findAll('[data-payment-id]').map((row) => row.attributes('data-payment-id')),
    ).toEqual(['event-1', 'event-2'])
    expect(wrapper.get('[role="status"]').text()).toContain('Загружено 2 оплаты')
    expect(wrapper.text()).toContain('150 EUR')
  })

  it('пустой журнал не создаёт номера страниц, итог или активное продолжение', async () => {
    const { wrapper } = await table({ items: [], hasMore: false })
    expect(wrapper.text()).toContain('Подтверждённых оплат за период нет.')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('[data-payment-id]').exists()).toBe(false)
  })
})

describe('аналитика · панель оплат', () => {
  it('итоги за весь период не пересчитываются по загруженной странице', async () => {
    const ctx = await context()
    const wrapper = mount(PaymentsPanel, { props: { ...baseProps, summary }, global: ctx.global })
    unmounts.push(() => wrapper.unmount())
    const values = wrapper.findAll('.payment-metric-value').map((node) => node.text())
    expect(values).toEqual(['73 500,46 ₽', '49 500,05 ₽'])
    expect(wrapper.text()).toContain('не возврат денег клиенту')
    expect(wrapper.text()).toContain('только RUB')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('more')).toEqual([[]])
  })

  it('FX-only журнал не превращается в пустой при нулевых итогах', async () => {
    const ctx = await context()
    const wrapper = mount(PaymentsPanel, {
      props: {
        ...baseProps,
        summary: {
          ...summary,
          revenue: { ...summary.revenue, confirmed: '0.00', confirmedRecovered: '0.00' },
        },
        items: [{ ...payment, currency: 'USD', amount: '999.99' }],
      },
      global: ctx.global,
    })
    unmounts.push(() => wrapper.unmount())
    expect(wrapper.findAll('.payment-metric-value').map((node) => node.text())).toEqual([
      '0 ₽',
      '0 ₽',
    ])
    expect(wrapper.text()).toContain('999,99 USD')
    expect(wrapper.text()).not.toContain('Подтверждённых оплат за период нет')
  })

  it('независимый summary slot не скрывает журнал и не показывает выдуманный ноль', async () => {
    const ctx = await context()
    const wrapper = mount(PaymentsPanel, {
      props: baseProps,
      slots: { 'summary-state': '<p role="alert">Не удалось загрузить итоги</p>' },
      global: ctx.global,
    })
    unmounts.push(() => wrapper.unmount())
    expect(wrapper.findAll('.payment-metric-value')).toHaveLength(0)
    expect(wrapper.get('[role="alert"]').text()).toBe('Не удалось загрузить итоги')
    expect(wrapper.text()).toContain('31 000,05 ₽')
  })

  it('initial payments slot сохраняет доступные итоги отдельно от журнала', async () => {
    const ctx = await context()
    const wrapper = mount(PaymentsPanel, {
      props: { ...baseProps, summary },
      slots: { 'payments-state': '<p role="status">Загружаем журнал</p>' },
      global: ctx.global,
    })
    unmounts.push(() => wrapper.unmount())
    expect(wrapper.text()).toContain('73 500,46 ₽')
    expect(wrapper.get('[role="status"]').text()).toBe('Загружаем журнал')
    expect(wrapper.find('[data-payment-id]').exists()).toBe(false)
  })
})
