import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import {
  ApiError,
  draftFor,
  isUnknownResult,
  settleFailure,
  useIdempotentMutation,
  type IdempotentDraft,
} from '@/shared/api'

const network = () => ApiError.network(new TypeError('offline'))
const serverError = () => new ApiError({ httpStatus: 503, code: 'SERVICE_NOT_READY' })
const badRequest = () => new ApiError({ httpStatus: 400, code: 'INVALID_ARGUMENT' })

describe('черновик идемпотентной отправки', () => {
  it('неизвестный результат — сеть и 5xx, но не 4xx', () => {
    expect(isUnknownResult(network())).toBe(true)
    expect(isUnknownResult(serverError())).toBe(true)
    expect(isUnknownResult(badRequest())).toBe(false)
    expect(isUnknownResult(new Error('x'))).toBe(true)
  })

  it('первый черновик получает новый ключ', () => {
    const draft = draftFor(null, { type: 'CALL' })
    expect(draft.key).toMatch(/^[0-9a-f-]{36}$/)
    expect(draft.state).toBe('submitting')
  })

  it('переиспользует ключ только при неизвестном результате того же тела', () => {
    const first = draftFor(null, { type: 'CALL', note: 'a' })
    const unknown: IdempotentDraft<{ type: string; note: string }> = settleFailure(first, network())
    expect(unknown.state).toBe('unknown')
    expect(draftFor(unknown, { type: 'CALL', note: 'a' }).key).toBe(first.key)
    expect(() => draftFor(unknown, { type: 'CALL', note: 'b' })).toThrow('Unresolved command')
    const failed = settleFailure(first, badRequest())
    expect(failed.state).toBe('failed')
    expect(draftFor(failed, { type: 'CALL', note: 'a' }).key).not.toBe(first.key)
  })
})

