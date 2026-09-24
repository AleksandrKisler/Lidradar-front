/**
 * Окно отчёта о потреблении: календарные даты UTC включительно, по умолчанию
 * последние 30 дней, не длиннее 366. В запрос уходят моменты RFC 3339: начало
 * первого дня и начало дня после последнего.
 */
import { addDays, daysBetween, isCalendarDate } from '@/shared/lib'

export interface UsageRange {
  from: string
  to: string
}

export const USAGE_MAX_DAYS = 366

export function defaultUsageRange(now: Date = new Date()): UsageRange {
  const to = now.toISOString().slice(0, 10)
  return { from: addDays(to, -29), to }
}

export function validateUsageRange(range: UsageRange): string | null {
  if (!isCalendarDate(range.from) || !isCalendarDate(range.to)) {
    return 'Укажите обе даты в формате ГГГГ-ММ-ДД'
  }
  const days = daysBetween(range.from, range.to)
  if (days < 1) return 'Дата начала позже даты окончания'
  if (days > USAGE_MAX_DAYS) return `Окно не длиннее ${USAGE_MAX_DAYS} дней`
  return null
}

export function usageRangeToInstants(range: UsageRange): { from: string; to: string } {
  return { from: `${range.from}T00:00:00.000Z`, to: `${addDays(range.to, 1)}T00:00:00.000Z` }
}
