/**
 * Классификация ответов регистрации (ADR 0067, ADR 0068). Решение принимается по HTTP-статусу и
 * машинному коду, а не по тексту сервера, и не обобщается на «все 4xx»: каждый класс ведёт в своё
 * состояние интерфейса.
 */
import { isApiError } from '@/shared/api'

/** Запасной срок ожидания, если `Retry-After` отсутствует или некорректен. */
export const FALLBACK_RETRY_SECONDS = 60

export type InvitationCheckFailure =
  /** Только `403 INVITATION_INVALID`: код непригоден (неизвестен, истёк, отозван, использован). */
  | { kind: 'invalid' }
  /** `429`: ждать серверный срок, автоматического повтора нет. */
  | { kind: 'rate-limited'; seconds: number }
  /**
   * Проверка не завершена: сеть, таймаут, `5xx`, `400`, `403 ORIGIN_NOT_ALLOWED`, неожиданный `401`,
   * `404` старого API, неразборчивый ответ. Это не утверждение о негодности кода.
   */
  | { kind: 'service' }

function retrySeconds(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : FALLBACK_RETRY_SECONDS
}

export function classifyInvitationCheckError(error: unknown): InvitationCheckFailure {
  if (!isApiError(error)) return { kind: 'service' }
  if (error.httpStatus === 403 && error.code === 'INVITATION_INVALID') return { kind: 'invalid' }
  if (error.httpStatus === 429)
    return { kind: 'rate-limited', seconds: retrySeconds(error.retryAfterSeconds) }
  return { kind: 'service' }
}

export type RegisterFailure =
  /** Подтверждённый нейтральный отказ: новый `400 REGISTRATION_FAILED` или прежний `409`. */
  | { kind: 'rejected' }
  /** Окончательная проверка приглашения не прошла. */
  | { kind: 'invitation-invalid' }
  /** Общая регистрация закрыта: без кода создать аккаунт нельзя. */
  | { kind: 'invitation-required' }
  | { kind: 'rate-limited'; seconds: number }
  /** Ответа нет (сеть, таймаут) или сервер не завершил запрос (`5xx`): аккаунт мог быть создан. */
  | { kind: 'unknown-outcome' }
  /** Прочий определённый отказ без создания аккаунта; показывается безопасной подписью. */
  | { kind: 'failed' }

export function classifyRegisterError(error: unknown): RegisterFailure {
  if (!isApiError(error)) return { kind: 'unknown-outcome' }
  const { httpStatus, code } = error
  if (
    (httpStatus === 400 && code === 'REGISTRATION_FAILED') ||
    (httpStatus === 409 && code === 'EMAIL_ALREADY_REGISTERED')
  ) {
    return { kind: 'rejected' }
  }
  if (httpStatus === 403 && code === 'INVITATION_INVALID') return { kind: 'invitation-invalid' }
  if (httpStatus === 403 && code === 'INVITATION_REQUIRED') return { kind: 'invitation-required' }
  if (httpStatus === 429)
    return { kind: 'rate-limited', seconds: retrySeconds(error.retryAfterSeconds) }
  if (httpStatus === 0 || httpStatus >= 500) return { kind: 'unknown-outcome' }
  return { kind: 'failed' }
}
