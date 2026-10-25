/**
 * Запросы песочницы стейджа (ADR 0066). Ключи начинаются с организации; переписки, которые ещё обрабатываются,
 * перечитываются раз в 3 секунды, ожидающие срока проверки — раз в 15 секунд. Остальные — по действию пользователя. Команды идут с ключом
 * идемпотентности: повтор той же отправки досылает недоставленные сообщения без дублей.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery, type QueryClient } from '@tanstack/vue-query'
import { apiClient, tenantScope, unwrap, unwrapWithStatus } from '@/shared/api'
import {
  SANDBOX_POLL_INTERVAL_MS,
  type SandboxConversation,
  type SandboxCreateRequest,
  type SandboxOverview,
  type SandboxSendRequest,
  type SandboxTemplate,
} from '../model/types'

export const sandboxKeys = {
  all: (tenantId: string) => [...tenantScope(tenantId), 'sandbox'] as const,
  overview: (tenantId: string) => [...tenantScope(tenantId), 'sandbox', 'overview'] as const,
  templates: (tenantId: string) => [...tenantScope(tenantId), 'sandbox', 'templates'] as const,
  conversations: (tenantId: string) =>
    [...tenantScope(tenantId), 'sandbox', 'conversations'] as const,
  conversation: (tenantId: string, conversationId: string) =>
    [...tenantScope(tenantId), 'sandbox', 'conversations', conversationId] as const,
}

const header = (tenantId: string) => ({ 'X-Tenant-ID': tenantId })

export function fetchSandboxOverview(
  tenantId: string,
  signal?: AbortSignal,
): Promise<SandboxOverview> {
  return unwrap(
    apiClient.GET('/api/v1/sandbox', {
      params: { header: header(tenantId) },
      ...(signal ? { signal } : {}),
    }),
  )
}

export async function fetchSandboxTemplates(
  tenantId: string,
  signal?: AbortSignal,
): Promise<SandboxTemplate[]> {
  const body = await unwrap(
    apiClient.GET('/api/v1/sandbox/templates', {
      params: { header: header(tenantId) },
      ...(signal ? { signal } : {}),
    }),
  )
  return body.items
}

export async function fetchSandboxConversations(
  tenantId: string,
  signal?: AbortSignal,
): Promise<SandboxConversation[]> {
  const body = await unwrap(
    apiClient.GET('/api/v1/sandbox/conversations', {
      params: { header: header(tenantId) },
      ...(signal ? { signal } : {}),
    }),
  )
  return body.items
}

export function fetchSandboxConversation(
  tenantId: string,
  conversationId: string,
  signal?: AbortSignal,
): Promise<SandboxConversation> {
  return unwrap(
    apiClient.GET('/api/v1/sandbox/conversations/{conversationId}', {
      params: { header: header(tenantId), path: { conversationId } },
      ...(signal ? { signal } : {}),
    }),
  )
}

/** Сборка переписки; `created=false` — точный повтор прежней команды. */
export async function createSandboxConversation(
  tenantId: string,
  key: string,
  body: SandboxCreateRequest,
): Promise<{ conversation: SandboxConversation; created: boolean }> {
  const { data, status } = await unwrapWithStatus(
    apiClient.POST('/api/v1/sandbox/conversations', {
      params: { header: { ...header(tenantId), 'Idempotency-Key': key } },
      body,
    }),
  )
  return { conversation: data, created: status === 201 }
}

/** Сообщение после сборки; ответ — вся переписка со сверкой. */
export async function sendSandboxMessage(
  tenantId: string,
  conversationId: string,
  key: string,
  body: SandboxSendRequest,
): Promise<{ conversation: SandboxConversation; created: boolean }> {
  const { data, status } = await unwrapWithStatus(
    apiClient.POST('/api/v1/sandbox/conversations/{conversationId}/messages', {
      params: { header: { ...header(tenantId), 'Idempotency-Key': key }, path: { conversationId } },
      body,
    }),
  )
  return { conversation: data, created: status === 201 }
}

/** PENDING меняется после срока проверки без действия пользователя; опрашиваем его реже обработки. */
export const SANDBOX_PENDING_POLL_INTERVAL_MS = 15_000

/** Интервал опроса: обработка каждые 3 секунды, запланированный риск каждые 15. */
export function pollInterval(
  conversations: readonly SandboxConversation[] | undefined,
): number | false {
  if (conversations?.some((item) => item.status.state === 'PROCESSING'))
    return SANDBOX_POLL_INTERVAL_MS
  if (conversations?.some((item) => item.status.state === 'PENDING'))
    return SANDBOX_PENDING_POLL_INTERVAL_MS
  return false
}

/** Кладёт свежий ответ команды в кеш переписки и обновляет список. */
export async function storeSandboxConversation(
  queryClient: QueryClient,
  tenantId: string,
  conversation: SandboxConversation,
): Promise<void> {
  queryClient.setQueryData(sandboxKeys.conversation(tenantId, conversation.id), conversation)
  await queryClient.invalidateQueries({ queryKey: sandboxKeys.conversations(tenantId) })
  await queryClient.invalidateQueries({ queryKey: sandboxKeys.overview(tenantId) })
}

export function useSandboxOverviewQuery(tenantId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => sandboxKeys.overview(toValue(tenantId) ?? '')),
    queryFn: ({ signal }) => fetchSandboxOverview(toValue(tenantId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null),
  })
}

export function useSandboxTemplatesQuery(tenantId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => sandboxKeys.templates(toValue(tenantId) ?? '')),
    queryFn: ({ signal }) => fetchSandboxTemplates(toValue(tenantId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null),
    staleTime: Infinity,
  })
}

export function useSandboxConversationsQuery(tenantId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => sandboxKeys.conversations(toValue(tenantId) ?? '')),
    queryFn: ({ signal }) => fetchSandboxConversations(toValue(tenantId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null),
    refetchInterval: (query) => pollInterval(query.state.data),
  })
}

export function useSandboxConversationQuery(
  tenantId: MaybeRefOrGetter<string | null>,
  conversationId: MaybeRefOrGetter<string | null>,
) {
  return useQuery({
    queryKey: computed(() =>
      sandboxKeys.conversation(toValue(tenantId) ?? '', toValue(conversationId) ?? ''),
    ),
    queryFn: ({ signal }) =>
      fetchSandboxConversation(toValue(tenantId)!, toValue(conversationId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null && toValue(conversationId) !== null),
    refetchInterval: (query) => (query.state.data ? pollInterval([query.state.data]) : false),
  })
}
