/**
 * Производные показатели. Деление на ноль невозможно: без знаменателя метрика
 * отсутствует (`null`) и подписывается «Недостаточно данных», а не «0 %».
 */
import type { AnalyticsAttributionSplit, AnalyticsSummary, RiskPrecisionItem } from './types'

export const INSUFFICIENT_DATA = 'Недостаточно данных'
const NBSP = ' '

export function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null
  return numerator / denominator
}

/** Доля 0..1 → `50 %`; `null` → длинное тире. */
export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${(value * 100).toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}${NBSP}%`
}

export interface PrecisionView {
  precision: string
  falsePositiveRate: string
  coverage: string
  /** Покрытие ниже порога отчёта: метрики показываются, но помечены. */
  lowCoverage: boolean
  /** Метрик нет: ни одного вердикта в окне. */
  insufficient: boolean
}

export function precisionView(item: RiskPrecisionItem): PrecisionView {
  const insufficient = item.precision === null
  return {
    precision: insufficient ? INSUFFICIENT_DATA : formatPercent(item.precision),
    falsePositiveRate:
      item.falsePositiveRate === null ? INSUFFICIENT_DATA : formatPercent(item.falsePositiveRate),
    coverage: formatPercent(item.coverageRate),
    lowCoverage: !item.reliable,
    insufficient,
  }
}

export interface ActivityRates {
  acted: number | null
  resolved: number | null
  falsePositive: number | null
  booked: number | null
}

/** Доли от найденных рисков и открытых сделок; без знаменателя — `null`. */
export function activityRates(summary: AnalyticsSummary): ActivityRates {
  return {
    acted: ratio(summary.risks.acted, summary.risks.detected),
    resolved: ratio(summary.risks.resolved, summary.risks.detected),
    falsePositive: ratio(summary.risks.falsePositive, summary.risks.detected),
    booked: ratio(summary.opportunities.booked, summary.opportunities.created),
  }
}

const attributionCaptions: Record<AnalyticsAttributionSplit['type'], string> = {
  RECOVERED: 'Возвращено после работы с риском',
  ORGANIC: 'Оплата без связи с риском',
  UNKNOWN: 'Связь пока не определена',
}

export function attributionCaption(type: AnalyticsAttributionSplit['type'] | string): string {
  return attributionCaptions[type as AnalyticsAttributionSplit['type']] ?? type
}

/** Число оплат с атрибуцией `RECOVERED` из разбиения сервера; строки не досчитываются. */
export function recoveredPayments(summary: AnalyticsSummary): number | null {
  const row = summary.attribution.find((item) => item.type === 'RECOVERED')
  return row ? row.count : null
}
