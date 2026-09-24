/**
 * Каталог услуг: чтение и изменение доступны праву `service.manage`
 * (владелец). Список включает отключённые услуги; фильтр строит интерфейс.
 * Удаления нет: `DELETE` переводит услугу в `active=false`.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { apiClient, tenantScope, unwrap } from '@/shared/api'
import type {
  CreateServiceCatalogItemRequest,
  ServiceCatalogItem,
  UpdateServiceCatalogItemRequest,
} from '../model/types'

export const serviceKeys = {
  list: (tenantId: string) => [...tenantScope(tenantId), 'services'] as const,
}

export async function fetchServices(
  tenantId: string,
  signal?: AbortSignal,
): Promise<ServiceCatalogItem[]> {
  const page = await unwrap(
    apiClient.GET('/api/v1/services', {
      params: { header: { 'X-Tenant-ID': tenantId } },
      ...(signal ? { signal } : {}),
    }),
  )
  return page.items
}

export function createService(
  tenantId: string,
  body: CreateServiceCatalogItemRequest,
): Promise<ServiceCatalogItem> {
  return unwrap(
    apiClient.POST('/api/v1/services', {
      params: { header: { 'X-Tenant-ID': tenantId } },
      body,
    }),
  )
}

export function updateService(
  tenantId: string,
  serviceId: string,
  body: UpdateServiceCatalogItemRequest,
): Promise<ServiceCatalogItem> {
  return unwrap(
    apiClient.PATCH('/api/v1/services/{serviceId}', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { serviceId } },
      body,
    }),
  )
}

/** Мягкое удаление: услуга исчезает из новых сопоставлений, история остаётся. */
export function deactivateService(tenantId: string, serviceId: string): Promise<void> {
  return unwrap(
    apiClient.DELETE('/api/v1/services/{serviceId}', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { serviceId } },
    }),
  )
}

export function useServicesQuery(tenantId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => serviceKeys.list(toValue(tenantId) ?? '')),
    queryFn: ({ signal }) => fetchServices(toValue(tenantId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null),
  })
}
