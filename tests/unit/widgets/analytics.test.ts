import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { ActivityGrid, AttributionBreakdown, MetricCards, RevenueChart } from '@/widgets/analytics'
import { PeriodPicker } from '@/features/select-analytics-period'
import type { AnalyticsSummary } from '@/entities/report'

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

describe('виджеты аналитики · approved 03.11.2026', () => {
  it('отделяет неизвестную оценку от известной и исход PAID от денег', () => {
    const wrapper = mount(ActivityGrid, { props: { summary } })
    expect(wrapper.text()).toContain('31 000 ₽')
    expect(wrapper.text()).toContain('Ещё 1 сделка с риском без оценки')
    expect(wrapper.text()).toContain('Исход «Оплачено» сам по себе не подтверждает выручку')
    const unknown = mount(ActivityGrid, {
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
    expect(unknown.text()).toContain('Сумма не определена')
    expect(unknown.text()).toContain('Ещё 2 сделки с риском без оценки')
    wrapper.unmount()
    unknown.unmount()
  })
  it('денежный KPI использует recovered и count атрибуции, события не превращаются в воронку', () => {
    const wrapper = mount(MetricCards, { props: { summary } })
    expect(wrapper.get('[data-testid="recovered-total"]').text()).toBe('147 000 ₽')
    expect(wrapper.text()).toContain('5 оплат после работы с риском')
    expect(wrapper.text()).toContain('Действие записано в периоде')
    expect(wrapper.text()).not.toContain('% найденных')
    wrapper.unmount()
  })
  it('выбор дня с клавиатуры сохраняет нулевые дни ряда', async () => {
    const wrapper = mount(RevenueChart, { props: { series: summary.series, currency: 'RUB' } })
    expect(wrapper.findAll('[data-day-index]')).toHaveLength(2)
    await wrapper.get('[role="group"]').trigger('keydown', { key: 'Home' })
    expect(wrapper.text()).toContain('0 ₽')
    await wrapper.get('[role="group"]').trigger('keydown', { key: 'End' })
    expect(wrapper.text()).toContain('28 000 ₽')
    wrapper.unmount()
  })
  it('атрибуция сохраняет три строки, суммы и неизвестную связь без выдуманной ошибки', () => {
    const wrapper = mount(AttributionBreakdown, {
      props: { attribution: summary.attribution, currency: 'RUB' },
    })
    expect(
      wrapper.findAll('[data-testid="attribution-amount"]').map((item) => item.text()),
    ).toEqual(['147 000 ₽', '62 000 ₽', '18 000 ₽'])
    expect(wrapper.text()).toContain('Связь не определена')
    expect(wrapper.text()).toContain('1 оплата')
    wrapper.unmount()
  })
  it('пустая активность сохраняет все сообщения, сделки и исходы с нулями', () => {
    const wrapper = mount(ActivityGrid, {
      props: {
        summary: {
          ...summary,
          messages: { total: 0, incoming: 0, outgoing: 0, conversations: 0 },
          opportunities: { created: 0, booked: 0, won: 0, lost: 0 },
          outcomes: { booked: 0, paid: 0, lost: 0 },
        },
      },
    })
    const values = wrapper.findAll('.activity-grid dd').map((item) => item.text())
    expect(values).toHaveLength(11)
    expect(values.every((value) => value === '0')).toBe(true)
    wrapper.unmount()
  })
  it('период редактируется как draft, отмена сохраняет applied, apply отдаёт полное окно', async () => {
    const wrapper = mount(PeriodPicker, {
      props: { range: { from: '2026-09-01', to: '2026-09-24' }, timeZone: 'UTC', error: null },
      global: {
        stubs: { UiDialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' } },
      },
    })
    await wrapper.findAll('button')[0]!.trigger('click')
    await wrapper.get('input[name="from"]').setValue('2026-09-10')
    expect(wrapper.emitted('update:range')).toBeUndefined()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Отменить')!
      .trigger('click')
    expect(wrapper.emitted('update:range')).toBeUndefined()
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.get('input[name="from"]').element).toHaveProperty('value', '2026-09-01')
    await wrapper.get('input[name="from"]').setValue('2026-09-24')
    await wrapper.findAll('form')[1]!.trigger('submit')
    expect(wrapper.emitted('update:range')).toEqual([[{ from: '2026-09-24', to: '2026-09-24' }]])
    wrapper.unmount()
  })
  it('не применяет неполный, обратный или превышающий 366 дней draft', async () => {
    const wrapper = mount(PeriodPicker, {
      props: { range: { from: '2026-09-01', to: '2026-09-24' }, timeZone: 'UTC', error: null },
      global: {
        stubs: { UiDialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' } },
      },
    })
    await wrapper.findAll('button')[0]!.trigger('click')
    for (const [date, message] of [
      ['', 'обе даты'],
      ['2026-09-25', 'позже'],
      ['2025-01-01', '366'],
    ]) {
      await wrapper.get('input[name="from"]').setValue(date)
      await wrapper.findAll('form')[1]!.trigger('submit')
      expect(wrapper.get('[role="alert"]').text()).toContain(message)
      expect(wrapper.emitted('update:range')).toBeUndefined()
    }
    wrapper.unmount()
  })
})
