/**
 * Режим регистрации (ADR 0057) и предварительная проверка кода приглашения (ADR 0067).
 * Оба запроса открыты без сессии и без `X-Tenant-ID`. Режим не секрет, но решает, открыта ли
 * общая форма, поэтому каждый вход на обычную регистрацию получает свежий ответ сервера.
 * Код приглашения — секрет: он уходит только в теле POST и не попадает в кеш запросов или ключи.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import {
  ApiError,
  CLIENT_ERROR_CODES,
  apiClient,
  unwrap,
  unwrapWithStatus,
  type Schema,
} from '@/shared/api'

export type RegistrationInfo = Schema<'RegistrationInfo'>
export type RegistrationMode = RegistrationInfo['mode']

export const registrationKeys = {
  mode: ['auth', 'registration-mode'] as const,
}

export function fetchRegistrationMode(signal?: AbortSignal): Promise<RegistrationInfo> {
  return unwrap(apiClient.GET('/api/v1/auth/registration', signal ? { signal } : undefined))
}

/**
 * Пригодность кода сейчас: только `204` без тела; ничего не создаёт и не расходует. Любой другой
 * успешный статус — непредусмотренный ответ и не считается подтверждением. Ошибки приходят как
 * `ApiError` (`403 INVITATION_INVALID`, `429`, сеть…); отмена вызывающей стороной — `AbortError`.
 * Результат не кешируется: каждая проверка — отдельная команда.
 */
export async function checkRegistrationInvitation(
  code: string,
  signal?: AbortSignal,
): Promise<void> {
  const { status } = await unwrapWithStatus(
    apiClient.POST('/api/v1/auth/registration/invitation/check', {
      body: { code },
      ...(signal ? { signal } : {}),
    }),
  )
  if (status !== 204) {
    throw new ApiError({
      httpStatus: status,
      code: CLIENT_ERROR_CODES.malformed,
      message: `HTTP ${status}`,
    })
  }
}

/**
 * Режим меняется настройкой сервера. Прежний ответ не открывает общую регистрацию: при каждом
 * монтировании запрос выполняется заново (`staleTime: 0`, `refetchOnMount: 'always'`), без
 * автоматических повторов и перечитывания при возврате на вкладку — повтор выполняет пользователь.
 * `enabled` позволяет не запрашивать режим там, где он не нужен (регистрация по приглашению).
 */
export function useRegistrationModeQuery(options: { enabled?: MaybeRefOrGetter<boolean> } = {}) {
  return useQuery({
    queryKey: registrationKeys.mode,
    queryFn: ({ signal }) => fetchRegistrationMode(signal),
    enabled: computed(() => toValue(options.enabled ?? true)),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    retry: false,
  })
}
