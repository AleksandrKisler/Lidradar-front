/** Подписи режимов доставки и порогов важности для настроек уведомлений. */
import type { NotificationDeliveryMode, NotificationPreference } from './types'

const modeLabels: Record<NotificationDeliveryMode, string> = {
  IMMEDIATE: 'Сразу',
  DIGEST: 'Сводкой раз в день',
  DISABLED: 'Не уведомлять',
}

const modeDescriptions: Record<NotificationDeliveryMode, string> = {
  IMMEDIATE: 'Каждый новый риск — отдельным уведомлением, кроме тихих часов.',
  DIGEST: 'Одно сообщение в выбранное время со всеми рисками за день.',
  DISABLED: 'Риски остаются в Radar, но уведомлений об этом типе не будет.',
}

const thresholdLabels: Record<NotificationPreference['minimumSeverity'], string> = {
  LOW: 'Все риски',
  MEDIUM: 'Средние и выше',
  HIGH: 'Высокие и критичные',
  CRITICAL: 'Только критичные',
}

export function deliveryModeLabel(value: NotificationDeliveryMode | string): string {
  return modeLabels[value as NotificationDeliveryMode] ?? value
}

export function deliveryModeDescription(value: NotificationDeliveryMode): string {
  return modeDescriptions[value]
}

export function severityThresholdLabel(
  value: NotificationPreference['minimumSeverity'] | string,
): string {
  return thresholdLabels[value as NotificationPreference['minimumSeverity']] ?? value
}
