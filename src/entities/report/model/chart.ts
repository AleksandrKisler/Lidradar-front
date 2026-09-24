/**
 * Столбцы дневного ряда. Ряд приходит с сервера по одной точке на дату окна с
 * нулями — интерфейс ничего не интерполирует и не синтезирует из итогов.
 */
import { formatCalendarDate } from '@/shared/lib'
import type { AnalyticsDailyPoint } from './types'

export interface ChartBar {
  date: string
  label: string
  /** Исходная десятичная строка суммы для подписи. */
  amount: string
  value: number
  /** Доля от верхней отметки шкалы, 0..1. */
  height: number
}

export interface ChartModel {
  bars: ChartBar[]
  /** Верхняя отметка шкалы: «круглое» число не меньше максимума. */
  top: number
  ticks: number[]
  /** Шаг подписей дат по оси X, чтобы длинные окна оставались читаемыми. */
  labelStep: number
  empty: boolean
}

/** Округление максимума вверх до 1, 2 или 5 × 10ⁿ. */
export function niceTop(max: number): number {
  if (!(max > 0)) return 0
  const power = 10 ** Math.floor(Math.log10(max))
  const scaled = max / power
  const factor = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return factor * power
}

export function labelStep(count: number): number {
  if (count <= 14) return 1
  if (count <= 31) return 5
  if (count <= 93) return 15
  return 30
}

export function buildChart(
  series: readonly AnalyticsDailyPoint[],
  pick: (point: AnalyticsDailyPoint) => string,
): ChartModel {
  const raw = series.map((point) => ({ point, amount: pick(point), value: Number(pick(point)) }))
  const values = raw.map((item) => (Number.isFinite(item.value) ? item.value : 0))
  const top = niceTop(Math.max(0, ...values))
  const bars = raw.map((item, index) => ({
    date: item.point.date,
    label: formatCalendarDate(item.point.date, { month: 'short', year: false }),
    amount: item.amount,
    value: values[index]!,
    height: top > 0 ? values[index]! / top : 0,
  }))
  return {
    bars,
    top,
    ticks: top > 0 ? [0, top / 2, top] : [0],
    labelStep: labelStep(bars.length),
    empty: top === 0,
  }
}
