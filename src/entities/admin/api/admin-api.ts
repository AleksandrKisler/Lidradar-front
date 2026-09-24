/**
 * Admin API: сеансовые запросы без организации. Все списки ограничены
 * `limit`, снимки несут время загрузки, опроса в фоне нет — обновление
 * только вручную. Команды восстановления адресуют ровно один объект.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { apiClient, unwrap, unwrapWithStatus } from '@/shared/api'
import {
  DEFAULT_ADMIN_LIMIT,
  type AIRunFilters,
  type AdminAIJob,
  type AdminAINode,
  type AdminAIRun,
  type AdminConnection,
  type AdminConversationSummary,
  type AdminDeadLetters,
  type AdminDelivery,
  type AdminJob,
  type AdminMe,
  type AdminOrganization,
  type AdminOutboxEvent,
  type AdminQueueStats,
  type AdminTrace,
  type AdminUsageReport,
  type JobFilters,
  type PlatformAdmin,
} from '../model/types'

const ADMIN = 'admin' as const

export const adminKeys = {
  me: () => [ADMIN, 'me'] as const,
  admins: () => [ADMIN, 'admins'] as const,
  organizations: () => [ADMIN, 'organizations'] as const,
  connections: () => [ADMIN, 'connections'] as const,
  queue: () => [ADMIN, 'queue'] as const,
  jobs: (filters: JobFilters) => [ADMIN, 'jobs', normalize(filters)] as const,
  deadLetters: (limit: number) => [ADMIN, 'dead-letters', limit] as const,
  aiNodes: () => [ADMIN, 'ai', 'nodes'] as const,
  aiRuns: (filters: AIRunFilters) => [ADMIN, 'ai', 'runs', normalize(filters)] as const,
  summary: (tenantId: string, conversationId: string) =>
    [ADMIN, 'ai', 'summary', tenantId, conversationId] as const,
  usage: (from: string, to: string) => [ADMIN, 'usage', from, to] as const,
  trace: (tenantId: string, messageId: string) => [ADMIN, 'trace', tenantId, messageId] as const,
}

/** Убирает пустые фильтры, чтобы одинаковые запросы делили ключ. */
function normalize<T extends object>(filters: T): Record<string, string | number> {
  const entries = Object.entries(filters).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  ) as [string, string | number][]
  entries.sort(([left], [right]) => left.localeCompare(right))
  return Object.fromEntries(entries)
}

export function fetchAdminMe(signal?: AbortSignal): Promise<AdminMe> {
  return unwrap(apiClient.GET('/api/v1/admin/me', signal ? { signal } : {}))
}

export async function fetchPlatformAdmins(signal?: AbortSignal): Promise<PlatformAdmin[]> {
  const page = await unwrap(apiClient.GET('/api/v1/admin/admins', signal ? { signal } : {}))
  return page.items
}

export interface GrantAdminResult {
  admin: PlatformAdmin
  alreadyActive: boolean
}

export async function grantPlatformAdmin(body: {
  email: string
  note?: string
}): Promise<GrantAdminResult> {
  const { data, status } = await unwrapWithStatus(apiClient.POST('/api/v1/admin/admins', { body }))
  return { admin: data, alreadyActive: status === 200 }
}

export function revokePlatformAdmin(userId: string): Promise<void> {
  return unwrap(apiClient.DELETE('/api/v1/admin/admins/{userId}', { params: { path: { userId } } }))
}

export async function fetchAdminOrganizations(signal?: AbortSignal): Promise<AdminOrganization[]> {
  const page = await unwrap(apiClient.GET('/api/v1/admin/organizations', signal ? { signal } : {}))
  return page.items
}

export async function fetchAdminConnections(signal?: AbortSignal): Promise<AdminConnection[]> {
  const page = await unwrap(apiClient.GET('/api/v1/admin/connections', signal ? { signal } : {}))
  return page.items
}

