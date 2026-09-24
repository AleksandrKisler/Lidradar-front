/** Типы личной привязки Telegram и настроек уведомлений из контракта OpenAPI. */
import type { Schema } from '@/shared/api'

export type TelegramLinkToken = Schema<'TelegramLinkToken'>
export type TelegramLinkStatus = Schema<'TelegramLinkStatus'>
export type NotificationPreference = Schema<'NotificationPreference'>
export type NotificationPreferenceRequest = Schema<'NotificationPreferenceRequest'>
export type NotificationDeliveryMode = Schema<'NotificationDeliveryMode'>

export const DELIVERY_MODES: readonly NotificationDeliveryMode[] = [
  'IMMEDIATE',
  'DIGEST',
  'DISABLED',
]

/** Порог важности: уведомлять о рисках не ниже выбранной. */
export const SEVERITY_THRESHOLDS: readonly NotificationPreference['minimumSeverity'][] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]

/** Срок жизни одноразовой ссылки привязки по контракту. */
export const TELEGRAM_LINK_TTL_MINUTES = 15

export const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
