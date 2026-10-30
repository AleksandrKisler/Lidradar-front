/**
 * Недельный график точки.
 *
 * Сервер принимает только полную неделю одним атомарным PUT: семь дней с
 * уникальными weekday, у рабочего дня обе границы (`opensAt < closesAt`),
 * у выходного — никаких скрытых часов. Черновик редактора хранит время
 * строками `HH:MM` из поля ввода.
 */
import type { BusinessHour, BusinessHoursRequest } from './types'

export interface DayDraft {
  weekday: number
  closed: boolean
  opensAt: string
  closesAt: string
}

export const WEEKDAYS: readonly {
  weekday: number
  label: string
  short: string
  /** Родительный падеж для фраз вида «время понедельника». */
  genitive: string
}[] = [
  { weekday: 1, label: 'Понедельник', short: 'Пн', genitive: 'понедельника' },
  { weekday: 2, label: 'Вторник', short: 'Вт', genitive: 'вторника' },
  { weekday: 3, label: 'Среда', short: 'Ср', genitive: 'среды' },
  { weekday: 4, label: 'Четверг', short: 'Чт', genitive: 'четверга' },
  { weekday: 5, label: 'Пятница', short: 'Пт', genitive: 'пятницы' },
  { weekday: 6, label: 'Суббота', short: 'Сб', genitive: 'субботы' },
  { weekday: 7, label: 'Воскресенье', short: 'Вс', genitive: 'воскресенья' },
]

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/** Стартовый график для новой точки: будни 09:00–20:00, суббота 10:00–18:00, воскресенье выходной. */
export function defaultWeek(): DayDraft[] {
  return WEEKDAYS.map(({ weekday }) => {
    if (weekday === 7) return { weekday, closed: true, opensAt: '', closesAt: '' }
    if (weekday === 6) return { weekday, closed: false, opensAt: '10:00', closesAt: '18:00' }
    return { weekday, closed: false, opensAt: '09:00', closesAt: '20:00' }
  })
}

/**
 * Стартовая неделя новой точки в мастере начала работы (US-M02-04): рабочие часы 10:00–19:00,
 * а рабочие и выходные дни — те же, что у `defaultWeek()`. Шаблон настроек не меняется.
 */
export function onboardingDefaultWeek(): DayDraft[] {
  return defaultWeek().map((day) =>
    day.closed ? day : { ...day, opensAt: '10:00', closesAt: '19:00' },
  )
}

/**
 * Полная сохранённая неделя: ровно семь уникальных weekday 1..7, у рабочего дня обе границы
 * `HH:MM` и начало раньше конца. Неполный или повреждённый ответ даёт `null` — его нельзя
 * достраивать выходными и считать подтверждённой неделей.
 */
export function completeWeekFromHours(hours: readonly BusinessHour[]): DayDraft[] | null {
  if (!isFullWeekdaySet(hours.map((hour) => hour.weekday))) return null
  const week = weekFromHours(hours)
  return week && weekIssues(week) === null ? week : null
}

/** Причина ошибки дня: нет границы или неверный формат (`time`), начало не раньше конца (`order`). */
export type DayIssue = 'time' | 'order'

/** Ровно дни 1..7, каждый один раз: сдвинутый, дробный, повторный или неполный состав — нет. */
function isFullWeekdaySet(weekdays: readonly number[]): boolean {
  const unique = new Set(weekdays)
  return (
    weekdays.length === WEEKDAYS.length &&
    unique.size === WEEKDAYS.length &&
    WEEKDAYS.every((day) => unique.has(day.weekday))
  )
}

/**
 * Строгая проверка недели: ровно дни 1..7 без пропусков и повторов и корректные интервалы
 * рабочих дней. `null` — неделя корректна; иначе причины по дням (`0` — нарушен сам состав недели).
 */
export function weekIssues(days: readonly DayDraft[]): Record<number, DayIssue> | null {
  const issues: Record<number, DayIssue> = {}
  if (!isFullWeekdaySet(days.map((day) => day.weekday))) issues[0] = 'time'
  for (const day of days) {
    if (day.closed) continue
    if (!TIME_PATTERN.test(day.opensAt) || !TIME_PATTERN.test(day.closesAt))
      issues[day.weekday] = 'time'
    else if (day.opensAt >= day.closesAt) issues[day.weekday] = 'order'
  }
  return Object.keys(issues).length > 0 ? issues : null
}

/** Неделя по дням недели без скрытых часов у выходных: основа сравнения и отправки. */
export function normalizeWeek(days: readonly DayDraft[]): DayDraft[] {
  return [...days]
    .sort((left, right) => left.weekday - right.weekday)
    .map((day) =>
      day.closed
        ? { weekday: day.weekday, closed: true, opensAt: '', closesAt: '' }
        : { weekday: day.weekday, closed: false, opensAt: day.opensAt, closesAt: day.closesAt },
    )
}

/**
 * Совпадает ли сохранённый на сервере график с ожидаемой неделей: пояс и семь дней
 * по weekday/выходному/часам, без учёта ID строк, порядка и `updatedAt`.
 */
export function sameServerWeek(
  location: { timezone: string; businessHours: readonly BusinessHour[] },
  timezone: string,
  days: readonly DayDraft[],
): boolean {
  const stored = completeWeekFromHours(location.businessHours)
  return (
    location.timezone === timezone &&
    stored !== null &&
    sameWeek(normalizeWeek(stored), normalizeWeek(days))
  )
}

/**
 * Черновик из сохранённого графика. Отсутствующие дни считаются выходными;
 * пустой график (`[]`) даёт `null`, чтобы вызывающий подставил стартовый.
 */
export function weekFromHours(hours: readonly BusinessHour[]): DayDraft[] | null {
  if (hours.length === 0) return null
  return WEEKDAYS.map(({ weekday }) => {
    const stored = hours.find((hour) => hour.weekday === weekday)
    if (!stored || stored.closed) return { weekday, closed: true, opensAt: '', closesAt: '' }
    return {
      weekday,
      closed: false,
      opensAt: stored.opensAt?.slice(0, 5) ?? '',
      closesAt: stored.closesAt?.slice(0, 5) ?? '',
    }
  })
}

/** Ошибки по дням недели; пустой объект — неделя корректна. */
export function validateWeek(days: readonly DayDraft[]): Record<number, string> {
  const errors: Record<number, string> = {}
  for (const day of days) {
    if (day.closed) continue
    if (!TIME_PATTERN.test(day.opensAt) || !TIME_PATTERN.test(day.closesAt)) {
      errors[day.weekday] = 'Укажите время открытия и закрытия'
    } else if (day.opensAt >= day.closesAt) {
      errors[day.weekday] = 'Время окончания должно быть позже начала.'
    }
  }
  return errors
}

/** Тело атомарного PUT: у выходных дней времени нет. */
export function toBusinessHoursRequest(
  timezone: string,
  days: readonly DayDraft[],
): BusinessHoursRequest {
  return {
    timezone,
    days: days.map((day) =>
      day.closed
        ? { weekday: day.weekday, closed: true }
        : { weekday: day.weekday, closed: false, opensAt: day.opensAt, closesAt: day.closesAt },
    ),
  }
}

export function sameWeek(left: readonly DayDraft[], right: readonly DayDraft[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** Краткая подпись дня для списков точек: `09:00–20:00` или `выходной`. */
export function describeDay(day: BusinessHour): string {
  if (day.closed || !day.opensAt || !day.closesAt) return 'выходной'
  return `${day.opensAt.slice(0, 5)}–${day.closesAt.slice(0, 5)}`
}
