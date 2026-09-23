import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useRetryAfter } from '@/features/auth-session'

describe('useRetryAfter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
  })
  afterEach(() => vi.useRealTimers())

  it('отсчитывает серверное время ожидания и снимает блокировку', () => {
    const scope = effectScope()
    const retry = scope.run(() => useRetryAfter('test.retry'))!
    expect(retry.active.value).toBe(false)
    retry.start(3)
    expect(retry.active.value).toBe(true)
    expect(retry.secondsLeft.value).toBe(3)
    vi.advanceTimersByTime(2000)
    expect(retry.secondsLeft.value).toBe(1)
    vi.advanceTimersByTime(1000)
    expect(retry.active.value).toBe(false)
    expect(sessionStorage.getItem('test.retry')).toBeNull()
    scope.stop()
  })

  it('переживает перезагрузку страницы через sessionStorage', () => {
    const first = effectScope()
    first.run(() => useRetryAfter('test.retry'))!.start(30)
    first.stop()
    const second = effectScope()
    const restored = second.run(() => useRetryAfter('test.retry'))!
    expect(restored.active.value).toBe(true)
    expect(restored.secondsLeft.value).toBe(30)
    restored.clear()
    expect(restored.active.value).toBe(false)
    second.stop()
  })

  it('игнорирует истёкшее или испорченное сохранённое значение', () => {
    sessionStorage.setItem('test.retry', String(Date.now() - 1000))
    const scope = effectScope()
    expect(scope.run(() => useRetryAfter('test.retry'))!.active.value).toBe(false)
    scope.stop()
    sessionStorage.setItem('test.retry', 'мусор')
    const other = effectScope()
    expect(other.run(() => useRetryAfter('test.retry'))!.active.value).toBe(false)
    other.stop()
  })
})
