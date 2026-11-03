import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { AnalyticsDailyPoint, AnalyticsSummary } from '@/entities/report'
import OverviewPanel from '@/widgets/analytics/ui/OverviewPanel.vue'
import RevenueChart from '@/widgets/analytics/ui/RevenueChart.vue'

const wrappers: VueWrapper[] = []
function render(component: typeof OverviewPanel, summary: AnalyticsSummary) {
  const wrapper = mount(component, { props: { summary }, attachTo: document.body })
  wrappers.push(wrapper)
  return wrapper
}
function day(index: number, recovered = '0.00'): AnalyticsDailyPoint {
  return {
    date: new Date(Date.UTC(2026, 9, 19 + index)).toISOString().slice(0, 10),
    incoming: 0,
    outgoing: 0,
    risksDetected: 0,
    confirmed: recovered,
    confirmedRecovered: recovered,
    payments: recovered === '0.00' ? 0 : 1,
  }
}
function data(): AnalyticsSummary {
  return {
    period: {
      fromDate: '2026-10-19',
      toDate: '2026-10-25',
      timezone: 'Europe/Moscow',
      from: '2026-10-18T21:00:00Z',
      to: '2026-10-25T21:00:00Z',
    },
    messages: { total: 40, incoming: 25, outgoing: 15, conversations: 6 },
    opportunities: { created: 8, booked: 3, won: 2, lost: 1 },
    risks: { detected: 24, acted: 18, resolved: 11, falsePositive: 2, byType: [] },
    outcomes: { booked: 3, paid: 3, lost: 1 },
    revenue: {
      currency: 'RUB',
      potential: '47000.00',
      confirmed: '59000.00',
      confirmedRecovered: '43000.00',
      confirmedPayments: 3,
      atRiskPotential: '28000.00',
      atRiskOpportunities: 3,
      atRiskUnknownAmountOpportunities: 2,
    },
    attribution: [
      { type: 'RECOVERED', amount: '43000.00', count: 2 },
      { type: 'ORGANIC', amount: '16000.00', count: 1 },
      { type: 'UNKNOWN', amount: '0.00', count: 0 },
    ],
    series: Array.from({ length: 7 }, (_, index) =>
      day(index, index === 4 ? '31000.00' : index === 6 ? '12000.00' : '0.00'),
    ),
  }
}
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('Обзор аналитики по согласованным макетам', () => {
  it('отделяет возвращённые деньги от всех подтверждённых оплат, исходов и оценок', () => {
    const wrapper = render(OverviewPanel, data())
    expect(wrapper.get('[data-testid="recovered-total"]').text()).toBe('43 000 ₽')
    expect(wrapper.get('[data-testid="confirmed-total"]').text()).toBe('59 000 ₽')
    expect(wrapper.text()).toContain('2 оплаты после работы с риском')
    expect(wrapper.text()).toContain('Исход «Оплачено» сам по себе не подтверждает выручку.')
    expect(wrapper.text()).toContain('Оценки не являются выручкой')
    expect(wrapper.get('[aria-label="Оценки сделок"]').text()).toContain('47 000 ₽')
    expect(wrapper.findAll('h3').map((node) => node.text())).not.toContain('Точность сигналов')
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('показывает события по независимым датам, не вычисляя долю действий от найденных рисков', () => {
    const summary = data()
    summary.risks = { ...summary.risks, detected: 2, acted: 5, resolved: 4 }
    const wrapper = render(OverviewPanel, summary)
    const counters = wrapper.findAll('[role="listitem"]')
    expect(counters).toHaveLength(3)
    expect(counters[0]!.text()).toContain('Найдено рисков2')
    expect(counters[1]!.text()).toContain('С действием5')
    expect(counters[2]!.text()).toContain('Закрыто рисков4')
    expect(wrapper.text()).toContain('Это независимые показатели.')
    expect(wrapper.text()).not.toContain('%')
  })

  it('не выдаёт неизвестную оценку за нулевую и не смешивает её с выручкой', () => {
    const summary = data()
    summary.revenue = {
      ...summary.revenue,
      atRiskOpportunities: 2,
      atRiskUnknownAmountOpportunities: 2,
      atRiskPotential: '0.00',
    }
    const wrapper = render(OverviewPanel, summary)
    const estimates = wrapper.get('[aria-label="Оценки сделок"]')
    expect(estimates.text()).toContain('Известная оценка сделок с рискомСумма не определена')
    expect(estimates.text()).not.toContain('Известная оценка сделок с риском0 ₽')
    expect(wrapper.get('[data-testid="unknown-estimates"]').text()).toContain(
      'Ещё 2 сделки с риском без оценки',
    )
    expect(wrapper.get('[data-testid="confirmed-total"]').text()).toBe('59 000 ₽')
  })

  it('сохраняет органические оплаты и неизвестную атрибуцию при нулевой возвращённой выручке', () => {
    const summary = data()
    summary.revenue = { ...summary.revenue, confirmedRecovered: '0.00', confirmed: '16000.50' }
    summary.attribution = [
      { type: 'RECOVERED', amount: '0.00', count: 0 },
      { type: 'ORGANIC', amount: '10000.25', count: 1 },
      { type: 'UNKNOWN', amount: '6000.25', count: 2 },
    ]
    summary.series = Array.from({ length: 7 }, (_, index) => ({
      ...day(index),
      confirmed: index === 6 ? '16000.50' : '0.00',
    }))
    const wrapper = render(OverviewPanel, summary)
    expect(wrapper.get('[data-testid="recovered-total"]').text()).toBe('0 ₽')
    expect(wrapper.get('[data-testid="confirmed-total"]').text()).toBe('16 000,50 ₽')
    expect(wrapper.text()).toContain('За период подтверждённой возвращённой выручки нет.')
    expect(wrapper.text()).toContain('Без связи с риском10 000,25 ₽ · 1 оплата')
    expect(wrapper.text()).toContain('Связь не определена6 000,25 ₽ · 2 оплаты')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('форматирует большие суммы до копейки без потери точности', () => {
    const summary = data()
    summary.revenue.confirmed = '999999999999999999.25'
    summary.revenue.confirmedRecovered = '888888888888888888.75'
    const wrapper = render(OverviewPanel, summary)
    expect(wrapper.get('[data-testid="confirmed-total"]').text()).toBe(
      '999 999 999 999 999 999,25 ₽',
    )
    expect(wrapper.get('[data-testid="recovered-total"]').text()).toBe(
      '888 888 888 888 888 888,75 ₽',
    )
  })

  it('выбирает нулевой и ненулевой день клавиатурой, поддерживает Home/End и Escape', async () => {
    const wrapper = render(OverviewPanel, data())
    const chart = wrapper.get('[role="group"]')
    expect(chart.attributes('tabindex')).toBe('0')
    await chart.trigger('keydown', { key: 'Home' })
    expect(wrapper.get('[aria-live="polite"]').text()).toContain('19 октября 2026')
    expect(wrapper.get('[aria-live="polite"]').text()).toContain('0 ₽')
    await chart.trigger('keydown', { key: 'End' })
    expect(wrapper.get('[aria-live="polite"]').text()).toContain('25 октября 2026')
    expect(wrapper.get('[aria-live="polite"]').text()).toContain('12 000 ₽')
    await chart.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.get('[aria-live="polite"]').text()).toContain('24 октября 2026')
    await chart.trigger('keydown', { key: 'Escape' })
    expect(wrapper.get('[aria-live="polite"]').text()).toBe(
      'Подтверждённые оплаты после работы с риском · RUB',
    )
  })

  it('выбирает день нажатием без hover и сохраняет его после обновления той же series', async () => {
    const wrapper = render(OverviewPanel, data())
    await wrapper.get('[data-day-index="4"]').trigger('click')
    expect(wrapper.get('[aria-live="polite"]').text()).toContain('23 октября 2026')
    expect(wrapper.get('[aria-live="polite"]').text()).toContain('31 000 ₽')
    const next = data()
    next.series[4]!.confirmedRecovered = '32000.50'
    await wrapper.setProps({ summary: next })
    expect(wrapper.get('[aria-live="polite"]').text()).toContain('32 000,50 ₽')
    next.series = [day(7)]
    await wrapper.setProps({ summary: { ...next } })
    expect(wrapper.get('[aria-live="polite"]').text()).not.toContain('23 октября')
  })

  it('дневная таблица включает все 90 дней и нули, а итог складывается как decimal string', async () => {
    const series = Array.from({ length: 90 }, (_, index) =>
      day(index, index === 0 ? '999999999999999999.25' : index === 89 ? '0.75' : '0.00'),
    )
    const wrapper = mount(RevenueChart, {
      props: { series, currency: 'RUB' },
      attachTo: document.body,
    })
    wrappers.push(wrapper)
    expect(wrapper.findAll('[data-day-index]')).toHaveLength(90)
    await wrapper.get('.days-button').trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog).not.toBeNull()
    expect(dialog.querySelectorAll('tbody tr')).toHaveLength(90)
    expect(dialog.querySelectorAll('tbody tr')[1]!.textContent).toContain('0 ₽')
    expect(dialog.textContent).toContain('1 000 000 000 000 000 000 ₽')
    expect(dialog.textContent).toContain('К последнему дню')
    const scrollToEnd = vi.fn()
    Object.defineProperty(dialog.querySelector('tbody')!.lastElementChild!, 'scrollIntoView', {
      value: scrollToEnd,
    })
    Array.from(dialog.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'К последнему дню')!
      .click()
    expect(scrollToEnd).toHaveBeenCalledWith({ block: 'end' })
    const close = Array.from(dialog.querySelectorAll('button')).find(
      (button) => button.textContent === 'Закрыть',
    )!
    close.click()
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    await vi.waitFor(() => expect(document.activeElement).toBe(wrapper.get('.days-button').element))
  })

  it('однодневный нулевой результат остаётся доступным через клавиатуру и таблицу', async () => {
    const wrapper = mount(RevenueChart, {
      props: { series: [day(0)], currency: 'RUB' },
      attachTo: document.body,
    })
    wrappers.push(wrapper)
    await wrapper.get('[role="group"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.get('[aria-live="polite"]').text()).toContain('19 октября 2026')
    await wrapper.get('.days-button').trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(dialog.textContent).toContain('Итого за период: 0 ₽')
  })
})
