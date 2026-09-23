import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
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
    expect(isUnknownResult(new Error('x'))).toBe(false)
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
    expect(draftFor(unknown, { type: 'CALL', note: 'b' }).key).not.toBe(first.key)
    const failed = settleFailure(first, badRequest())
    expect(failed.state).toBe('failed')
    expect(draftFor(failed, { type: 'CALL', note: 'a' }).key).not.toBe(first.key)
  })
})

describe('useIdempotentMutation', () => {
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
})
