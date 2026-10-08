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
      errors[day.weekday] = 'Открытие должно быть раньше закрытия'
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
