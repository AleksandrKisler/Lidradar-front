/**
 * Окно аналитики: даты включительно в часовом поясе организации. Границы для
 * отчёта точности переводятся в моменты UTC по началу календарного дня в этом
 * поясе (конец — начало следующего дня), так что сводка и точность смотрят на
 * одно и то же окно. Ответный `period` сервера остаётся авторитетным.
 */
import { addDays, dayKey, daysBetween, isCalendarDate, zonedDayStart } from '@/shared/lib'
import { DEFAULT_RANGE_DAYS, MAX_RANGE_DAYS, type DateRange, type InstantRange } from './types'

/** Последние N дней, включая сегодняшний день организации. */
export function presetRange(days: number, timeZone: string, now: Date = new Date()): DateRange {
  const to = dayKey(now, timeZone) ?? now.toISOString().slice(0, 10)
  return { from: addDays(to, -(days - 1)), to }
}

export function defaultRange(timeZone: string, now: Date = new Date()): DateRange {
  return presetRange(DEFAULT_RANGE_DAYS, timeZone, now)
}

/** Ошибка окна для показа под полями; `null` — окно допустимо. */
export function validateRange(range: DateRange): string | null {
  if (!isCalendarDate(range.from) || !isCalendarDate(range.to)) {
    return 'Укажите обе даты в формате ГГГГ-ММ-ДД'
  }
  const days = daysBetween(range.from, range.to)
  if (days < 1) return 'Дата начала позже даты окончания'
  if (days > MAX_RANGE_DAYS) return `Окно не длиннее ${MAX_RANGE_DAYS} дней`
  return null
}

export function rangeDays(range: DateRange): number {
  return daysBetween(range.from, range.to)
}

export function rangeToInstants(range: DateRange, timeZone: string): InstantRange {
  return {
    from: zonedDayStart(range.from, timeZone).toISOString(),
    to: zonedDayStart(addDays(range.to, 1), timeZone).toISOString(),
  }
}

export function sameRange(left: DateRange | null, right: DateRange | null): boolean {
  return left?.from === right?.from && left?.to === right?.to
}

/** Разбор пары дат из ненадёжного источника (query-строка); неполная пара — `null`. */
export function parseRange(from: unknown, to: unknown): DateRange | null {
  if (typeof from !== 'string' || typeof to !== 'string') return null
  if (!isCalendarDate(from) || !isCalendarDate(to)) return null
  return { from, to }
}
