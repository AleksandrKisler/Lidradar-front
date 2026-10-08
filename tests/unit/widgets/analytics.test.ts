import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { AnalyticsSummary, Payment, RiskPrecisionReport } from '@/entities/report'
import {
  ActivityGrid,
  AttributionBreakdown,
  MetricCards,
  PaymentsTable,
  PrecisionTable,
  RevenueChart,
} from '@/widgets/analytics'
import { PeriodPicker } from '@/features/select-analytics-period'

const summary: AnalyticsSummary = {
  period: {
    fromDate: '2026-08-15',
    toDate: '2026-08-21',
    timezone: 'Europe/Moscow',
    from: '2026-08-14T21:00:00Z',
    to: '2026-08-21T21:00:00Z',
  },
  messages: { total: 40, incoming: 25, outgoing: 15, conversations: 6 },
  opportunities: { created: 8, booked: 3, won: 2, lost: 1 },
  risks: {
    detected: 24,
    acted: 18,
    resolved: 11,
    falsePositive: 2,
    byType: [{ riskType: 'NO_RESPONSE', detected: 24, acted: 18, resolved: 11, falsePositive: 2 }],
  },
  outcomes: { booked: 3, paid: 2, lost: 1 },
  revenue: {
    currency: 'RUB',
    potential: '47000.00',
    atRiskPotential: '31000.00',
    atRiskOpportunities: 3,
    atRiskUnknownAmountOpportunities: 1,
    confirmed: '227000.00',
    confirmedRecovered: '147000.00',
    confirmedPayments: 7,
  },
  series: [
    {
      date: '2026-08-15',
      incoming: 1,
      outgoing: 1,
      risksDetected: 1,
      confirmed: '0.00',
      confirmedRecovered: '0.00',
      payments: 0,
    },
    {
      date: '2026-08-16',
      incoming: 1,
      outgoing: 1,
      risksDetected: 1,
      confirmed: '28000.00',
      confirmedRecovered: '28000.00',
      payments: 1,
    },
  ],
  attribution: [
    { type: 'RECOVERED', amount: '147000.00', count: 5 },
    { type: 'ORGANIC', amount: '62000.00', count: 1 },
    { type: 'UNKNOWN', amount: '18000.00', count: 1 },
  ],
}

