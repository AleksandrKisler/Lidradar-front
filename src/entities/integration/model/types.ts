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

/** Формат токена бота Telegram по контракту; проверяется до отправки. */
export const BOT_TOKEN_PATTERN = /^[0-9]{5,20}:[A-Za-z0-9_-]{20,128}$/