export function fetchQueueStats(signal?: AbortSignal): Promise<AdminQueueStats> {
  return unwrap(apiClient.GET('/api/v1/admin/queue', signal ? { signal } : {}))
}

export async function fetchAdminJobs(
  filters: JobFilters,
  signal?: AbortSignal,
): Promise<AdminJob[]> {
  const page = await unwrap(
    apiClient.GET('/api/v1/admin/jobs', {
      params: {
        query: {
          ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.type ? { type: filters.type } : {}),
          limit: filters.limit ?? DEFAULT_ADMIN_LIMIT,
        },
      },
      ...(signal ? { signal } : {}),
    }),
  )
  return page.items
}

export function fetchDeadLetters(limit: number, signal?: AbortSignal): Promise<AdminDeadLetters> {
  return unwrap(
    apiClient.GET('/api/v1/admin/dead-letters', {
      params: { query: { limit } },
      ...(signal ? { signal } : {}),
    }),
  )
}

export function retryJob(jobId: string): Promise<AdminJob> {
  return unwrap(apiClient.POST('/api/v1/admin/jobs/{jobId}/retry', { params: { path: { jobId } } }))
}

export function discardJob(jobId: string): Promise<AdminJob> {
  return unwrap(
    apiClient.POST('/api/v1/admin/jobs/{jobId}/discard', { params: { path: { jobId } } }),
  )
}

export function replayOutboxEvent(eventId: string): Promise<AdminOutboxEvent> {
  return unwrap(
    apiClient.POST('/api/v1/admin/outbox/{eventId}/replay', { params: { path: { eventId } } }),
  )
}

export function discardOutboxEvent(eventId: string): Promise<AdminOutboxEvent> {
  return unwrap(
    apiClient.POST('/api/v1/admin/outbox/{eventId}/discard', { params: { path: { eventId } } }),
  )
}

export function retryAIJob(jobId: string): Promise<AdminAIJob> {
  return unwrap(
    apiClient.POST('/api/v1/admin/ai/jobs/{jobId}/retry', { params: { path: { jobId } } }),
  )
}

export function discardAIJob(jobId: string): Promise<AdminAIJob> {
  return unwrap(
    apiClient.POST('/api/v1/admin/ai/jobs/{jobId}/discard', { params: { path: { jobId } } }),
  )
}

export function discardDelivery(deliveryId: string): Promise<AdminDelivery> {
  return unwrap(
    apiClient.POST('/api/v1/admin/notifications/deliveries/{deliveryId}/discard', {
      params: { path: { deliveryId } },
    }),
  )
}

export async function fetchAINodes(signal?: AbortSignal): Promise<AdminAINode[]> {
  const page = await unwrap(apiClient.GET('/api/v1/admin/ai/nodes', signal ? { signal } : {}))
  return page.items
}

export async function fetchAIRuns(
  filters: AIRunFilters,
  signal?: AbortSignal,
): Promise<AdminAIRun[]> {
  const page = await unwrap(
    apiClient.GET('/api/v1/admin/ai/runs', {
      params: {
        query: {
          ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.applicationStatus ? { applicationStatus: filters.applicationStatus } : {}),
          limit: filters.limit ?? DEFAULT_ADMIN_LIMIT,
        },
      },
      ...(signal ? { signal } : {}),
    }),
  )
  return page.items
}

export function fetchConversationSummary(
  tenantId: string,
  conversationId: string,
  signal?: AbortSignal,
): Promise<AdminConversationSummary> {
  return unwrap(
    apiClient.GET('/api/v1/admin/ai/tenants/{tenantId}/conversations/{conversationId}/summary', {
      params: { path: { tenantId, conversationId } },
      ...(signal ? { signal } : {}),
    }),
  )
}

