/**
 * Безопасность учётной записи (ADR 0058): смена и сброс пароля, подтверждение почты.
 * Успех всех команд — `204` без тела. Файл отдельный от `auth-api.ts` намеренно:
 * многие тесты подменяют `auth-api` фиксированным списком экспортов.
 */
import { apiClient, unwrap, type Schema } from '@/shared/api'

export type ChangePasswordRequest = Schema<'ChangePasswordRequest'>
export type ForgotPasswordRequest = Schema<'ForgotPasswordRequest'>
export type ResetPasswordRequest = Schema<'ResetPasswordRequest'>
export type VerifyEmailRequest = Schema<'VerifyEmailRequest'>

/** Смена пароля вошедшим пользователем: остальные сессии завершаются, текущая остаётся. */
export async function changePassword(body: ChangePasswordRequest): Promise<void> {
  await unwrap(apiClient.POST('/api/v1/auth/password/change', { body }))
}

/** Запрос письма со ссылкой сброса. Ответ одинаков для любого адреса. */
export async function requestPasswordReset(body: ForgotPasswordRequest): Promise<void> {
  await unwrap(apiClient.POST('/api/v1/auth/password/forgot', { body }))
}

/** Новый пароль по токену из письма; все сессии пользователя завершаются, входа не происходит. */
export async function resetPassword(body: ResetPasswordRequest): Promise<void> {
  await unwrap(apiClient.POST('/api/v1/auth/password/reset', { body }))
}

/** Повторное письмо подтверждения почты вошедшему пользователю. */
export async function resendEmailVerification(): Promise<void> {
  await unwrap(apiClient.POST('/api/v1/auth/email/verification'))
}

/** Подтверждение почты по токену из письма; сессия не нужна. */
export async function verifyEmail(body: VerifyEmailRequest): Promise<void> {
  await unwrap(apiClient.POST('/api/v1/auth/email/verify', { body }))
}
