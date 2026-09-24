/**
 * Сводка, оплаты и точность за окно. Ключи содержат фактически отправленные
 * границы: смена окна — новый ключ; команды по риску инвалидируют префиксы
 * `analytics` и `precision` (см. `invalidateRisk`).
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useInfiniteQuery, useQuery } from '@tanstack/vue-query'
import { apiClient, tenantScope, unwrap } from '@/shared/api'
import {
  PAYMENTS_PAGE_SIZE,
  type AnalyticsSummary,
  type DateRange,
  type InstantRange,
  type PaymentPage,
  type RiskPrecisionReport,
} from '../model/types'

export const analyticsKeys = {
  summary: (tenantId: string, range: DateRange) =>
    [...tenantScope(tenantId), 'analytics', 'summary', range.from, range.to] as const,
  payments: (tenantId: string, range: DateRange) =>
    [...tenantScope(tenantId), 'analytics', 'payments', range.from, range.to] as const,
  precision: (tenantId: string, range: InstantRange) =>
    [...tenantScope(tenantId), 'precision', range.from, range.to] as const,
}

export function fetchAnalyticsSummary(
  tenantId: string,
  range: DateRange,
  signal?: AbortSignal,
): Promise<AnalyticsSummary> {
  return unwrap(
    apiClient.GET('/api/v1/analytics/summary', {
      params: { header: { 'X-Tenant-ID': tenantId }, query: { from: range.from, to: range.to } },
      ...(signal ? { signal } : {}),
    }),
  )
}

export function fetchPayments(
  tenantId: string,
  range: DateRange,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<PaymentPage> {
  return unwrap(
    apiClient.GET('/api/v1/analytics/payments', {
      params: {
        header: { 'X-Tenant-ID': tenantId },
        query: {
          from: range.from,
          to: range.to,
          limit: PAYMENTS_PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
        },
      },
      ...(signal ? { signal } : {}),
    }),
  )
}

export function fetchPrecision(
  tenantId: string,
  range: InstantRange,
  signal?: AbortSignal,
): Promise<RiskPrecisionReport> {
  return unwrap(
    apiClient.GET('/api/v1/risks/precision', {
      params: { header: { 'X-Tenant-ID': tenantId }, query: { from: range.from, to: range.to } },
      ...(signal ? { signal } : {}),
    }),
  )
}

const EMPTY_RANGE: DateRange = { from: '', to: '' }

export function useAnalyticsSummaryQuery(
  tenantId: MaybeRefOrGetter<string | null>,
  range: MaybeRefOrGetter<DateRange | null>,
) {
  return useQuery({
    queryKey: computed(() =>
      analyticsKeys.summary(toValue(tenantId) ?? '', toValue(range) ?? EMPTY_RANGE),
    ),
    queryFn: ({ signal }) => fetchAnalyticsSummary(toValue(tenantId)!, toValue(range)!, signal),
    enabled: computed(() => toValue(tenantId) !== null && toValue(range) !== null),
  })
}

export function usePrecisionQuery(
  tenantId: MaybeRefOrGetter<string | null>,
  range: MaybeRefOrGetter<InstantRange | null>,
) {
  return useQuery({
    queryKey: computed(() =>
      analyticsKeys.precision(toValue(tenantId) ?? '', toValue(range) ?? EMPTY_RANGE),
    ),
    queryFn: ({ signal }) => fetchPrecision(toValue(tenantId)!, toValue(range)!, signal),
    enabled: computed(() => toValue(tenantId) !== null && toValue(range) !== null),
  })
}

export function usePaymentsQuery(
  tenantId: MaybeRefOrGetter<string | null>,
  range: MaybeRefOrGetter<DateRange | null>,
) {
  return useInfiniteQuery({
    queryKey: computed(() =>
      analyticsKeys.payments(toValue(tenantId) ?? '', toValue(range) ?? EMPTY_RANGE),
    ),
    queryFn: ({ pageParam, signal }) =>
      fetchPayments(toValue(tenantId)!, toValue(range)!, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: computed(() => toValue(tenantId) !== null && toValue(range) !== null),
  })
}
