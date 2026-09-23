/**
 * Соглашения для TanStack Query.
 *
 * Ключи tenant-scoped запросов всегда начинаются с `['tenant', tenantId]`:
 * так смена организации отменяет и удаляет все её данные одним вызовом, а
 * ключи разных организаций никогда не пересекаются.
 */
import { isApiError } from './api-error'

/** Префикс ключа данных организации. */
export function tenantScope(tenantId: string): readonly ['tenant', string] {
  return ['tenant', tenantId] as const
}

/**
 * Приводит фильтры к детерминированному виду: ключи сортируются, а
 * `undefined`, `null`, пустые строки и пустые массивы отбрасываются. Одинаковый
 * набор фильтров даёт одинаковый ключ запроса независимо от порядка полей.
 */
export function normalizeFilters<T extends object>(filters: T): Partial<T> {
  const entries = Object.entries(filters as Record<string, unknown>)
    .filter(([, value]) => {
      if (value === undefined || value === null || value === '') return false
      return !(Array.isArray(value) && value.length === 0)
    })
    .map(([key, value]) => [key, Array.isArray(value) ? [...value].sort() : value] as const)
    .sort(([left], [right]) => left.localeCompare(right))
  return Object.fromEntries(entries) as Partial<T>
}

/**
 * Политика повторов чтения: не более двух дополнительных попыток и только
 * при сетевом сбое или ошибке сервера. `4xx` и отмена не повторяются.
 */
export function shouldRetryRead(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false
  return isApiError(error) && error.isRetryable
}
