/**
 * Запросы аутентификации. Сессия живёт в HttpOnly cookie, которую браузер
 * отправляет сам; JavaScript её не видит и не хранит.
 */
import { apiClient, unwrap, type Schema } from '@/shared/api'
import type { AuthMeResponse } from '../model/types'

export type LoginRequest = Schema<'LoginRequest'>
export type RegisterRequest = Schema<'RegisterRequest'>
export type AuthResponse = Schema<'AuthResponse'>

/** Текущий пользователь и его активные членства. */
export function fetchMe(signal?: AbortSignal): Promise<AuthMeResponse> {
  return unwrap(apiClient.GET('/api/v1/auth/me', signal ? { signal } : undefined))
}

/** Вход по электронной почте и паролю. Пароль после вызова не сохраняется. */
export function login(body: LoginRequest): Promise<AuthResponse> {
  return unwrap(apiClient.POST('/api/v1/auth/login', { body }))
}

/** Регистрация; сервер сразу создаёт сессию. */
export function register(body: RegisterRequest): Promise<AuthResponse> {
  return unwrap(apiClient.POST('/api/v1/auth/register', { body }))
}

/** Отзыв текущей сессии. Повтор при уже отсутствующей сессии не ошибка. */
export async function logout(): Promise<void> {
  await unwrap(apiClient.POST('/api/v1/auth/logout'))
}
