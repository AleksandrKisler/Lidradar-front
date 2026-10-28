/**
 * Фильтры Radar живут в query-строке маршрута: перезагрузка и ссылка
 * сохраняют выбор. Значения из адресной строки не доверенные, поэтому
 * сверяются со списками перечислений; неизвестные отбрасываются.
 */
import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import {
  RISK_FEED_STATUSES,
  RISK_SEVERITIES,
  RISK_TYPES,
  type RiskFeedStatus,
  type RiskFilters,
  type RiskSeverity,
  type RiskType,
} from '@/entities/risk'

function single(value: LocationQuery[string] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' && first !== '' ? first : null
}

export function parseRiskFilters(query: LocationQuery): RiskFilters {
  const filters: RiskFilters = {}
  const severity = single(query.severity)
  if (severity && (RISK_SEVERITIES as readonly string[]).includes(severity)) {
    filters.severity = severity as RiskSeverity
  }
  const riskType = single(query.riskType)
  if (riskType && (RISK_TYPES as readonly string[]).includes(riskType)) {
    filters.riskType = riskType as RiskType
  }
  const locationId = single(query.locationId)
  if (locationId && /^[0-9a-f-]{36}$/i.test(locationId)) filters.locationId = locationId
  return filters
}

/** Вкладка статуса: OPEN и «В работе» (ACKNOWLEDGED в URL); прочее — общая активная лента. */
export function parseRiskFeedStatus(query: LocationQuery): RiskFeedStatus | null {
  const status = single(query.status)
  return status && (RISK_FEED_STATUSES as readonly string[]).includes(status)
    ? (status as RiskFeedStatus)
    : null
}

export function riskFiltersToQuery(
  filters: RiskFilters,
  status: RiskFeedStatus | null = null,
): LocationQueryRaw {
  const query: LocationQueryRaw = {}
  if (status) query.status = status
  if (filters.severity) query.severity = filters.severity
  if (filters.riskType) query.riskType = filters.riskType
  if (filters.locationId) query.locationId = filters.locationId
  return query
}
