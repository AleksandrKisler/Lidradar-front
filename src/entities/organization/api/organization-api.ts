/**
 * Запросы организации. Чтение выполняется в контексте выбранной организации;
 * создание — сеансом без организации (новая граница ещё не существует).
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { apiClient, tenantScope, unwrap } from '@/shared/api'
import type {
  CreateOrganizationRequest,
  OnboardingStatus,
  Organization,
  UpdateOrganizationRequest,
} from '../model/types'

/** Ключи запросов организации. */
export const organizationKeys = {
  detail: (tenantId: string) => [...tenantScope(tenantId), 'organization'] as const,
  onboarding: (tenantId: string) => [...tenantScope(tenantId), 'onboarding'] as const,
}

export function fetchOrganization(tenantId: string, signal?: AbortSignal): Promise<Organization> {
  return unwrap(
    apiClient.GET('/api/v1/organization', {
      params: { header: { 'X-Tenant-ID': tenantId } },
      ...(signal ? { signal } : {}),
    }),
  )
}

export function createOrganization(body: CreateOrganizationRequest): Promise<Organization> {
  return unwrap(apiClient.POST('/api/v1/organizations', { body }))
}

/**
 * Организация выбранного рабочего пространства: часовой пояс и валюта нужны
 * почти каждому экрану, поэтому запрос кешируется надолго.
 */
export function useOrganizationQuery(tenantId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => organizationKeys.detail(toValue(tenantId) ?? '')),
    queryFn: ({ signal }) => fetchOrganization(toValue(tenantId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null),
    staleTime: 5 * 60_000,
  })
}

/** Частичное обновление организации: отправляются только изменённые поля. */
export function updateOrganization(
  tenantId: string,
  body: UpdateOrganizationRequest,
): Promise<Organization> {
  return unwrap(
    apiClient.PATCH('/api/v1/organization', {
      params: { header: { 'X-Tenant-ID': tenantId } },
      body,
    }),
  )
}

export function fetchOnboardingStatus(
  tenantId: string,
  signal?: AbortSignal,
): Promise<OnboardingStatus> {
  return unwrap(
    apiClient.GET('/api/v1/organization/onboarding', {
      params: { header: { 'X-Tenant-ID': tenantId } },
      ...(signal ? { signal } : {}),
    }),
  )
}

/** Авторитетный статус начала работы; перечитывается после каждого шага настройки. */
export function useOnboardingQuery(tenantId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => organizationKeys.onboarding(toValue(tenantId) ?? '')),
    queryFn: ({ signal }) => fetchOnboardingStatus(toValue(tenantId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null),
  })
}
