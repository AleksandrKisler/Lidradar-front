/**
 * Личная привязка Telegram и настройки уведомлений текущего пользователя в
 * организации. Одноразовая ссылка привязки живёт 15 минут и нигде не
 * сохраняется; настройки всегда приходят полным набором из пяти строк.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { apiClient, tenantScope, unwrap } from '@/shared/api'
import type {
  NotificationPreference,
  NotificationPreferenceRequest,
  TelegramLinkStatus,
  TelegramLinkToken,
} from '../model/types'

type RiskType = NotificationPreference['riskType']

export const notificationKeys = {
  link: (tenantId: string) => [...tenantScope(tenantId), 'telegram-link'] as const,
  preferences: (tenantId: string) =>
    [...tenantScope(tenantId), 'notification-preferences'] as const,
}

export function issueTelegramLinkToken(tenantId: string): Promise<TelegramLinkToken> {
  return unwrap(
    apiClient.POST('/api/v1/notifications/telegram-link-token', {
      params: { header: { 'X-Tenant-ID': tenantId } },
    }),
  )
}

export function fetchTelegramLinkStatus(
  tenantId: string,
  signal?: AbortSignal,
): Promise<TelegramLinkStatus> {
  return unwrap(
    apiClient.GET('/api/v1/notifications/telegram-link', {
      params: { header: { 'X-Tenant-ID': tenantId } },
      ...(signal ? { signal } : {}),
    }),
  )
}

export function disableTelegramLink(tenantId: string): Promise<void> {
  return unwrap(
    apiClient.DELETE('/api/v1/notifications/telegram-link', {
      params: { header: { 'X-Tenant-ID': tenantId } },
    }),
  )
}

export async function fetchPreferences(
  tenantId: string,
  signal?: AbortSignal,
): Promise<NotificationPreference[]> {
  const page = await unwrap(
    apiClient.GET('/api/v1/notifications/preferences', {
      params: { header: { 'X-Tenant-ID': tenantId } },
      ...(signal ? { signal } : {}),
    }),
  )
  return page.items
}

/** Полная замена настройки одного типа риска. */
export function putPreference(
  tenantId: string,
  riskType: RiskType,
  body: NotificationPreferenceRequest,
): Promise<NotificationPreference> {
  return unwrap(
    apiClient.PUT('/api/v1/notifications/preferences/{riskType}', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { riskType } },
      body,
    }),
  )
}

/** Возврат типа риска к настройке по умолчанию. */
export function resetPreference(tenantId: string, riskType: RiskType): Promise<void> {
  return unwrap(
    apiClient.DELETE('/api/v1/notifications/preferences/{riskType}', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { riskType } },
    }),
  )
}

export function useTelegramLinkQuery(tenantId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => notificationKeys.link(toValue(tenantId) ?? '')),
    queryFn: ({ signal }) => fetchTelegramLinkStatus(toValue(tenantId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null),
  })
}

export function usePreferencesQuery(tenantId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => notificationKeys.preferences(toValue(tenantId) ?? '')),
    queryFn: ({ signal }) => fetchPreferences(toValue(tenantId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null),
  })
}
