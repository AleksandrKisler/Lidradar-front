/**
 * Окно аналитики живёт в query-строке (`from`, `to`), чтобы ссылка и
 * перезагрузка сохраняли выбор. Значения из адреса не доверенные: неполная
 * или некорректная пара отбрасывается, и действует окно по умолчанию.
 */
import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import { parseRange, type DateRange } from '@/entities/report'

function single(value: LocationQuery[string] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' && first !== '' ? first : null
}

/** Пара дат из адреса; при частичном или неверном значении — `null`. */
export function parseRangeQuery(query: LocationQuery): DateRange | null {
  const from = single(query.from)
  const to = single(query.to)
  if (from === null && to === null) return null
  return parseRange(from ?? '', to ?? '') ?? { from: from ?? '', to: to ?? '' }
}

export function rangeToQuery(range: DateRange): LocationQueryRaw {
  return { from: range.from, to: range.to }
}
