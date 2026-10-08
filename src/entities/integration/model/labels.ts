/**
 * Подписи провайдеров, статусов, возможностей и безопасных кодов ошибок.
 * Неизвестное значение показывается как есть: новый код сервера не роняет
 * экран и не превращается в выдуманное объяснение.
 */
import type {
  ConnectionStatus,
  ConnectorCapability,
  ConnectorProvider,
  HealthVerification,
  ConnectionHealth,
} from './types'

export type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info'

const providerLabels: Record<ConnectorProvider, string> = {
  CONNECTED_BUSINESS_BOT: 'Telegram · бизнес-бот',
  GENERIC_WEBHOOK: 'Webhook',
  IMPORT: 'Импорт истории',
  TEST: 'Тестовый источник',
}

const providerDescriptions: Record<ConnectorProvider, string> = {
  CONNECTED_BUSINESS_BOT:
    'Переписка бизнес-аккаунта Telegram через вашего бота. Понадобится токен бота, ниже подсказка, где его взять.',
  GENERIC_WEBHOOK:
    'Для разработчика: ваша система отправляет сообщения в LidRadar запросами POST. После подключения вы получите адрес, секрет и пример запроса, их можно переслать тому, кто настраивает отправку. Если разработчика нет, выберите Telegram.',
  IMPORT: 'Разовый импорт истории переписок.',
  TEST: 'Учебный источник для стенда.',
}

const statusLabels: Record<ConnectionStatus, string> = {
  ACTIVE: 'Работает',
  DEGRADED: 'С перебоями',
  ERROR: 'Ошибка',
  DISCONNECTED: 'Отключён',
}

const statusTones: Record<ConnectionStatus, Tone> = {
  ACTIVE: 'success',
  DEGRADED: 'warning',
  ERROR: 'danger',
  DISCONNECTED: 'neutral',
}

const capabilityLabels: Record<ConnectorCapability, string> = {
  CAN_RECEIVE_MESSAGES: 'приём сообщений',
  CAN_SEND_MESSAGES: 'отправка сообщений',
  CAN_IMPORT_HISTORY: 'импорт истории',
  CAN_RECEIVE_EDITS: 'правки сообщений',
  CAN_RECEIVE_DELETES: 'удаления сообщений',
  CAN_RECEIVE_ATTACHMENTS: 'вложения',
  CAN_IDENTIFY_CONTACT: 'определение контакта',
}

const errorLabels: Record<string, string> = {
  TELEGRAM_CONFIGURATION_REQUIRED: 'Telegram ещё не настроен: вебхук не зарегистрирован',
  TELEGRAM_WEBHOOK_MISMATCH: 'Вебхук Telegram указывает не на LidRadar',
  INVALID_PAYLOAD: 'Провайдер прислал данные в неожиданном формате',
}

const verificationLabels: Record<HealthVerification, string> = {
  REMOTE: 'провайдер опрошен, результат сохранён',
  LOCAL: 'показано сохранённое состояние без удалённого опроса',
}

export function providerLabel(value: ConnectorProvider | string): string {
  return providerLabels[value as ConnectorProvider] ?? value
}

export function providerDescription(value: ConnectorProvider): string {
  return providerDescriptions[value]
}

export function connectionStatusLabel(value: ConnectionStatus | string): string {
  return statusLabels[value as ConnectionStatus] ?? value
}

export function connectionStatusTone(value: ConnectionStatus | string): Tone {
  return statusTones[value as ConnectionStatus] ?? 'neutral'
}

/** У webhook ACTIVE означает готовность принимать, а не проверенную доставку. */
export function connectionStatusView(
  provider: ConnectorProvider,
  health: Pick<ConnectionHealth, 'status' | 'lastSuccessAt'>,
): { label: string; tone: Tone } {
  if (provider === 'GENERIC_WEBHOOK' && health.status === 'ACTIVE') {
    return health.lastSuccessAt
      ? { label: 'Приём подтверждён', tone: 'success' }
      : { label: 'Ожидает первое событие', tone: 'info' }
  }
  return { label: connectionStatusLabel(health.status), tone: connectionStatusTone(health.status) }
}

export function capabilityLabel(value: ConnectorCapability | string): string {
  return capabilityLabels[value as ConnectorCapability] ?? value
}

/** Подпись безопасного кода ошибки провайдера; неизвестный код показывается сам. */
export function connectionErrorLabel(code: string): string {
  return errorLabels[code] ?? code
}

export function verificationLabel(value: HealthVerification | string): string {
  return verificationLabels[value as HealthVerification] ?? value
}
