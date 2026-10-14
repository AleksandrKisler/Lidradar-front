/**
 * Безопасность учётной записи (ADR 0058): смена и сброс пароля, подтверждение почты.
 * Успех всех команд — `204` без тела. Файл отдельный от `auth-api.ts` намеренно:
 * многие тесты подменяют `auth-api` фиксированным списком экспортов.
 */
import {
  apiClient,
  isApiError,
  unwrap,
  unwrapFile,
  type DownloadedFile,
  type Schema,
} from '@/shared/api'

export type ChangePasswordRequest = Schema<'ChangePasswordRequest'>
export type ForgotPasswordRequest = Schema<'ForgotPasswordRequest'>
export type ResetPasswordRequest = Schema<'ResetPasswordRequest'>
export type VerifyEmailRequest = Schema<'VerifyEmailRequest'>
export type PasswordConfirmationRequest = Schema<'PasswordConfirmationRequest'>
export type AccountDeletionScheduled = Schema<'AccountDeletionScheduled'>
export type AccountDeletionBlocker = Schema<'AccountDeletionBlocker'>

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

/**
 * Личная выгрузка данных (ADR 0059): JSON-файл вложением. Нужен текущий пароль в теле; неверный
 * пароль — `403 INVALID_CURRENT_PASSWORD`, а не `401`, поэтому опечатка не разлогинивает.
 */
export function exportAccountData(body: PasswordConfirmationRequest): Promise<DownloadedFile> {
  return unwrapFile(apiClient.POST('/api/v1/auth/account/export', { body, parseAs: 'blob' }))
}

/** Назначает закрытие учётной записи через 30 суток; повтор возвращает прежний срок. */
export function requestAccountDeletion(
  body: PasswordConfirmationRequest,
): Promise<AccountDeletionScheduled> {
  return unwrap(apiClient.POST('/api/v1/auth/account/deletion', { body }))
}

/** Снимает назначенное закрытие; повтор без назначения успешен. */
export async function cancelAccountDeletion(): Promise<void> {
  await unwrap(apiClient.DELETE('/api/v1/auth/account/deletion'))
}

/**
 * Причины, по которым закрыть учётную запись нельзя: `error.details.blockers` ответа
 * `409 ACCOUNT_DELETION_BLOCKED`. Для любой другой ошибки список пуст. Разбор защитный: поле приходит
 * с сервера, и неожиданная форма не должна ломать диалог.
 */
export function deletionBlockers(error: unknown): AccountDeletionBlocker[] {
  if (!isApiError(error) || error.code !== 'ACCOUNT_DELETION_BLOCKED') return []
  const raw = error.details['blockers']
  if (!Array.isArray(raw)) return []
  const result: AccountDeletionBlocker[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    if (record['code'] !== 'SOLE_OWNER' && record['code'] !== 'PLATFORM_ADMIN') continue
    result.push({
      code: record['code'],
      ...(typeof record['organizationName'] === 'string'
        ? { organizationName: record['organizationName'] }
        : {}),
      ...(typeof record['hasOtherMembers'] === 'boolean'
        ? { hasOtherMembers: record['hasOtherMembers'] }
        : {}),
    })
  }
  return result
}
