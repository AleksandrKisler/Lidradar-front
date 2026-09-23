/**
 * Черновик идемпотентной отправки (действие, исход, выручка).
 *
 * Ключ создаётся до первого POST. Пока результат неизвестен — ответа не было
 * или сервер не смог его дать, — повтор идёт с тем же ключом и телом: сервер
 * вернёт прежний результат либо выполнит команду ровно один раз. Новый ключ
 * появляется только после однозначного ответа, отмены черновика или
 * изменения тела пользователем (архитектура § 4.4).
 */
import { createUuid } from '@/shared/lib'
import { isApiError } from './api-error'

export type DraftState = 'submitting' | 'unknown' | 'failed' | 'succeeded'

export interface IdempotentDraft<Body> {
  /** Значение заголовка `Idempotency-Key`. */
  key: string
  body: Body
  state: DraftState
}

/** Результат команды неизвестен: сеть, таймаут или ошибка на стороне сервера. */
export function isUnknownResult(error: unknown): boolean {
  return isApiError(error) && (error.isNetwork || error.httpStatus >= 500)
}

/** Сравнение тел по значению; порядок ключей у форм стабилен. */
export function sameBody(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Черновик для очередной отправки. Ключ переиспользуется только при
 * неизвестном результате того же тела; иначе выпускается новый.
 */
export function draftFor<Body>(
  previous: IdempotentDraft<Body> | null,
  body: Body,
  equals: (left: Body, right: Body) => boolean = sameBody,
): IdempotentDraft<Body> {
  if (previous && previous.state === 'unknown' && equals(previous.body, body)) {
    return { ...previous, state: 'submitting' }
  }
  return { key: createUuid(), body, state: 'submitting' }
}

/** Состояние черновика после ошибки: неизвестный результат сохраняет ключ. */
export function settleFailure<Body>(
  draft: IdempotentDraft<Body>,
  error: unknown,
): IdempotentDraft<Body> {
  return { ...draft, state: isUnknownResult(error) ? 'unknown' : 'failed' }
}
