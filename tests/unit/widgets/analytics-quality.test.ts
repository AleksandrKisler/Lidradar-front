import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type {
  AnalyticsRiskType,
  AnalyticsSummary,
  RiskPrecisionItem,
  RiskPrecisionReport,
} from '@/entities/report'
import RiskQualityPanel from '@/widgets/analytics/ui/RiskQualityPanel.vue'
import RiskTypeTable from '@/widgets/analytics/ui/RiskTypeTable.vue'
import PrecisionTable from '@/widgets/analytics/ui/PrecisionTable.vue'

const order: RiskPrecisionItem['riskType'][] = [
  'NO_RESPONSE',
  'CUSTOMER_SILENT_AFTER_PRICE',
  'BOOKING_NOT_CONFIRMED',
  'PROMISE_NOT_FULFILLED',
  'FOLLOW_UP_CANDIDATE',
  'UNFINISHED_AGREEMENT',
]
const labels = [
  'Нет ответа клиенту',
  'Клиент молчит после цены',
  'Запись не подтверждена',
  'Обещание не выполнено',
  'Стоит напомнить о себе',
  'Договорённость требует внимания',
]
function item(overrides: Partial<RiskPrecisionItem> = {}): RiskPrecisionItem {
  return {
    riskType: 'NO_RESPONSE',
    totalRisks: 10,
    withFeedback: 0,
    truePositives: 0,
    falsePositives: 0,
    precision: null,
    falsePositiveRate: null,
    coverageRate: 0,
    reliable: false,
    ...overrides,
  }
}
function report(items: RiskPrecisionItem[] = []): RiskPrecisionReport {
  return { from: '2026-09-25T21:00:00Z', to: '2026-10-25T21:00:00Z', minimumCoverage: 0.3, items }
}
function risk(riskType: AnalyticsRiskType['riskType'], detected = 0): AnalyticsRiskType {
  return { riskType, detected, acted: 0, resolved: 0, falsePositive: 0 }
}
const summary: AnalyticsSummary = {
  period: {
    fromDate: '2026-09-26',
    toDate: '2026-10-25',
    from: '2026-09-25T21:00:00Z',
    to: '2026-10-25T21:00:00Z',
    timezone: 'Europe/Moscow',
  },
  messages: { total: 0, incoming: 0, outgoing: 0, conversations: 0 },
  opportunities: { created: 0, booked: 0, won: 0, lost: 0 },
  risks: {
    detected: 0,
    acted: 8,
    resolved: 3,
    falsePositive: 2,
    byType: order.map((type) => ({ ...risk(type), acted: type === 'NO_RESPONSE' ? 8 : 0 })),
  },
  outcomes: { booked: 0, paid: 0, lost: 0 },
  revenue: {
    currency: 'RUB',
    potential: '0.00',
    confirmed: '0.00',
    confirmedRecovered: '0.00',
    confirmedPayments: 0,
    atRiskPotential: '0.00',
    atRiskOpportunities: 0,
    atRiskUnknownAmountOpportunities: 0,
  },
  attribution: [],
  series: [],
}
const mountPrecision = (value: RiskPrecisionReport) =>
  mount(PrecisionTable, { props: { report: value, timeZone: 'Europe/Moscow' } })

