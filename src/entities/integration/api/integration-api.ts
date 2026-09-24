/**
 * Подключения источников: чтение и команды доступны праву
 * `integration.manage` (владелец). Секреты уходят один раз в write-only
 * полях и никогда не возвращаются, кроме секрета webhook, который сервер
 * выпускает сам и отдаёт в ответе на подключение единственный раз.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { apiClient, tenantScope, unwrap } from '@/shared/api'
import type {
  ChannelConnection,
  ConnectChannelRequest,
  ConnectedChannel,
  ConnectionHealth,
  ConnectorProvider,
  HealthCheck,
} from '../model/types'

export const integrationKeys = {
  list: (tenantId: string) => [...tenantScope(tenantId), 'integrations'] as const,
  health: (tenantId: string, connectionId: string) =>
    [...tenantScope(tenantId), 'integrations', connectionId, 'health'] as const,
}

export async function fetchConnections(
  tenantId: string,
  signal?: AbortSignal,
): Promise<ChannelConnection[]> {
  const page = await unwrap(
    apiClient.GET('/api/v1/integrations', {
      params: { header: { 'X-Tenant-ID': tenantId } },
      ...(signal ? { signal } : {}),
    }),
  )
  return page.items
}

export function connectChannel(
  tenantId: string,
  provider: ConnectorProvider,
  body: ConnectChannelRequest,
): Promise<ConnectedChannel> {
  return unwrap(
    apiClient.POST('/api/v1/integrations/{provider}/connect', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { provider } },
      body,
    }),
  )
}

/** Мягкое отключение: локальный статус меняется всегда, удаление вебхука у провайдера — по возможности. */
export function disconnectChannel(tenantId: string, connectionId: string): Promise<void> {
  return unwrap(
    apiClient.DELETE('/api/v1/integrations/{connectionId}', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { connectionId } },
    }),
  )
}

/** Сохранённое состояние подключения; `checkedAt` — момент чтения снимка. */
export function fetchConnectionHealth(
  tenantId: string,
  connectionId: string,
  signal?: AbortSignal,
): Promise<ConnectionHealth> {
  return unwrap(
    apiClient.GET('/api/v1/integrations/{connectionId}/health', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { connectionId } },
      ...(signal ? { signal } : {}),
    }),
  )
}

/** Живая проверка: `REMOTE` — провайдер опрошен, `LOCAL` — показан сохранённый статус. */
export function checkConnectionHealth(
  tenantId: string,
  connectionId: string,
): Promise<HealthCheck> {
  return unwrap(
    apiClient.POST('/api/v1/integrations/{connectionId}/health/check', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { connectionId } },
    }),
  )
}

export function useConnectionsQuery(tenantId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => integrationKeys.list(toValue(tenantId) ?? '')),
    queryFn: ({ signal }) => fetchConnections(toValue(tenantId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null),
  })
}

export function useConnectionHealthQuery(
  tenantId: MaybeRefOrGetter<string | null>,
  connectionId: MaybeRefOrGetter<string | null>,
) {
  return useQuery({
    queryKey: computed(() =>
      integrationKeys.health(toValue(tenantId) ?? '', toValue(connectionId) ?? ''),
    ),
    queryFn: ({ signal }) =>
      fetchConnectionHealth(toValue(tenantId)!, toValue(connectionId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null && toValue(connectionId) !== null),
  })
}
