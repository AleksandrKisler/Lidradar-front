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

/** Русские названия поясов России: подпись «Москва · UTC+3»; остальные пояса подписываются идентификатором. */
const russianZones: Record<string, string> = {
  'Europe/Kaliningrad': 'Калининград',
  'Europe/Moscow': 'Москва',
  'Europe/Samara': 'Самара',
  'Asia/Yekaterinburg': 'Екатеринбург',
  'Asia/Omsk': 'Омск',
  'Asia/Novosibirsk': 'Новосибирск',
  'Asia/Krasnoyarsk': 'Красноярск',
  'Asia/Irkutsk': 'Иркутск',
  'Asia/Yakutsk': 'Якутск',
  'Asia/Vladivostok': 'Владивосток',
  'Asia/Magadan': 'Магадан',
  'Asia/Kamchatka': 'Камчатка',
}

/** Подпись «Москва · UTC+3»: смещение берётся из `Intl`; без него остаётся одно название. */
export function timeZoneLabel(zone: string): string {
  const name = russianZones[zone]
  if (!name) return zone.replaceAll('_', ' ')
  try {
    const part = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((item) => item.type === 'timeZoneName')
    return part ? `${name} · ${part.value.replace('GMT', 'UTC')}` : name
  } catch {
    return name
  }
}

const fallbackTimeZones = [
  'Europe/Moscow',
  'Europe/Kaliningrad',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'UTC',
]

let cachedZoneOptions: UiSelectOption[] | null = null

/** Часовые пояса IANA, известные браузеру; сначала предпочтительные для аудитории. */
export function timeZoneOptions(): UiSelectOption[] {
  if (cachedZoneOptions) return cachedZoneOptions
  let zones: string[]
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    zones = fallbackTimeZones
  }
  const preferred = zones.filter((zone) => zone.startsWith('Europe/') || zone.startsWith('Asia/'))
  const rest = zones.filter((zone) => !preferred.includes(zone))
  cachedZoneOptions = [...preferred, ...rest].map((zone) => ({
    value: zone,
    label: timeZoneLabel(zone),
  }))
  return cachedZoneOptions
}

/** Часовой пояс браузера как значение по умолчанию для формы. */
export function defaultTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow'
  } catch {
    return 'Europe/Moscow'
  }
}
