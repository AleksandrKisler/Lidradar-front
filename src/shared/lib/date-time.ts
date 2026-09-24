/**
 * Дата и время.
 *
 * Все метки времени API — RFC 3339 в UTC. Показываются они в часовом поясе
 * организации, а не браузера: разные сотрудники одной организации должны
 * видеть одинаковое время.
 */
import { formatDistanceStrict, isValid, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

/** Разбирает RFC 3339 и возвращает `null` для некорректной строки. */
export function parseInstant(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : null
}

/**
 * Форматирует момент времени в часовом поясе организации: `18 сент., 13:41`.
 * Неизвестный часовой пояс не роняет интерфейс — используется UTC.
 */
export function formatDateTime(
  value: string | Date | null | undefined,
  timeZone: string,
): string | null {
  const date = value instanceof Date ? value : parseInstant(value)
  if (!date) return null
  const format = (zone: string) =>
    new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: zone,
    }).format(date)
  try {
    return format(timeZone)
  } catch {
    return format('UTC')
  }
}

/** Только время `13:41` в часовом поясе организации. */
export function formatTime(
  value: string | Date | null | undefined,
  timeZone: string,
): string | null {
  const date = value instanceof Date ? value : parseInstant(value)
  if (!date) return null
  const format = (zone: string) =>
    new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: zone }).format(
      date,
    )
  try {
    return format(timeZone)
  } catch {
    return format('UTC')
  }
}

/**
 * Относительное время без округления до «около»: `2 часа назад`,
 * `через 15 минут`. Относительная подпись всегда дополняется абсолютным
 * временем в подсказке, это делает вызывающий компонент.
 */
export function formatRelative(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): string | null {
  const date = value instanceof Date ? value : parseInstant(value)
  if (!date) return null
  return formatDistanceStrict(date, now, { addSuffix: true, locale: ru })
}

/** Ключ календарного дня `YYYY-MM-DD` в часовом поясе организации. */
export function dayKey(value: string | Date | null | undefined, timeZone: string): string | null {
  const date = value instanceof Date ? value : parseInstant(value)
  if (!date) return null
  const format = (zone: string) =>
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: zone,
    }).format(date)
  try {
    return format(timeZone)
  } catch {
    return format('UTC')
  }
}

/**
 * Подпись дня для разделителей: «Сегодня», «Вчера» или `18 сентября`
 * (с годом, если день не в текущем году). Сравнение идёт по календарным дням
 * часового пояса организации.
 */
export function formatDay(
  value: string | Date | null | undefined,
  timeZone: string,
  now: Date = new Date(),
): string | null {
  const date = value instanceof Date ? value : parseInstant(value)
  if (!date) return null
  const key = dayKey(date, timeZone)
  const today = dayKey(now, timeZone)
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000), timeZone)
  if (key === today) return 'Сегодня'
  if (key === yesterday) return 'Вчера'
  const sameYear = key?.slice(0, 4) === today?.slice(0, 4)
  const format = (zone: string) =>
    new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      ...(sameYear ? {} : { year: 'numeric' }),
      timeZone: zone,
    }).format(date)
  try {
    return format(timeZone)
  } catch {
    return format('UTC')
  }
}

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Проверяет строку календарной даты `YYYY-MM-DD` и её существование. */
export function isCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

/** Календарная арифметика без часовых поясов: `2026-02-28` + 1 → `2026-03-01`. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** Число календарных дней между датами включительно; отрицательное, если порядок нарушен. */
export function daysBetween(from: string, to: string): number {
  const utc = (value: string) => {
    const [year, month, day] = value.split('-').map(Number) as [number, number, number]
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((utc(to) - utc(from)) / 86_400_000) + 1
}

/** Смещение пояса относительно UTC в миллисекундах для данного момента. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0)
  const wall = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour') % 24,
    part('minute'),
    part('second'),
  )
  return wall - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * Начало календарного дня организации как момент UTC. Учитывает переходы на
 * летнее время: смещение берётся для самого искомого момента, а не для
 * полуночи UTC. Неизвестный пояс считается UTC.
 */
export function zonedDayStart(date: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const guess = Date.UTC(year, month - 1, day)
  try {
    const first = zoneOffsetMs(new Date(guess), timeZone)
    let instant = guess - first
    const second = zoneOffsetMs(new Date(instant), timeZone)
    if (second !== first) instant = guess - second
    return new Date(instant)
  } catch {
    return new Date(guess)
  }
}

/** Подпись календарной даты без привязки к поясу: `15 августа 2026`. */
export function formatCalendarDate(
  date: string,
  options: { month?: 'long' | 'short'; year?: boolean } = {},
): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: options.month ?? 'long',
    ...(options.year === false ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}
