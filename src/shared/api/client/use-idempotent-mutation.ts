/**
 * Composable идемпотентной команды: одна отправка за раз, повтор при
 * неизвестном результате тем же ключом и телом, сброс после однозначного
 * ответа. Инвалидацию кеша выполняет `onSuccess`, который задаёт фича.
 */
import { computed, shallowRef, watch, type ComputedRef, type ShallowRef } from 'vue'
import { draftFor, settleFailure, type IdempotentDraft } from './idempotency'
import { ApiError, isApiError } from './api-error'
import { clearPendingCommand, readPendingCommand, writePendingCommand } from './pending-command'

export type IdempotentStatus = 'idle' | 'pending' | 'unknown' | 'error' | 'success'

export interface IdempotentMutationOptions<Body, Result> {
  /** Выполняет запрос с телом и ключом идемпотентности. */
  execute: (body: Body, key: string) => Promise<Result>
  /** Вызывается после однозначного успеха, до возврата результата. */
  onSuccess?: (result: Result, body: Body) => void | Promise<void>
  /** Сравнение тел; по умолчанию — по JSON. */
  equals?: (left: Body, right: Body) => boolean
  /** Actor/tenant/operation/resource identity for durable business commands. */
  scope?: () => string | null
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
  /** Сбрасывает только однозначно завершённый черновик. */
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
  const scope = computed(() => options.scope?.() ?? null)

  function restore() {
    draft.value = null
    error.value = null
    result.value = null
    status.value = 'idle'
    if (!scope.value) return
    try {
      draft.value = readPendingCommand<Body>(scope.value)
      if (draft.value) {
        status.value = draft.value.state === 'conflict' ? 'error' : 'unknown'
        if (draft.value.state === 'conflict')
          error.value = new ApiError({ httpStatus: 409, code: 'IDEMPOTENCY_CONFLICT' })
      }
    } catch (cause) {
      error.value = cause
      status.value = 'error'
    }
  }
  if (options.scope) watch(scope, restore, { immediate: true })

  async function run(next: IdempotentDraft<Body>): Promise<Result | null> {
    // Защита от двойной отправки: второй вызов во время запроса игнорируется.
    if (inFlight) return null
    inFlight = true
    const commandScope = scope.value
    if (options.scope && !commandScope) {
      inFlight = false
      error.value = new ApiError({ httpStatus: 0, code: 'TENANT_REQUIRED' })
      status.value = 'error'
      return null
    }
    draft.value = next
    status.value = 'pending'
    error.value = null
    // Persist before sending: a reload after commit must reuse this exact pair.
    try {
      if (commandScope) writePendingCommand(commandScope, next)
    } catch (cause) {
      error.value = cause
      status.value = 'error'
      draft.value = null
      inFlight = false
      return null
    }
    let value: Result
    try {
      value = await options.execute(next.body, next.key)
    } catch (cause) {
      const settled = settleFailure(next, cause)
      // A failed authorization of a replay says nothing about its earlier commit.
      if (isApiError(cause) && [401, 403].includes(cause.httpStatus)) settled.state = 'unknown'
      try {
        if (commandScope) {
          if (settled.state === 'failed') clearPendingCommand(commandScope)
          else writePendingCommand(commandScope, settled)
        }
      } catch {
        /* Keep the pre-send journal; never release an uncertain intent. */
      }
      if (scope.value === commandScope) {
        draft.value = settled
        error.value = cause
        status.value = settled.state === 'unknown' ? 'unknown' : 'error'
      }
      inFlight = false
      return null
    }
    // Cache refresh is outside the command outcome: its failure cannot undo success.
    try {
      if (commandScope) clearPendingCommand(commandScope)
    } catch {
      /* Replay remains safe. */
    }
    if (scope.value === commandScope) {
      draft.value = { ...next, state: 'succeeded' }
      result.value = value
      status.value = 'success'
      try {
        await options.onSuccess?.(value, next.body)
      } catch {
        /* The command is already confirmed. */
      }
      inFlight = false
      return value
    }
    inFlight = false
    return null
  }

  return {
    status,
    error,
    result,
    draft,
    isPending: computed(() => status.value === 'pending'),
    canRetry: computed(() => status.value === 'unknown'),
    submit: async (body) => {
      if (inFlight) return null
      if (options.scope) restore()
      if (status.value === 'error' && !draft.value) return null
      try {
        return await run(draftFor(draft.value, body, options.equals))
      } catch {
        error.value = new ApiError({ httpStatus: 409, code: 'UNRESOLVED_COMMAND' })
        if (draft.value?.state !== 'unknown') status.value = 'error'
        return null
      }
    },
    retry: () => {
      const current = draft.value
      if (!current || current.state !== 'unknown') return Promise.resolve(null)
      return run({ ...current, state: 'submitting' })
    },
    reset: () => {
      if (
        inFlight ||
        (draft.value && ['submitting', 'unknown', 'conflict'].includes(draft.value.state))
      )
        return
      draft.value = null
      status.value = 'idle'
      error.value = null
      result.value = null
    },
  }
}
