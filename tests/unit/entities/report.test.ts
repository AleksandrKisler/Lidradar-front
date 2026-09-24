import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activityRates,
  analyticsKeys,
  attributionCaption,
  buildChart,
  defaultRange,
  fetchAnalyticsSummary,
  fetchPayments,
  fetchPrecision,
  formatPercent,
  labelStep,
  niceTop,
  parseRange,
  precisionView,
  presetRange,
  rangeDays,
  rangeToInstants,
  ratio,
  recoveredPayments,
  validateRange,
  type AnalyticsDailyPoint,
  type AnalyticsSummary,
  type RiskPrecisionItem,
} from '@/entities/report'

const now = new Date('2026-09-24T10:00:00Z')

describe('окно аналитики', () => {
  it('по умолчанию — последние 30 дней по календарю организации, включая сегодня', () => {
    expect(defaultRange('Europe/Moscow', now)).toEqual({ from: '2026-08-26', to: '2026-09-24' })
    // В Окленде 24 сентября 10:00 UTC — уже 24-е вечером, в Гонолулу ещё 24-е утром; на границе суток пояс решает.
    expect(defaultRange('Pacific/Kiritimati', new Date('2026-09-24T23:30:00Z')).to).toBe(
      '2026-09-25',
    )
    expect(presetRange(7, 'UTC', now)).toEqual({ from: '2026-09-18', to: '2026-09-24' })
    expect(rangeDays({ from: '2026-09-18', to: '2026-09-24' })).toBe(7)
  })

  it('проверяет формат, порядок и предел 366 дней', () => {
    expect(validateRange({ from: '2026-09-01', to: '2026-09-24' })).toBeNull()
    expect(validateRange({ from: '2026-09-25', to: '2026-09-24' })).toBe(
      'Дата начала позже даты окончания',
    )
    expect(validateRange({ from: '2025-09-24', to: '2026-09-24' })).toBeNull()
    expect(validateRange({ from: '2025-09-23', to: '2026-09-24' })).toBe('Окно не длиннее 366 дней')
    expect(validateRange({ from: '2026-02-30', to: '2026-09-24' })).toContain('ГГГГ-ММ-ДД')
    expect(validateRange({ from: '', to: '' })).toContain('ГГГГ-ММ-ДД')
    expect(parseRange('2026-09-01', '2026-09-24')).toEqual({ from: '2026-09-01', to: '2026-09-24' })
    expect(parseRange('2026-09-01', undefined)).toBeNull()
    expect(parseRange('2026-09-01', 'сегодня')).toBeNull()
  })

  it('переводит календарные границы в моменты UTC: начало включительно, конец исключительно', () => {
    expect(rangeToInstants({ from: '2026-09-01', to: '2026-09-24' }, 'Europe/Moscow')).toEqual({
      from: '2026-08-31T21:00:00.000Z',
      to: '2026-09-24T21:00:00.000Z',
    })
    // Окно через весенний переход в Нью-Йорке: длина суток разная, границы — по местной полуночи.
    expect(rangeToInstants({ from: '2026-03-07', to: '2026-03-08' }, 'America/New_York')).toEqual({
      from: '2026-03-07T05:00:00.000Z',
      to: '2026-03-09T04:00:00.000Z',
    })
  })
})

describe('показатели', () => {
  it('не делит на ноль и подписывает доли', () => {
    expect(ratio(3, 4)).toBe(0.75)
    expect(ratio(3, 0)).toBeNull()
    expect(ratio(0, 0)).toBeNull()
    expect(formatPercent(0.75)).toBe('75 %')
    expect(formatPercent(0.333, 1)).toBe('33,3 %')
    expect(formatPercent(null)).toBe('—')
  })

  it('точность: null — «Недостаточно данных», reliable=false — низкое покрытие', () => {
    const base: RiskPrecisionItem = {
      riskType: 'NO_RESPONSE',
      totalRisks: 10,
      withFeedback: 5,
      truePositives: 4,
      falsePositives: 1,
      precision: 0.8,
      falsePositiveRate: 0.2,
      coverageRate: 0.5,
      reliable: true,
    }
    expect(precisionView(base)).toEqual({
      precision: '80 %',
      falsePositiveRate: '20 %',
      coverage: '50 %',
      lowCoverage: false,
      insufficient: false,
    })
    const empty = precisionView({
      ...base,
      withFeedback: 0,
      precision: null,
      falsePositiveRate: null,
      coverageRate: 0,
      reliable: false,
    })
    expect(empty.precision).toBe('Недостаточно данных')
    expect(empty.falsePositiveRate).toBe('Недостаточно данных')
    expect(empty.lowCoverage).toBe(true)
    expect(empty.insufficient).toBe(true)
  })

  it('доли активности и число возвращённых оплат берутся из ответа, а не досчитываются', () => {
    const summary = {
      risks: { detected: 0, acted: 0, resolved: 0, falsePositive: 0, byType: [] },
      opportunities: { created: 4, booked: 1, won: 0, lost: 0 },
      attribution: [
        { type: 'RECOVERED', amount: '31000.00', count: 1 },
        { type: 'ORGANIC', amount: '16000.00', count: 1 },
        { type: 'UNKNOWN', amount: '0.00', count: 0 },
      ],
    } as unknown as AnalyticsSummary
    expect(activityRates(summary)).toEqual({
      acted: null,
      resolved: null,
      falsePositive: null,
      booked: 0.25,
    })
    expect(recoveredPayments(summary)).toBe(1)
    expect(recoveredPayments({ ...summary, attribution: [] })).toBeNull()
    expect(attributionCaption('RECOVERED')).toBe('Возвращено после работы с риском')
    expect(attributionCaption('X')).toBe('X')
  })
})

