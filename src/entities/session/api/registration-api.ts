/**
 * Режим регистрации (ADR 0057). Запрос открыт без сессии: страница регистрации
 * узнаёт, нужен ли код приглашения. Режим не секрет, поэтому его кеш живёт
 * отдельно от данных организации и не очищается выходом.
 */
import { useQuery } from '@tanstack/vue-query'
import { apiClient, unwrap, type Schema } from '@/shared/api'

export type RegistrationInfo = Schema<'RegistrationInfo'>
export type RegistrationMode = RegistrationInfo['mode']

export const registrationKeys = {
  mode: ['auth', 'registration-mode'] as const,
}

export function fetchRegistrationMode(signal?: AbortSignal): Promise<RegistrationInfo> {
  return unwrap(apiClient.GET('/api/v1/auth/registration', signal ? { signal } : undefined))
}

/**
 * Режим меняется настройкой сервера, а не пользователем: пять минут кеша
 * достаточно. При ошибке запроса форма остаётся в безопасном виде — просит код,
 * а решение принимает сервер.
 */
export function useRegistrationModeQuery() {
  return useQuery({
    queryKey: registrationKeys.mode,
    queryFn: ({ signal }) => fetchRegistrationMode(signal),
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
