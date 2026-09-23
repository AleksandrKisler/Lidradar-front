/**
 * Подписи типов атрибуции. Термины денег фиксированы продуктом: только
 * `RECOVERED` считается «подтверждённо возвращённой» выручкой.
 */
import type { AttributionType } from './types'

const labels: Record<AttributionType, string> = {
  RECOVERED: 'Возвращённая выручка',
  ORGANIC: 'Оплата без связи с риском',
  UNKNOWN: 'Связь неизвестна',
}

const descriptions: Record<AttributionType, string> = {
  RECOVERED: 'Клиент оплатил после действия по этому риску.',
  ORGANIC: 'Клиент заплатил бы и без работы над риском: в возвращённую выручку не входит.',
  UNKNOWN: 'Причина оплаты не доказана: сумма учитывается, но не как возвращённая.',
}

export function attributionLabel(value: AttributionType | string): string {
  return labels[value as AttributionType] ?? value
}

export function attributionDescription(value: AttributionType): string {
  return descriptions[value]
}