describe('Риски и качество · US-M13-01/03/04', () => {
  it('показывает все шесть типов в согласованном порядке и сохраняет события по старым рискам', () => {
    const wrapper = mount(RiskTypeTable, {
      props: { rows: [risk('BOOKING_NOT_CONFIRMED', 3), { ...risk('NO_RESPONSE'), acted: 8 }] },
    })
    expect(wrapper.findAll('h3').map((heading) => heading.text())).toEqual(labels)
    const cards = wrapper.findAll('article')
    expect(cards).toHaveLength(6)
    expect(cards[0]!.findAll('dd').map((cell) => cell.text())).toEqual(['0', '8', '0', '0'])
    expect(cards[2]!.findAll('dd').map((cell) => cell.text())).toEqual(['3', '0', '0', '0'])
    expect(cards[1]!.findAll('dd').every((cell) => cell.text() === '0')).toBe(true)
  })

  it('считает общий KPI из суммы TP/FP, исключая среднее процентов типов', () => {
    const wrapper = mountPrecision(
      report([
        item({
          totalRisks: 100,
          withFeedback: 100,
          truePositives: 90,
          falsePositives: 10,
          precision: 0.9,
          falsePositiveRate: 0.1,
          coverageRate: 1,
          reliable: true,
        }),
        item({
          riskType: 'BOOKING_NOT_CONFIRMED',
          totalRisks: 1,
          withFeedback: 1,
          truePositives: 0,
          falsePositives: 1,
          precision: 0,
          falsePositiveRate: 1,
          coverageRate: 1,
          reliable: true,
        }),
      ]),
    )
    const metrics = wrapper.get('[aria-label="Сводка точности"]').findAll('[role="listitem"]')
    expect(metrics[0]!.text()).toContain('101')
    expect(metrics[1]!.text()).toContain('101')
    expect(metrics[3]!.get('.metric-value').text()).toBe('89 %')
    expect(metrics[3]!.text()).toContain('90 из 101')
    expect(metrics[3]!.text()).not.toContain('45 %')
  })

  it('не превращает неизвестную точность в 0%, различает отсутствие рисков и отсутствие вердиктов', () => {
    const wrapper = mountPrecision(report([item()]))
    const cards = wrapper.findAll('article')
    expect(cards).toHaveLength(6)
    expect(cards[0]!.text()).toContain('Нет вердиктов')
    expect(cards[0]!.text()).toContain('Недостаточно данных')
    expect(
      cards[0]!
        .findAll('dd')
        .slice(3)
        .every((cell) => cell.text().startsWith('—')),
    ).toBe(true)
    expect(cards[1]!.text()).toContain('Рисков за период нет')
    const lastKpi = wrapper.get('[aria-label="Сводка точности"]').findAll('[role="listitem"]')[3]!
    expect(lastKpi.get('.metric-value').text()).toBe('—')
    expect(lastKpi.text()).toContain('Нет вердиктов')
  })

  it('при одной оценке показывает 100% вместе с низким покрытием и основанием', () => {
    const wrapper = mountPrecision(
      report([
        item({
          totalRisks: 100,
          withFeedback: 1,
          truePositives: 1,
          precision: 1,
          falsePositiveRate: 0,
          coverageRate: 0.01,
        }),
      ]),
    )
    const card = wrapper.get('article')
    expect(card.text()).toContain('100 %')
    expect(card.text()).toContain('1 %')
    expect(card.text()).toContain('Недостаточно оценок · 1 из 100')
    expect(card.text()).toContain('низкое покрытие')
  })

  it('использует minimumCoverage и reliable сервера, включая значение ровно на пороге', () => {
    const wrapper = mountPrecision(
      report([
        item({
          withFeedback: 3,
          truePositives: 2,
          falsePositives: 1,
          precision: 2 / 3,
          falsePositiveRate: 1 / 3,
          coverageRate: 0.3,
          reliable: true,
        }),
        item({
          riskType: 'CUSTOMER_SILENT_AFTER_PRICE',
          withFeedback: 2,
          truePositives: 2,
          precision: 1,
          falsePositiveRate: 0,
          coverageRate: 0.2,
          reliable: false,
        }),
      ]),
    )
    expect(wrapper.text()).toContain('Порог текущего отчёта: 30 %')
    const cards = wrapper.findAll('article')
    expect(cards[0]!.classes()).not.toContain('low')
    expect(cards[0]!.text()).toContain('Подтверждено: 2 · Ложных: 1')
    expect(cards[1]!.classes()).toContain('low')
    expect(cards[1]!.text()).toContain('Недостаточно оценок · 2 из 10')
  })

  it('переводит исключительную верхнюю границу к последнему календарному дню организации', () => {
    const wrapper = mountPrecision(report())
    expect(wrapper.get('.window').text()).toContain('26 сентября 2026 г. — 25 октября 2026 г.')
    expect(wrapper.get('.window').text()).not.toContain('26 октября')
  })

  it('независимо показывает состояния summary/precision без выдуманных нулей', async () => {
    const wrapper = mount(RiskQualityPanel, {
      props: {
        report: report([
          item({
            withFeedback: 1,
            truePositives: 1,
            precision: 1,
            falsePositiveRate: 0,
            coverageRate: 0.1,
          }),
        ]),
        timeZone: 'Europe/Moscow',
      },
      slots: { 'summary-state': '<p role="status">Загрузка событий</p>' },
    })
    expect(wrapper.get('[role="status"]').text()).toBe('Загрузка событий')
    expect(wrapper.find('[aria-label="Сводка событий рисков"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Сводка точности"]').exists()).toBe(true)
    await wrapper.setProps({ summary, report: undefined })
    expect(wrapper.find('[aria-label="Сводка точности"]').exists()).toBe(false)
    const events = wrapper.get('[aria-label="Сводка событий рисков"]').findAll('[role="listitem"]')
    expect(events[0]!.get('.metric-value').text()).toBe('0')
    expect(events[1]!.get('.metric-value').text()).toBe('8')
    expect(events[1]!.text()).toContain('По дате действия')
  })

  it('поздний TP→FP изменяет точность когорты независимо от счётчика событий', async () => {
    const wrapper = mount(RiskQualityPanel, {
      props: {
        summary,
        report: report([
          item({
            withFeedback: 1,
            truePositives: 1,
            precision: 1,
            falsePositiveRate: 0,
            coverageRate: 0.1,
          }),
        ]),
        timeZone: 'Europe/Moscow',
      },
    })
    const precision = () =>
      wrapper.get('[aria-label="Сводка точности"]').findAll('.metric-value')[3]!.text()
    expect(precision()).toBe('100 %')
    await wrapper.setProps({
      report: report([
        item({
          withFeedback: 1,
          falsePositives: 1,
          precision: 0,
          falsePositiveRate: 1,
          coverageRate: 0.1,
        }),
      ]),
    })
    expect(precision()).toBe('0 %')
    expect(
      wrapper.get('[aria-label="Сводка событий рисков"]').findAll('.metric-value')[3]!.text(),
    ).toBe('2')
    expect(wrapper.text()).toContain('по последнему вердикту')
  })
})