describe('useIdempotentMutation', () => {
  beforeEach(() => localStorage.clear())
  function setup(execute: (body: { type: string }, key: string) => Promise<string>) {
    const scope = effectScope()
    const onSuccess = vi.fn()
    const mutation = scope.run(() => useIdempotentMutation({ execute, onSuccess }))!
    return { mutation, onSuccess, stop: () => scope.stop() }
  }

  it('успех: результат, статус и onSuccess с телом', async () => {
    const execute = vi.fn().mockResolvedValue('ok')
    const { mutation, onSuccess, stop } = setup(execute)
    expect(await mutation.submit({ type: 'CALL' })).toBe('ok')
    expect(mutation.status.value).toBe('success')
    expect(mutation.result.value).toBe('ok')
    expect(onSuccess).toHaveBeenCalledWith('ok', { type: 'CALL' })
    expect(execute.mock.calls[0]![1]).toMatch(/^[0-9a-f-]{36}$/)
    stop()
  })

  it('неизвестный результат: повтор идёт тем же ключом, новое тело — новым', async () => {
    const execute = vi.fn().mockRejectedValueOnce(network()).mockResolvedValue('ok')
    const { mutation, stop } = setup(execute)
    expect(await mutation.submit({ type: 'CALL' })).toBeNull()
    expect(mutation.status.value).toBe('unknown')
    expect(mutation.canRetry.value).toBe(true)
    const key = execute.mock.calls[0]![1]
    expect(await mutation.retry()).toBe('ok')
    expect(execute.mock.calls[1]![1]).toBe(key)
    expect(mutation.status.value).toBe('success')
    await mutation.submit({ type: 'OTHER' })
    expect(execute.mock.calls[2]![1]).not.toBe(key)
    stop()
  })

  it('известная ошибка: статус error, повтор недоступен, следующая отправка с новым ключом', async () => {
    const execute = vi.fn().mockRejectedValueOnce(badRequest()).mockResolvedValue('ok')
    const { mutation, stop } = setup(execute)
    await mutation.submit({ type: 'CALL' })
    expect(mutation.status.value).toBe('error')
    expect(mutation.canRetry.value).toBe(false)
    expect(await mutation.retry()).toBeNull()
    await mutation.submit({ type: 'CALL' })
    expect(execute.mock.calls[1]![1]).not.toBe(execute.mock.calls[0]![1])
    stop()
  })

  it('во время отправки повторный вызов игнорируется, reset очищает черновик', async () => {
    let resolve!: (value: string) => void
    const execute = vi.fn(() => new Promise<string>((done) => (resolve = done)))
    const { mutation, stop } = setup(execute)
    const first = mutation.submit({ type: 'CALL' })
    expect(mutation.isPending.value).toBe(true)
    expect(await mutation.submit({ type: 'CALL' })).toBeNull()
    expect(execute).toHaveBeenCalledTimes(1)
    resolve('ok')
    expect(await first).toBe('ok')
    mutation.reset()
    expect(mutation.status.value).toBe('idle')
    expect(mutation.draft.value).toBeNull()
    stop()
  })

  it('lost response после commit: reload/logout сохраняют исходную пару и не создают вторую оплату', async () => {
    const actorScope = ref<string | null>('user-a/tenant-a/revenue/opportunity-1')
    const rows = new Map<string, number>()
    let loseResponse = true
    const execute = vi.fn(async (body: { amount: number }, key: string) => {
      if (!rows.has(key)) rows.set(key, body.amount)
      if (loseResponse) {
        loseResponse = false
        throw network()
      }
      return rows.get(key)!
    })
    const firstScope = effectScope()
    const first = firstScope.run(() =>
      useIdempotentMutation({ execute, scope: () => actorScope.value }),
    )!
    const body = { amount: 100 }
    await first.submit(body)
    const key = first.draft.value!.key
    body.amount = 900
    first.reset()
    expect(first.canRetry.value).toBe(true)
    expect(await first.submit(body)).toBeNull()
    expect(execute).toHaveBeenCalledTimes(1)
    firstScope.stop()
    const secondScope = effectScope()
    const second = secondScope.run(() =>
      useIdempotentMutation({ execute, scope: () => actorScope.value }),
    )!
    expect(second.draft.value?.body.amount).toBe(100)
    actorScope.value = null
    await nextTick()
    expect(second.draft.value).toBeNull()
    actorScope.value = 'user-b/tenant-a/revenue/opportunity-1'
    await nextTick()
    expect(second.draft.value).toBeNull()
    actorScope.value = 'user-a/tenant-a/revenue/opportunity-1'
    await nextTick()
    expect(await second.retry()).toBe(100)
    expect(execute.mock.calls[1]).toEqual([{ amount: 100 }, key])
    expect(rows.size).toBe(1)
    expect(localStorage.length).toBe(0)
    secondScope.stop()
  })

  it('ошибка обновления после успеха не превращает подтверждённый commit в unknown', async () => {
    const execute = vi.fn().mockResolvedValue('ok')
    const mutation = useIdempotentMutation({
      execute,
      onSuccess: () => {
        throw new Error('refetch')
      },
    })
    expect(await mutation.submit({ type: 'CALL' })).toBe('ok')
    expect(mutation.status.value).toBe('success')
    expect(mutation.canRetry.value).toBe(false)
  })

  it('повреждённый журнал блокирует новый POST, а конфликт нельзя сбросить', async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new ApiError({ httpStatus: 409, code: 'IDEMPOTENCY_CONFLICT' }))
    const scope = effectScope()
    const mutation = scope.run(() =>
      useIdempotentMutation({ execute, scope: () => 'corrupt-test' }),
    )!
    await mutation.submit({ type: 'CALL' })
    mutation.reset()
    expect(await mutation.submit({ type: 'OTHER' })).toBeNull()
    expect(execute).toHaveBeenCalledTimes(1)
    const storageKey = localStorage.key(0)!
    localStorage.setItem(storageKey, 'corrupted')
    expect(await mutation.submit({ type: 'CALL' })).toBeNull()
    expect(execute).toHaveBeenCalledTimes(1)
    expect(mutation.error.value).toMatchObject({ code: 'PENDING_COMMAND_UNAVAILABLE' })
    scope.stop()
  })

  it('ошибка сохранения до запроса не отправляет команду без восстановимого ключа', async () => {
    const execute = vi.fn()
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    const scope = effectScope()
    const mutation = scope.run(() => useIdempotentMutation({ execute, scope: () => 'quota-test' }))!
    expect(await mutation.submit({ type: 'CALL' })).toBeNull()
    expect(execute).not.toHaveBeenCalled()
    storage.mockRestore()
    scope.stop()
  })
})
