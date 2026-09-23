/**
 * Точки организации: список доступен любому активному участнику, изменения —
 * праву `location.manage`. Удаления нет: точка деактивируется через PATCH.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { apiClient, tenantScope, unwrap } from '@/shared/api'
import type {
  BusinessHoursRequest,
  CreateLocationRequest,
  Location,
  UpdateLocationRequest,
} from '../model/types'

export const locationKeys = {
  list: (tenantId: string) => [...tenantScope(tenantId), 'locations'] as const,
}

export async function fetchLocations(tenantId: string, signal?: AbortSignal): Promise<Location[]> {
  const page = await unwrap(
    apiClient.GET('/api/v1/locations', {
      params: { header: { 'X-Tenant-ID': tenantId } },
      ...(signal ? { signal } : {}),
    }),
  )
  return page.items
}

export function createLocation(tenantId: string, body: CreateLocationRequest): Promise<Location> {
  return unwrap(
    apiClient.POST('/api/v1/locations', {
      params: { header: { 'X-Tenant-ID': tenantId } },
      body,
    }),
  )
}

export function updateLocation(
  tenantId: string,
  locationId: string,
  body: UpdateLocationRequest,
): Promise<Location> {
  return unwrap(
    apiClient.PATCH('/api/v1/locations/{locationId}', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { locationId } },
      body,
    }),
  )
}

/** Атомарная замена недельного графика точки. */
export function replaceBusinessHours(
  tenantId: string,
  locationId: string,
  body: BusinessHoursRequest,
): Promise<Location> {
  return unwrap(
    apiClient.PUT('/api/v1/locations/{locationId}/business-hours', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { locationId } },
      body,
    }),
  )
}

export function useLocationsQuery(tenantId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => locationKeys.list(toValue(tenantId) ?? '')),
    queryFn: ({ signal }) => fetchLocations(toValue(tenantId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null),
    staleTime: 5 * 60_000,
  })
}
