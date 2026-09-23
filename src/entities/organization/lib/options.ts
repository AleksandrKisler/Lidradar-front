/**
 * Справочники формы организации: часовые пояса и валюты.
 * Список поясов берётся из среды выполнения, чтобы не устаревать.
 */
import type { UiSelectOption } from '@/shared/ui'

/** Валюты, которые предлагаются в форме; API принимает любой код ISO 4217. */
export const CURRENCY_OPTIONS: UiSelectOption[] = [
  { value: 'RUB', label: 'Российский рубль · ₽' },
  { value: 'KZT', label: 'Казахстанский тенге · ₸' },
  { value: 'BYN', label: 'Белорусский рубль · Br' },
  { value: 'USD', label: 'Доллар США · $' },
  { value: 'EUR', label: 'Евро · €' },
]

const fallbackTimeZones = [
  'Europe/Moscow',
  'Europe/Kaliningrad',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'UTC',
]

/** Часовые пояса IANA, известные браузеру; сначала предпочтительные для аудитории. */
export function timeZoneOptions(): UiSelectOption[] {
  let zones: string[]
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    zones = fallbackTimeZones
  }
  const preferred = zones.filter((zone) => zone.startsWith('Europe/') || zone.startsWith('Asia/'))
  const rest = zones.filter((zone) => !preferred.includes(zone))
  return [...preferred, ...rest].map((zone) => ({ value: zone, label: zone.replaceAll('_', ' ') }))
}

/** Часовой пояс браузера как значение по умолчанию для формы. */
export function defaultTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow'
  } catch {
    return 'Europe/Moscow'
  }
}
