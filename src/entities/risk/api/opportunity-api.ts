/**
 * Коммерческая возможность: полная неизменяемая история этапов и ручной
 * перевод. Ключ лежит под префиксом `opportunity`, который инвалидируют
 * исходы, вердикты и сам перевод (`invalidateRisk` с `opportunity: true`).
 * Перевод не оптимистичен: интерфейс показывает только ответ сервера.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { apiClient, tenantScope, unwrap } from '@/shared/api'
import type { Opportunity, OpportunityDetail, OpportunityStage } from '../model/types'

export const opportunityKeys = {
  detail: (tenantId: string, opportunityId: string) =>
    [...tenantScope(tenantId), 'opportunity', opportunityId] as const,
}

export function fetchOpportunityDetail(
  tenantId: string,
  opportunityId: string,
  signal?: AbortSignal,
): Promise<OpportunityDetail> {
  return unwrap(
    apiClient.GET('/api/v1/opportunities/{opportunityId}', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { opportunityId } },
      ...(signal ? { signal } : {}),
    }),
  )
}

export function changeOpportunityStage(
  tenantId: string,
  opportunityId: string,
  stage: OpportunityStage,
): Promise<Opportunity> {
  return unwrap(
    apiClient.PATCH('/api/v1/opportunities/{opportunityId}', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { opportunityId } },
      body: { stage },
    }),
  )
}

export function useOpportunityDetailQuery(
  tenantId: MaybeRefOrGetter<string | null>,
  opportunityId: MaybeRefOrGetter<string | null>,
) {
  return useQuery({
    queryKey: computed(() =>
      opportunityKeys.detail(toValue(tenantId) ?? '', toValue(opportunityId) ?? ''),
    ),
    queryFn: ({ signal }) =>
      fetchOpportunityDetail(toValue(tenantId)!, toValue(opportunityId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null && toValue(opportunityId) !== null),
  })
}
