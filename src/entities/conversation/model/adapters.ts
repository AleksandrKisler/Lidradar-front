/**
 * Модели представления переписки. Подпись контакта строится с маскированием:
 * имя → часть телефона → часть почты → «Без имени». Вложения — только
 * метаданные без ссылки на скачивание, поэтому всегда «недоступны» в браузере.
 */
import { formatBytes, maskEmail, maskPhone } from '@/shared/lib'
import { activeRisksBadge, directionLabel, messageTypeLabel, type Tone } from './labels'
import type {
  ConversationListItem,
  ConversationStatus,
  MessageDirection,
  MessagePage,
  MessageType,
  MessageView,
} from './types'

export const UNNAMED_CONTACT = 'Без имени'

export function contactLabel(contact: {
  displayName: string | null
  phoneNormalized?: string | null
  emailNormalized?: string | null
}): string {
  const name = contact.displayName?.trim()
  if (name) return name
  if (contact.phoneNormalized) return maskPhone(contact.phoneNormalized)
  if (contact.emailNormalized) return maskEmail(contact.emailNormalized)
  return UNNAMED_CONTACT
}

/** Инициалы для аватара: первые буквы двух слов; для маскированных подписей — точка. */
export function contactInitials(label: string): string {
  // Маскированная подпись начинается с точки: инициалов у неё нет.
  if (label.startsWith('•')) return '•'
  const words = label.split(/\s+/).filter((word) => /^[\p{L}\p{N}]/u.test(word))
  if (words.length === 0) return '•'
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

export interface ConversationRowViewModel {
  id: string
  contactName: string
  initials: string
  channelName: string
  locationId: string | null
  status: ConversationStatus
  /** Текст превью или подпись типа вложения; `null`, если сообщений нет. */
  preview: string | null
  previewDirection: MessageDirection | null
  lastAt: string | null
  risks: { count: number; label: string; tone: Tone }
  externalUrl: string | null
  externalUnavailableReason: string | null
}

export function toConversationRow(item: ConversationListItem): ConversationRowViewModel {
  const contactName = contactLabel(item.contact)
  const last = item.lastMessage
  const preview = last ? (last.type === 'TEXT' ? last.preview : messageTypeLabel(last.type)) : null
  return {
    id: item.conversation.id,
    contactName,
    initials: contactInitials(contactName),
    channelName: item.channel.name,
    locationId: item.conversation.locationId,
    status: item.conversation.status,
    preview,
    previewDirection: last?.direction ?? null,
    lastAt: last?.sentAt ?? item.conversation.lastMessageAt,
    risks: { count: item.activeRisks.count, ...activeRisksBadge(item.activeRisks) },
    externalUrl: item.externalLink.url,
    externalUnavailableReason: item.externalLink.unavailableReason,
  }
}

export interface AttachmentViewModel {
  id: string
  label: string
  size: string
  mimeType: string | null
}

export interface MessageBubbleViewModel {
  id: string
  direction: MessageDirection
  author: string
  type: MessageType
  typeLabel: string
  /** Текст сообщения; `null` для вложений без подписи. */
  text: string | null
  /** Сообщение удалено у поставщика: показывается заглушка, не текст. */
  deleted: boolean
  sentAt: string
  attachments: AttachmentViewModel[]
}

export function toMessageBubble(view: MessageView): MessageBubbleViewModel {
  const { message, attachments } = view
  return {
    id: message.id,
    direction: message.direction,
    author: directionLabel(message.direction),
    type: message.type,
    typeLabel: messageTypeLabel(message.type),
    text: message.text?.trim() ? message.text : null,
    deleted: message.providerDeletedAt !== null,
    sentAt: message.sentAt,
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      label: attachment.mimeType ? attachmentKindLabel(attachment.mimeType) : 'Вложение',
      size: formatBytes(attachment.sizeBytes),
      mimeType: attachment.mimeType,
    })),
  }
}

function attachmentKindLabel(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'Изображение'
  if (mimeType.startsWith('audio/')) return 'Аудио'
  if (mimeType.startsWith('video/')) return 'Видео'
  if (mimeType === 'application/pdf') return 'PDF'
  return 'Файл'
}

/**
 * Страницы приходят от новых к старым, каждая — тоже от новых к старым.
 * Для отображения окно разворачивается в хронологический порядок, не меняя
 * семантики курсора.
 */
export function orderOldestFirst(pages: readonly MessagePage[]): MessageView[] {
  const newestFirst = pages.flatMap((page) => page.items)
  return newestFirst.slice().reverse()
}
