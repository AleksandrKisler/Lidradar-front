/** Подписи статусов очередей и AI. Неизвестный статус показывается как есть с нейтральным тоном. */
type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info'

const statusLabels: Record<string, string> = {
  PENDING: 'Ожидает',
  PROCESSING: 'Выполняется',
  RETRY: 'Повтор',
  SUCCEEDED: 'Выполнено',
  PUBLISHED: 'Опубликовано',
  DEAD: 'Мёртвое',
  LEASED: 'Выдано узлу',
  RUNNING: 'Выполняется',
  FAILED: 'Ошибка',
  APPLIED: 'Применён',
  STALE: 'Устарел',
  REJECTED: 'Отклонён',
  OFFLINE: 'Не в сети',
  READY: 'Готов',
  REVOKED: 'Отозван',
  ACTIVE: 'Активна',
  SUSPENDED: 'Приостановлена',
  ARCHIVED: 'В архиве',
  ERROR: 'Ошибка',
  DISCONNECTED: 'Отключено',
  DELIVERED: 'Доставлено',
}

const statusTones: Record<string, Tone> = {
  PENDING: 'info',
  PROCESSING: 'brand',
  RUNNING: 'brand',
  LEASED: 'brand',
  RETRY: 'warning',
  SUCCEEDED: 'success',
  PUBLISHED: 'success',
  APPLIED: 'success',
  DELIVERED: 'success',
  READY: 'success',
  ACTIVE: 'success',
  DEAD: 'danger',
  FAILED: 'danger',
  REJECTED: 'danger',
  ERROR: 'danger',
  STALE: 'warning',
  OFFLINE: 'neutral',
  REVOKED: 'neutral',
  SUSPENDED: 'warning',
  ARCHIVED: 'neutral',
  DISCONNECTED: 'neutral',
}

export function adminStatusLabel(value: string): string {
  return statusLabels[value] ?? value
}

export function adminStatusTone(value: string): Tone {
  return statusTones[value] ?? 'neutral'
}

const channelLabels: Record<string, string> = { IN_APP: 'В приложении', TELEGRAM: 'Telegram' }

export function deliveryChannelLabel(value: string): string {
  return channelLabels[value] ?? value
}

const kindLabels = {
  job: 'Задание',
  outbox: 'Событие outbox',
  aiJob: 'AI-задание',
  delivery: 'Доставка уведомления',
} as const

export function deadLetterKindLabel(kind: keyof typeof kindLabels): string {
  return kindLabels[kind]
}

const actionLabels = {
  retry: 'Повторить',
  replay: 'Переотправить',
  discard: 'Отложить',
} as const

export function recoveryActionLabel(action: keyof typeof actionLabels): string {
  return actionLabels[action]
}