export function fetchUsage(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<AdminUsageReport> {
  return unwrap(
    apiClient.GET('/api/v1/admin/usage', {
      params: { query: { from, to } },
      ...(signal ? { signal } : {}),
    }),
  )
}

export function fetchTrace(
  tenantId: string,
  messageId: string,
  signal?: AbortSignal,
): Promise<AdminTrace> {
  return unwrap(
    apiClient.GET('/api/v1/admin/trace/tenants/{tenantId}/messages/{messageId}', {
      params: { path: { tenantId, messageId } },
      ...(signal ? { signal } : {}),
    }),
  )
}

/** Право администратора: перечитывается редко, ошибки не повторяются автоматически. */
export function useAdminMeQuery(enabled: MaybeRefOrGetter<boolean> = true) {
  return useQuery({
    queryKey: adminKeys.me(),
    queryFn: ({ signal }) => fetchAdminMe(signal),
    enabled: computed(() => toValue(enabled)),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function usePlatformAdminsQuery() {
  return useQuery({
    queryKey: adminKeys.admins(),
    queryFn: ({ signal }) => fetchPlatformAdmins(signal),
  })
}

export function useAdminOrganizationsQuery() {
  return useQuery({
    queryKey: adminKeys.organizations(),
    queryFn: ({ signal }) => fetchAdminOrganizations(signal),
  })
}

export function useAdminConnectionsQuery() {
  return useQuery({
    queryKey: adminKeys.connections(),
    queryFn: ({ signal }) => fetchAdminConnections(signal),
  })
}

export function useQueueStatsQuery() {
  return useQuery({ queryKey: adminKeys.queue(), queryFn: ({ signal }) => fetchQueueStats(signal) })
}

export function useAdminJobsQuery(filters: MaybeRefOrGetter<JobFilters>) {
  return useQuery({
    queryKey: computed(() => adminKeys.jobs(toValue(filters))),
    queryFn: ({ signal }) => fetchAdminJobs(toValue(filters), signal),
  })
}

export function useDeadLettersQuery(limit: MaybeRefOrGetter<number>) {
  return useQuery({
    queryKey: computed(() => adminKeys.deadLetters(toValue(limit))),
    queryFn: ({ signal }) => fetchDeadLetters(toValue(limit), signal),
  })
}

export function useAINodesQuery() {
  return useQuery({ queryKey: adminKeys.aiNodes(), queryFn: ({ signal }) => fetchAINodes(signal) })
}

export function useAIRunsQuery(filters: MaybeRefOrGetter<AIRunFilters>) {
  return useQuery({
    queryKey: computed(() => adminKeys.aiRuns(toValue(filters))),
    queryFn: ({ signal }) => fetchAIRuns(toValue(filters), signal),
  })
}

export function useConversationSummaryQuery(
  params: MaybeRefOrGetter<{ tenantId: string; conversationId: string } | null>,
) {
  return useQuery({
    queryKey: computed(() => {
      const value = toValue(params)
      return adminKeys.summary(value?.tenantId ?? '', value?.conversationId ?? '')
    }),
    queryFn: ({ signal }) => {
      const value = toValue(params)!
      return fetchConversationSummary(value.tenantId, value.conversationId, signal)
    },
    enabled: computed(() => toValue(params) !== null),
    retry: false,
  })
}

export function useUsageQuery(range: MaybeRefOrGetter<{ from: string; to: string } | null>) {
  return useQuery({
    queryKey: computed(() => {
      const value = toValue(range)
      return adminKeys.usage(value?.from ?? '', value?.to ?? '')
    }),
    queryFn: ({ signal }) => {
      const value = toValue(range)!
      return fetchUsage(value.from, value.to, signal)
    },
    enabled: computed(() => toValue(range) !== null),
  })
}

export function useTraceQuery(
  params: MaybeRefOrGetter<{ tenantId: string; messageId: string } | null>,
) {
  return useQuery({
    queryKey: computed(() => {
      const value = toValue(params)
      return adminKeys.trace(value?.tenantId ?? '', value?.messageId ?? '')
    }),
    queryFn: ({ signal }) => {
      const value = toValue(params)!
      return fetchTrace(value.tenantId, value.messageId, signal)
    },
    enabled: computed(() => toValue(params) !== null),
    retry: false,
  })
}