describe('виджеты аналитики', () => {
  it('показывает число сделок с риском и отделяет неизвестные суммы от известной оценки', () => {
    const wrapper = mount(ActivityGrid, { props: { summary } })
    expect(wrapper.text()).toContain('Сделок с риском3')
    expect(wrapper.text()).toContain('31 000 ₽ · 1 без суммы')
    const unknownOnly = mount(ActivityGrid, {
      props: {
        summary: {
          ...summary,
          revenue: {
            ...summary.revenue,
            atRiskPotential: '0.00',
            atRiskOpportunities: 2,
            atRiskUnknownAmountOpportunities: 2,
          },
        },
      },
    })
    expect(unknownOnly.text()).toContain('Сумма не определена · 2 без суммы')
    wrapper.unmount()
    unknownOnly.unmount()
  })

  it('заглавные карточки: деньги в валюте ответа, доли без нулевого знаменателя', () => {
    const wrapper = mount(MetricCards, { props: { summary } })
    const text = wrapper.text()
    expect(text).toContain('147 000 ₽')
    expect(text).toContain('5 оплат со связью с рисками')
    expect(text).toContain('75 % найденных')
    const zero = mount(MetricCards, {
      props: {
        summary: {
          ...summary,
          risks: { ...summary.risks, detected: 0, acted: 0, resolved: 0, falsePositive: 0 },
        },
      },
    })
    expect(zero.text()).not.toContain('%')
    wrapper.unmount()
    zero.unmount()
  })

  it('график рисует столбцы только по точкам ряда и дублирует их таблицей', () => {
    const wrapper = mount(RevenueChart, { props: { series: summary.series, currency: 'RUB' } })
    expect(wrapper.findAll('rect')).toHaveLength(2)
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('28 000')
    const empty = mount(RevenueChart, {
      props: { series: [{ ...summary.series[0]! }], currency: 'RUB' },
    })
    expect(empty.find('svg').exists()).toBe(false)
    expect(empty.text()).toContain('возвращённой выручки нет')
    wrapper.unmount()
    empty.unmount()
  })

  it('разделение оплат идёт в порядке сервера с подписями и валютой', () => {
    const wrapper = mount(AttributionBreakdown, {
      props: { attribution: summary.attribution, currency: 'RUB' },
    })
    const rows = wrapper.findAll('[data-testid="attribution-amount"]').map((item) => item.text())
    expect(rows).toEqual([`147\u00a0000\u00a0₽`, `62\u00a0000\u00a0₽`, `18\u00a0000\u00a0₽`])
    expect(wrapper.text()).toContain('Связь пока не определена · 1 оплата')
    wrapper.unmount()
  })

  it('разделение оплат: два кольца, доли по деньгам и по числу оплат', () => {
    const wrapper = mount(AttributionBreakdown, {
      props: { attribution: summary.attribution, currency: 'RUB' },
    })
    // Два кольца по три сегмента: сегмент рисуется дугой, а фон — окружностью.
    expect(wrapper.findAll('svg circle')).toHaveLength(2)
    expect(wrapper.findAll('svg path')).toHaveLength(6)
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
    // 147 из 227 тыс. и 5 из 7 оплат; подпись идёт снаружи внутрь.
    expect(wrapper.find('dl').text()).toContain(`65\u00a0% суммы · 71\u00a0% оплат`)
    expect(wrapper.find('svg + div').text()).toContain('7')
    const empty = mount(AttributionBreakdown, {
      props: {
        attribution: summary.attribution.map((row) => ({ ...row, amount: '0.00', count: 0 })),
        currency: 'RUB',
      },
    })
    // Без оплат остаются пустые кольца и нет процентов.
    expect(empty.findAll('svg path')).toHaveLength(0)
    expect(empty.find('dl').text()).not.toContain('%')
    wrapper.unmount()
    empty.unmount()
  })

  it('кольца сводки: по одному на сообщения и исходы, три на сделки, два на деньги', () => {
    const wrapper = mount(ActivityGrid, { props: { summary } })
    const cards = wrapper.findAll('section')
    const circles = (index: number) => cards[index]!.findAll('svg > g > g').length
    expect(cards).toHaveLength(4)
    expect([0, 1, 2, 3].map(circles)).toEqual([1, 3, 1, 2])
    // Легенда сохраняет значения и добавляет доли.
    const legend = (index: number) => cards[index]!.find('dl').text()
    expect(legend(0)).toContain(`Входящие25 · 63\u00a0%`)
    expect(legend(1)).toContain(`Записались3 · 38\u00a0%`)
    expect(legend(3)).toContain(`Из них возвращено147\u00a0000\u00a0₽ · 65\u00a0%`)
    expect(legend(3)).toContain(`67\u00a0% с известной суммой`)
    wrapper.unmount()
  })

  it('если значение не помещается в целое, кольцо не рисуется, а число остаётся', () => {
    const wrapper = mount(ActivityGrid, {
      props: {
        summary: {
          ...summary,
          messages: { total: 10, incoming: 8, outgoing: 8, conversations: 2 },
          opportunities: { created: 2, booked: 1, won: 3, lost: 0 },
          revenue: { ...summary.revenue, confirmed: '1000.00', confirmedRecovered: '5000.00' },
        },
      },
    })
    const cards = wrapper.findAll('section')
    // Сообщения: 8 + 8 больше 10 — колец нет, строки как раньше.
    expect(cards[0]!.find('svg').exists()).toBe(false)
    expect(cards[0]!.find('dl').text()).toContain('Входящие8')
    // Сделки: «Выиграно» 3 из 2 не рисуется, остальные стадии — рисуются.
    expect(cards[1]!.findAll('svg > g > g')).toHaveLength(2)
    expect(cards[1]!.find('dl').text()).toContain('Выиграно3')
    expect(cards[1]!.find('dl').text()).not.toMatch(/Выиграно3 · /)
    // Деньги: возвращено больше подтверждённого — остаётся кольцо сделок с известной суммой.
    expect(cards[3]!.findAll('svg > g > g')).toHaveLength(1)
    wrapper.unmount()
  })

  it('без целого кольца нет: пустой период остаётся обычным списком', () => {
    const wrapper = mount(ActivityGrid, {
      props: {
        summary: {
          ...summary,
          messages: { total: 0, incoming: 0, outgoing: 0, conversations: 0 },
          opportunities: { created: 0, booked: 0, won: 0, lost: 0 },
          outcomes: { booked: 0, paid: 0, lost: 0 },
          revenue: {
            ...summary.revenue,
            confirmed: '0.00',
            confirmedRecovered: '0.00',
            confirmedPayments: 0,
            atRiskOpportunities: 0,
            atRiskUnknownAmountOpportunities: 0,
          },
        },
      },
    })
    expect(wrapper.find('svg').exists()).toBe(false)
    // Все строки на месте, без цветных маркеров и процентов.
    expect(wrapper.findAll('dt')).toHaveLength(4 + 4 + 3 + 6)
    expect(wrapper.find('dl').text()).not.toContain('%')
    wrapper.unmount()
  })

  it('кольцо денег без возвращённого берёт в центр долю сделок с известной суммой', () => {
    const wrapper = mount(ActivityGrid, {
      props: {
        summary: {
          ...summary,
          revenue: { ...summary.revenue, confirmed: '0.00', confirmedRecovered: '0.00' },
        },
      },
    })
    const money = wrapper.findAll('section')[3]!
    expect(money.findAll('svg > g > g')).toHaveLength(1)
    expect(money.find('svg + div').text()).toContain('с суммой')
    wrapper.unmount()
  })

  it('точность: «Недостаточно данных» вместо 0 % и пометка низкого покрытия', () => {
    const report: RiskPrecisionReport = {
      from: '2026-08-14T21:00:00Z',
      to: '2026-08-21T21:00:00Z',
      minimumCoverage: 0.3,
      items: [
        {
          riskType: 'NO_RESPONSE',
          totalRisks: 10,
          withFeedback: 5,
          truePositives: 4,
          falsePositives: 1,
          precision: 0.8,
          falsePositiveRate: 0.2,
          coverageRate: 0.5,
          reliable: true,
        },
        {
          riskType: 'BOOKING_NOT_CONFIRMED',
          totalRisks: 3,
          withFeedback: 0,
          truePositives: 0,
          falsePositives: 0,
          precision: null,
          falsePositiveRate: null,
          coverageRate: 0,
          reliable: false,
        },
      ],
    }
    const wrapper = mount(PrecisionTable, { props: { report, timeZone: 'Europe/Moscow' } })
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0]!.text()).toContain('80 %')
    expect(rows[0]!.text()).not.toContain('низкое покрытие')
    expect(rows[1]!.text()).toContain('Недостаточно данных')
    expect(rows[1]!.text()).not.toContain('0 %Недостаточно')
    expect(rows[1]!.text()).toContain('низкое покрытие')
    expect(wrapper.text()).toContain('Покрытие ниже 30 %')
    wrapper.unmount()
  })

  it('оплаты: своя валюта в каждой строке, ссылка на риск и подгрузка', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/risks/:riskId', name: 'risk', component: { template: '<div />' } }],
    })
    const items: Payment[] = [
      {
        eventId: 'e-1',
        opportunityId: 'o-1',
        conversationId: 'c-1',
        contactId: 'k-1',
        contactDisplayName: 'Дмитрий Соколов',
        serviceName: 'Полировка кузова',
        amount: '31000.00',
        currency: 'RUB',
        attribution: 'RECOVERED',
        riskId: '01990000-0000-7000-8000-000000000301',
        confirmedBy: 'u',
        confirmedAt: '2026-08-21T10:00:00Z',
      },
      {
        eventId: 'e-2',
        opportunityId: 'o-2',
        conversationId: 'c-2',
        contactId: 'k-2',
        contactDisplayName: null,
        serviceName: null,
        amount: '100.00',
        currency: 'EUR',
        attribution: 'UNKNOWN',
        riskId: null,
        confirmedBy: 'u',
        confirmedAt: '2026-08-20T10:00:00Z',
      },
    ]
    const wrapper = mount(PaymentsTable, {
      props: { items, hasMore: true, loadingMore: false, timeZone: 'Europe/Moscow' },
      global: { plugins: [router] },
    })
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0]!.text()).toContain('31 000 ₽')
    expect(rows[0]!.get('a').attributes('href')).toBe('/risks/01990000-0000-7000-8000-000000000301')
    expect(rows[1]!.text()).toContain('Без имени')
    expect(rows[1]!.text()).toContain('Услуга не уточнена')
    expect(rows[1]!.text()).toContain('100 €')
    expect(rows[1]!.find('a').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('more')).toHaveLength(1)
    const empty = mount(PaymentsTable, {
      props: { items: [], hasMore: false, loadingMore: false, timeZone: 'UTC' },
      global: { plugins: [router] },
    })
    expect(empty.text()).toContain('оплат за период нет')
    wrapper.unmount()
    empty.unmount()
  })

  it('выбор периода: пресеты и ручные даты отдают полное окно, ошибка объявляется', async () => {
    const wrapper = mount(PeriodPicker, {
      props: { range: { from: '2026-09-01', to: '2026-09-24' }, timeZone: 'UTC', error: null },
    })
    await wrapper.get('input[name="from"]').setValue('2026-09-10')
    expect(wrapper.emitted('update:range')?.[0]).toEqual([{ from: '2026-09-10', to: '2026-09-24' }])
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '7 дней')!
      .trigger('click')
    const preset = wrapper.emitted('update:range')?.[1]?.[0] as { from: string; to: string }
    expect(preset.to).toBe(new Date().toISOString().slice(0, 10))
    expect(wrapper.text()).toContain('24 дн.')
    await wrapper.setProps({ error: 'Дата начала позже даты окончания' })
    expect(wrapper.get('[role="alert"]').text()).toBe('Дата начала позже даты окончания')
    wrapper.unmount()
  })
})