describe('столбцы ряда', () => {
  const point = (date: string, confirmedRecovered: string): AnalyticsDailyPoint => ({
    date,
    incoming: 0,
    outgoing: 0,
    risksDetected: 0,
    confirmed: confirmedRecovered,
    confirmedRecovered,
    payments: confirmedRecovered === '0.00' ? 0 : 1,
  })

  it('масштабирует по «круглому» максимуму и не выдумывает точек', () => {
    const chart = buildChart(
      [
        point('2026-08-15', '0.00'),
        point('2026-08-16', '28000.00'),
        point('2026-08-17', '47000.00'),
      ],
      (item) => item.confirmedRecovered,
    )
    expect(chart.bars).toHaveLength(3)
    expect(chart.top).toBe(50000)
    expect(chart.bars[2]!.height).toBeCloseTo(0.94)
    expect(chart.bars[0]!.height).toBe(0)
    expect(chart.bars[1]!.label).toBe('16 авг.')
    expect(chart.ticks).toEqual([0, 25000, 50000])
    expect(chart.empty).toBe(false)
  })

  it('нулевой ряд честно пуст, шаг подписей растёт с длиной окна', () => {
    const chart = buildChart([point('2026-08-15', '0.00')], (item) => item.confirmedRecovered)
    expect(chart.empty).toBe(true)
    expect(chart.top).toBe(0)
    expect(niceTop(0)).toBe(0)
    expect(niceTop(1)).toBe(1)
    expect(niceTop(1200)).toBe(2000)
    expect(niceTop(60000)).toBe(100000)
    expect(labelStep(7)).toBe(1)
    expect(labelStep(30)).toBe(5)
    expect(labelStep(90)).toBe(15)
    expect(labelStep(366)).toBe(30)
  })
})

describe('запросы аналитики', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
  const respond = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  beforeEach(() => {
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('ключи содержат префиксы инвалидации и фактические границы', () => {
    expect(analyticsKeys.summary('t', { from: '2026-09-01', to: '2026-09-24' })).toEqual([
      'tenant',
      't',
      'analytics',
      'summary',
      '2026-09-01',
      '2026-09-24',
    ])
    expect(analyticsKeys.payments('t', { from: 'a', to: 'b' })[2]).toBe('analytics')
    expect(analyticsKeys.precision('t', { from: 'a', to: 'b' })).toEqual([
      'tenant',
      't',
      'precision',
      'a',
      'b',
    ])
  })

  it('сводка и точность уходят с датами и моментами, оплаты — с курсором и лимитом', async () => {
    // Каждому вызову — свой Response: тело читается один раз.
    fetchMock.mockImplementation(async () => respond({ items: [], nextCursor: null }))
    await fetchAnalyticsSummary('t-1', { from: '2026-09-01', to: '2026-09-24' })
    const summary = new URL(fetchMock.mock.calls[0]![0].url)
    expect(summary.pathname).toBe('/api/v1/analytics/summary')
    expect(summary.searchParams.get('from')).toBe('2026-09-01')
    expect(summary.searchParams.get('to')).toBe('2026-09-24')
    expect(fetchMock.mock.calls[0]![0].headers.get('X-Tenant-ID')).toBe('t-1')

    await fetchPrecision('t-1', {
      from: '2026-08-31T21:00:00.000Z',
      to: '2026-09-24T21:00:00.000Z',
    })
    const precision = new URL(fetchMock.mock.calls[1]![0].url)
    expect(precision.pathname).toBe('/api/v1/risks/precision')
    expect(precision.searchParams.get('from')).toBe('2026-08-31T21:00:00.000Z')

    await fetchPayments('t-1', { from: '2026-09-01', to: '2026-09-24' }, 'cursor-2')
    const payments = new URL(fetchMock.mock.calls[2]![0].url)
    expect(payments.pathname).toBe('/api/v1/analytics/payments')
    expect(payments.searchParams.get('limit')).toBe('20')
    expect(payments.searchParams.get('cursor')).toBe('cursor-2')
    await fetchPayments('t-1', { from: '2026-09-01', to: '2026-09-24' }, null)
    expect(new URL(fetchMock.mock.calls[3]![0].url).searchParams.has('cursor')).toBe(false)
  })
})
