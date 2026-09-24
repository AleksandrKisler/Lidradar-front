/**
 * Запросы переписок. Ключи включают организацию и нормализованные фильтры;
 * курсор привязан к фильтрам, поэтому смена фильтра — новый ключ и новый
 * первый запрос без старого курсора. Строка списка уже содержит контакт,
 * канал, превью и активные риски: запросов деталей на строку нет.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useInfiniteQuery, useQuery } from '@tanstack/vue-query'
import { apiClient, normalizeFilters, tenantScope, unwrap } from '@/shared/api'
import {
  CONVERSATION_PAGE_SIZE,
  MESSAGE_PAGE_SIZE,
  type ConversationDetail,
  type ConversationFilters,
  type ConversationPage,
  type ConversationStatus,
  type MessagePage,
} from '../model/types'

export const conversationKeys = {
  list: (tenantId: string, filters: ConversationFilters) =>
    [...tenantScope(tenantId), 'conversations', normalizeFilters(filters)] as const,
  detail: (tenantId: string, conversationId: string) =>
    [...tenantScope(tenantId), 'conversation', conversationId] as const,
  messages: (tenantId: string, conversationId: string) =>
    [...tenantScope(tenantId), 'conversation', conversationId, 'messages'] as const,
}

type ConversationQuery = {
  search?: string
  withRisk?: boolean
  locationId?: string
  connectionId?: string
  status?: ConversationStatus
}

/** В запрос попадают только заданные фильтры; `withRisk=false` не отправляется. */
function toQuery(filters: ConversationFilters): ConversationQuery {
  const query: ConversationQuery = {}
  if (filters.search) query.search = filters.search
  if (filters.withRisk) query.withRisk = true
  if (filters.locationId) query.locationId = filters.locationId
  if (filters.connectionId) query.connectionId = filters.connectionId
  if (filters.status) query.status = filters.status
  return query
}

export function fetchConversations(
  tenantId: string,
  filters: ConversationFilters,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<ConversationPage> {
  return unwrap(
    apiClient.GET('/api/v1/conversations', {
      params: {
        header: { 'X-Tenant-ID': tenantId },
        query: {
          ...toQuery(filters),
          limit: CONVERSATION_PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
        },
      },
      ...(signal ? { signal } : {}),
    }),
  )
}

export function fetchConversation(
  tenantId: string,
  conversationId: string,
  signal?: AbortSignal,
): Promise<ConversationDetail> {
  return unwrap(
    apiClient.GET('/api/v1/conversations/{conversationId}', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { conversationId } },
      ...(signal ? { signal } : {}),
    }),
  )
}

export function fetchMessages(
  tenantId: string,
  conversationId: string,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<MessagePage> {
  return unwrap(
    apiClient.GET('/api/v1/conversations/{conversationId}/messages', {
      params: {
        header: { 'X-Tenant-ID': tenantId },
        path: { conversationId },
        query: { limit: MESSAGE_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
      },
      ...(signal ? { signal } : {}),
    }),
  )
}

export function useConversationsQuery(
  tenantId: MaybeRefOrGetter<string | null>,
  filters: MaybeRefOrGetter<ConversationFilters>,
) {
  return useInfiniteQuery({
    queryKey: computed(() => conversationKeys.list(toValue(tenantId) ?? '', toValue(filters))),
    queryFn: ({ pageParam, signal }) =>
      fetchConversations(toValue(tenantId)!, toValue(filters), pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: computed(() => toValue(tenantId) !== null),
  })
}

export function useConversationQuery(
  tenantId: MaybeRefOrGetter<string | null>,
  conversationId: MaybeRefOrGetter<string | null>,
) {
  return useQuery({
    queryKey: computed(() =>
      conversationKeys.detail(toValue(tenantId) ?? '', toValue(conversationId) ?? ''),
    ),
    queryFn: ({ signal }) =>
      fetchConversation(toValue(tenantId)!, toValue(conversationId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null && toValue(conversationId) !== null),
  })
}

/** Сообщения от новых к старым; следующая страница — более старые. */
export function useMessagesQuery(
  tenantId: MaybeRefOrGetter<string | null>,
  conversationId: MaybeRefOrGetter<string | null>,
) {
  return useInfiniteQuery({
    queryKey: computed(() =>
      conversationKeys.messages(toValue(tenantId) ?? '', toValue(conversationId) ?? ''),
    ),
    queryFn: ({ pageParam, signal }) =>
      fetchMessages(toValue(tenantId)!, toValue(conversationId)!, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: computed(() => toValue(tenantId) !== null && toValue(conversationId) !== null),
  })
}
