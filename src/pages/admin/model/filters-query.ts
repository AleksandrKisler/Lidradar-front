/**
 * Фильтры admin-списков живут в query-строке. Значения из адреса не
 * доверенные: статусы сверяются с перечислениями, идентификаторы — с форматом
 * UUID, лимит — со списком допустимых.
 */
import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import {
  ADMIN_LIMITS,
  AI_APPLICATION_STATUSES,
  AI_RUN_STATUSES,
  DEFAULT_ADMIN_LIMIT,
  JOB_STATUSES,
  isUuid,
  type AIApplicationStatus,
  type AIRunFilters,
  type AIRunStatus,
  type JobFilters,
  type JobStatus,
} from '@/entities/admin'

function single(value: LocationQuery[string] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' && first !== '' ? first : null
}

export function parseLimit(query: LocationQuery): number {
  const raw = Number(single(query.limit))
  return (ADMIN_LIMITS as readonly number[]).includes(raw) ? raw : DEFAULT_ADMIN_LIMIT
}

export function parseJobFilters(query: LocationQuery): JobFilters {
  const filters: JobFilters = { limit: parseLimit(query) }
  const tenantId = single(query.tenantId)
  if (tenantId && isUuid(tenantId)) filters.tenantId = tenantId
  const status = single(query.status)
  if (status && (JOB_STATUSES as readonly string[]).includes(status)) {
    filters.status = status as JobStatus
  }
  const type = single(query.type)
  if (type && /^[A-Za-z0-9_.:-]{1,64}$/.test(type)) filters.type = type
  return filters
}

export function parseRunFilters(query: LocationQuery): AIRunFilters {
  const filters: AIRunFilters = { limit: parseLimit(query) }
  const tenantId = single(query.tenantId)
  if (tenantId && isUuid(tenantId)) filters.tenantId = tenantId
  const status = single(query.status)
  if (status && (AI_RUN_STATUSES as readonly string[]).includes(status)) {
    filters.status = status as AIRunStatus
  }
  const application = single(query.applicationStatus)
  if (application && (AI_APPLICATION_STATUSES as readonly string[]).includes(application)) {
    filters.applicationStatus = application as AIApplicationStatus
  }
  return filters
}

export function filtersToQuery(filters: object): LocationQueryRaw {
  const query: LocationQueryRaw = {}
  for (const [key, value] of Object.entries(filters as Record<string, unknown>)) {
    if (typeof value !== 'string' && typeof value !== 'number') continue
    if (value === undefined || value === '' || (key === 'limit' && value === DEFAULT_ADMIN_LIMIT)) {
      continue
    }
    query[key] = String(value)
  }
  return query
}

/** Пара идентификаторов для точечных запросов (трасса, резюме переписки). */
export function parseIdPair(
  query: LocationQuery,
  first: string,
  second: string,
): { [key: string]: string } | null {
  const a = single(query[first])
  const b = single(query[second])
  if (!a || !b || !isUuid(a) || !isUuid(b)) return null
  return { [first]: a, [second]: b }
}
