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
