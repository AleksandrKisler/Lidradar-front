/** Типы подключений источников сообщений из контракта OpenAPI. */
import type { Schema } from '@/shared/api'

export type ChannelConnection = Schema<'ChannelConnection'>
export type ConnectedChannel = Schema<'ConnectedChannel'>
export type ConnectionHealth = Schema<'ConnectionHealth'>
export type HealthCheck = Schema<'HealthCheck'>
export type HealthVerification = HealthCheck['verification']
export type ConnectChannelRequest = Schema<'ConnectChannelRequest'>
export type ConnectorProvider = Schema<'ConnectorProvider'>
export type ConnectionStatus = Schema<'ConnectionStatus'>
export type ConnectorCapability = Schema<'ConnectorCapability'>

/**
 * Провайдеры, которые владелец подключает из интерфейса. `TEST` и `IMPORT`
 * служат стендам и импорту истории и в форме не предлагаются.
 */
export const CONNECTABLE_PROVIDERS: readonly ConnectorProvider[] = [
  'CONNECTED_BUSINESS_BOT',
  'GENERIC_WEBHOOK',
]

/** Формат токена бота Telegram по контракту; проверяется до отправки. */
export const BOT_TOKEN_PATTERN = /^[0-9]{5,20}:[A-Za-z0-9_-]{20,128}$/
export const WEBHOOK_SECRET_MIN_LENGTH = 16
export const WEBHOOK_SECRET_MAX_LENGTH = 256
