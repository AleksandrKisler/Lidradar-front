/** Подписи перечислений переписки; неизвестное значение показывается как есть. */
import type { ConversationStatus, MessageDirection, MessageType } from './types'

export type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info'

const directionLabels: Record<MessageDirection, string> = {
  INCOMING: 'Клиент',
  OUTGOING: 'Менеджер',
  SYSTEM: 'Система',
}

const messageTypeLabels: Record<MessageType, string> = {
  TEXT: 'Текст',
  IMAGE: 'Изображение',
  VOICE: 'Голосовое сообщение',
  AUDIO: 'Аудио',
  VIDEO: 'Видео',
  DOCUMENT: 'Документ',
  OTHER: 'Вложение',
}

const conversationStatusLabels: Record<ConversationStatus, string> = {
  ACTIVE: 'Активна',
  ARCHIVED: 'В архиве',
}

const connectionStatusLabels: Record<string, string> = {
  ACTIVE: 'подключён',
  DEGRADED: 'работает с перебоями',
  ERROR: 'ошибка подключения',
  DISCONNECTED: 'отключён',
}

export function directionLabel(value: MessageDirection | string): string {
  return directionLabels[value as MessageDirection] ?? value
}

export function messageTypeLabel(value: MessageType | string): string {
  return messageTypeLabels[value as MessageType] ?? value
}

export function conversationStatusLabel(value: ConversationStatus | string): string {
  return conversationStatusLabels[value as ConversationStatus] ?? value
}

export function connectionStatusLabel(value: string): string {
  return connectionStatusLabels[value] ?? value
}

/** Подпись и тон бейджа активных рисков строки списка. */
export function activeRisksBadge(active: { count: number; maxSeverity: string | null }): {
  label: string
  tone: Tone
} {
  if (active.count <= 0 || !active.maxSeverity) {
    return { label: 'Без активных рисков', tone: 'neutral' }
  }
  const bySeverity: Record<string, { label: string; tone: Tone }> = {
    CRITICAL: { label: 'Критичный риск', tone: 'danger' },
    HIGH: { label: 'Высокий риск', tone: 'warning' },
    MEDIUM: { label: 'Средний риск', tone: 'info' },
    LOW: { label: 'Низкий риск', tone: 'neutral' },
  }
  const base = bySeverity[active.maxSeverity] ?? { label: 'Активный риск', tone: 'neutral' as Tone }
  return active.count > 1 ? { label: `${base.label} · ${active.count}`, tone: base.tone } : base
}
