/**
 * Фильтры переписок в query-строке: поиск, «с риском», точка, подключение и
 * статус. Значения из адреса не доверенные: длина поиска ограничена, статус
 * сверяется с перечислением, неизвестное отбрасывается.
 */
import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import {
  CONVERSATION_STATUSES,
  SEARCH_MAX_LENGTH,
  type ConversationFilters,
  type ConversationStatus,
} from '@/entities/conversation'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function single(value: LocationQuery[string] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' && first !== '' ? first : null
}

export function parseConversationFilters(query: LocationQuery): ConversationFilters {
  const filters: ConversationFilters = {}
  const search = single(query.search)?.trim().slice(0, SEARCH_MAX_LENGTH)
  if (search) filters.search = search
  if (single(query.withRisk) === 'true') filters.withRisk = true
  const locationId = single(query.locationId)
  if (locationId && UUID_PATTERN.test(locationId)) filters.locationId = locationId
  const connectionId = single(query.connectionId)
  if (connectionId && UUID_PATTERN.test(connectionId)) filters.connectionId = connectionId
  const status = single(query.status)
  if (status && (CONVERSATION_STATUSES as readonly string[]).includes(status)) {
    filters.status = status as ConversationStatus
  }
  return filters
}

export function conversationFiltersToQuery(filters: ConversationFilters): LocationQueryRaw {
  const query: LocationQueryRaw = {}
  if (filters.search) query.search = filters.search
  if (filters.withRisk) query.withRisk = 'true'
  if (filters.locationId) query.locationId = filters.locationId
  if (filters.connectionId) query.connectionId = filters.connectionId
  if (filters.status) query.status = filters.status
  return query
}
