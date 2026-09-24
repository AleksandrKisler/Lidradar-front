/**
 * Согласие на использование данных в наборах. Читает любой участник,
 * меняет владелец. Повторная выдача отвечает `200` вместо `201`, отзыв —
 * всегда `204`: обе команды идемпотентны, интерфейс сообщает, что именно
 * произошло, по коду ответа.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { apiClient, tenantScope, unwrap, unwrapWithStatus } from '@/shared/api'
import type { MLConsentStatus } from '../model/types'

export const consentKeys = {
  status: (tenantId: string) => [...tenantScope(tenantId), 'ml-consent'] as const,
}

export function fetchConsent(tenantId: string, signal?: AbortSignal): Promise<MLConsentStatus> {
  return unwrap(
    apiClient.GET('/api/v1/organization/ml-consent', {
      params: { header: { 'X-Tenant-ID': tenantId } },
      ...(signal ? { signal } : {}),
    }),
  )
}

export interface GrantResult {
  status: MLConsentStatus
  /** `true`, если согласие уже действовало и сервер ответил `200`. */
  alreadyActive: boolean
}

export async function grantConsent(tenantId: string): Promise<GrantResult> {
  const { data, status } = await unwrapWithStatus(
    apiClient.POST('/api/v1/organization/ml-consent', {
      params: { header: { 'X-Tenant-ID': tenantId } },
    }),
  )
  return { status: data, alreadyActive: status === 200 }
}

export function revokeConsent(tenantId: string): Promise<void> {
  return unwrap(
    apiClient.DELETE('/api/v1/organization/ml-consent', {
      params: { header: { 'X-Tenant-ID': tenantId } },
    }),
  )
}

export function useConsentQuery(tenantId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => consentKeys.status(toValue(tenantId) ?? '')),
    queryFn: ({ signal }) => fetchConsent(toValue(tenantId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null),
  })
}
