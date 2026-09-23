/**
 * Запросы Radar: сводка и активная лента рисков.
 *
 * Ключи запросов включают организацию и нормализованные фильтры, поэтому
 * смена организации или фильтра никогда не подменяет чужие данные, а
 * инвалидация по префиксу `['tenant', id, 'risks']` затрагивает все страницы.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useInfiniteQuery, useQuery } from '@tanstack/vue-query'
import { apiClient, normalizeFilters, tenantScope, unwrap } from '@/shared/api'
import type { RadarSummary, RiskDetail, RiskFilters, RiskSeverity, RiskType } from '../model/types'

/** Размер страницы ленты: достаточно для первого экрана, немного для сети. */
export const RISK_PAGE_SIZE = 20

export interface RiskPage {
  items: RiskDetail[]
  nextCursor: string | null
}

export const riskKeys = {
  summary: (tenantId: string, filters: RiskFilters) =>
    [...tenantScope(tenantId), 'radar', normalizeFilters(filters)] as const,
  activeFeed: (tenantId: string, filters: RiskFilters) =>
    [...tenantScope(tenantId), 'risks', { ...normalizeFilters(filters), active: true }] as const,
  /** Карточка риска; префикс `risk` отличается от лент `risks`, чтобы инвалидация была точечной. */
  detail: (tenantId: string, riskId: string) => [...tenantScope(tenantId), 'risk', riskId] as const,
}

/** Параметры запроса из контракта, общие для сводки и ленты. */
type RiskQuery = {
  locationId?: string
  severity?: RiskSeverity
  riskType?: RiskType
}

/** Переносит в запрос только заданные фильтры: пустые значения не отправляются. */
function toQuery(filters: RiskFilters): RiskQuery {
  const query: RiskQuery = {}
  if (filters.locationId) query.locationId = filters.locationId
  if (filters.severity) query.severity = filters.severity
  if (filters.riskType) query.riskType = filters.riskType
  return query
}

/**
 * Сводка организации. Статус в сводку не передаётся: сервер сам считает
 * счётчики и потенциал по активным рискам, а возвращённую выручку — по всем
 * рискам фильтра, иначе деньги пропадали бы после закрытия риска.
 */
export function fetchRadarSummary(
  tenantId: string,
  filters: RiskFilters,
  signal?: AbortSignal,
): Promise<RadarSummary> {
  return unwrap(
    apiClient.GET('/api/v1/radar', {
      params: { header: { 'X-Tenant-ID': tenantId }, query: toQuery(filters) },
      ...(signal ? { signal } : {}),
    }),
  )
}

/** Страница активных рисков в серверном порядке приоритета. */
export function fetchActiveRisks(
  tenantId: string,
  filters: RiskFilters,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<RiskPage> {
  return unwrap(
    apiClient.GET('/api/v1/risks', {
      params: {
        header: { 'X-Tenant-ID': tenantId },
        query: {
          ...toQuery(filters),
          active: true,
          limit: RISK_PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
        },
      },
      ...(signal ? { signal } : {}),
    }),
  )
}

export function useRadarSummaryQuery(
  tenantId: MaybeRefOrGetter<string | null>,
  filters: MaybeRefOrGetter<RiskFilters>,
) {
  return useQuery({
    queryKey: computed(() => riskKeys.summary(toValue(tenantId) ?? '', toValue(filters))),
    queryFn: ({ signal }) => fetchRadarSummary(toValue(tenantId)!, toValue(filters), signal),
    enabled: computed(() => toValue(tenantId) !== null),
  })
}

export function useActiveRisksQuery(
  tenantId: MaybeRefOrGetter<string | null>,
  filters: MaybeRefOrGetter<RiskFilters>,
) {
  return useInfiniteQuery({
    queryKey: computed(() => riskKeys.activeFeed(toValue(tenantId) ?? '', toValue(filters))),
    queryFn: ({ pageParam, signal }) =>
      fetchActiveRisks(toValue(tenantId)!, toValue(filters), pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: computed(() => toValue(tenantId) !== null),
  })
}

/** Полная карточка риска для рабочего пространства. */
export function fetchRiskDetail(
  tenantId: string,
  riskId: string,
  signal?: AbortSignal,
): Promise<RiskDetail> {
  return unwrap(
    apiClient.GET('/api/v1/risks/{riskId}', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { riskId } },
      ...(signal ? { signal } : {}),
    }),
  )
}

export function useRiskDetailQuery(
  tenantId: MaybeRefOrGetter<string | null>,
  riskId: MaybeRefOrGetter<string | null>,
) {
  return useQuery({
    queryKey: computed(() => riskKeys.detail(toValue(tenantId) ?? '', toValue(riskId) ?? '')),
    queryFn: ({ signal }) => fetchRiskDetail(toValue(tenantId)!, toValue(riskId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null && toValue(riskId) !== null),
  })
}
