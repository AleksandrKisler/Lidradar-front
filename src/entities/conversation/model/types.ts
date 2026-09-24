/** Типы переписки, контакта и сообщений из контракта OpenAPI. */
import type { Schema } from '@/shared/api'

export type Conversation = Schema<'Conversation'>
export type ConversationStatus = Schema<'ConversationStatus'>
export type ConversationListItem = Schema<'ConversationListItem'>
export type ConversationDetail = Schema<'ConversationDetail'>
export type ConversationPage = Schema<'ConversationPage'>
export type Contact = Schema<'Contact'>
export type ContactSummary = Schema<'ContactSummary'>
export type ChannelSummary = Schema<'ChannelSummary'>
export type ActiveRisks = Schema<'ActiveRisks'>
export type Message = Schema<'Message'>
export type MessageView = Schema<'MessageView'>
export type MessagePage = Schema<'MessagePage'>
export type MessageDirection = Schema<'MessageDirection'>
export type MessageType = Schema<'MessageType'>
export type Attachment = Schema<'Attachment'>

/**
 * Фильтры списка переписок. Поиск и «с риском» выполняет сервер по всему
 * набору организации: локально фильтровать загруженные страницы нельзя.
 */
export interface ConversationFilters {
  search?: string | undefined
  withRisk?: boolean | undefined
  locationId?: string | undefined
  connectionId?: string | undefined
  status?: ConversationStatus | undefined
}

/** Предел длины поисковой строки по контракту. */
export const SEARCH_MAX_LENGTH = 100

export const CONVERSATION_STATUSES: readonly ConversationStatus[] = ['ACTIVE', 'ARCHIVED']

/** Размер страницы списка: экран с запасом, без лишней сети. */
export const CONVERSATION_PAGE_SIZE = 30

/** Размер страницы сообщений: обычная переписка помещается целиком. */
export const MESSAGE_PAGE_SIZE = 50
