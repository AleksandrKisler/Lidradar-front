/**
 * Composable идемпотентной команды: одна отправка за раз, повтор при
 * неизвестном результате тем же ключом и телом, сброс после однозначного
 * ответа. Инвалидацию кеша выполняет `onSuccess`, который задаёт фича.
 */
import { computed, shallowRef, type ComputedRef, type ShallowRef } from 'vue'
import { draftFor, settleFailure, type IdempotentDraft } from './idempotency'

export type IdempotentStatus = 'idle' | 'pending' | 'unknown' | 'error' | 'success'

export interface IdempotentMutationOptions<Body, Result> {
  /** Выполняет запрос с телом и ключом идемпотентности. */
  execute: (body: Body, key: string) => Promise<Result>
  /** Вызывается после однозначного успеха, до возврата результата. */
  onSuccess?: (result: Result, body: Body) => void | Promise<void>
  /** Сравнение тел; по умолчанию — по JSON. */
  equals?: (left: Body, right: Body) => boolean
}

export interface IdempotentMutation<Body, Result> {
  status: ShallowRef<IdempotentStatus>
  error: ShallowRef<unknown>
  result: ShallowRef<Result | null>
  /** Текущий черновик; ключ виден только тестам и отладке. */
  draft: ShallowRef<IdempotentDraft<Body> | null>
  isPending: ComputedRef<boolean>
  /** Результат прошлой отправки неизвестен: можно безопасно повторить. */
  canRetry: ComputedRef<boolean>
  /** Отправляет тело; при неизвестном результате того же тела повторяет прежний ключ. */
  submit: (body: Body) => Promise<Result | null>
  /** Повторяет последнюю отправку с неизвестным результатом. */
  retry: () => Promise<Result | null>
  /** Отменяет черновик: следующая отправка получит новый ключ. */
  reset: () => void
}

export function useIdempotentMutation<Body, Result>(
  options: IdempotentMutationOptions<Body, Result>,
): IdempotentMutation<Body, Result> {
  const draft = shallowRef<IdempotentDraft<Body> | null>(null)
  const status = shallowRef<IdempotentStatus>('idle')
  const error = shallowRef<unknown>(null)
  const result = shallowRef<Result | null>(null)
  let inFlight = false

  async function run(next: IdempotentDraft<Body>): Promise<Result | null> {
    // Защита от двойной отправки: второй вызов во время запроса игнорируется.
    if (inFlight) return null
    inFlight = true
    draft.value = next
    status.value = 'pending'
    error.value = null
    try {
      const value = await options.execute(next.body, next.key)
      draft.value = { ...next, state: 'succeeded' }
      result.value = value
      status.value = 'success'
      await options.onSuccess?.(value, next.body)
      return value
    } catch (cause) {
      const settled = settleFailure(next, cause)
      draft.value = settled
      error.value = cause
      status.value = settled.state === 'unknown' ? 'unknown' : 'error'
      return null
    } finally {
      inFlight = false
    }
  }

  return {
    status,
    error,
    result,
    draft,
    isPending: computed(() => status.value === 'pending'),
    canRetry: computed(() => status.value === 'unknown'),
    submit: (body) => run(draftFor(draft.value, body, options.equals)),
    retry: () => {
      const current = draft.value
      if (!current || current.state !== 'unknown') return Promise.resolve(null)
      return run({ ...current, state: 'submitting' })
    },
    reset: () => {
      draft.value = null
      status.value = 'idle'
      error.value = null
      result.value = null
    },
  }
}
