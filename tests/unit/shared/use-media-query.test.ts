import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useMediaQuery } from '@/shared/lib/use-media-query'

afterEach(() => vi.unstubAllGlobals())
describe('useMediaQuery', () => {
  it('reacts to breakpoint/zoom changes and removes the same listener on disposal', () => {
    const add = vi.fn(),
      remove = vi.fn()
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: add, removeEventListener: remove })),
    )
    const scope = effectScope()
    const matches = scope.run(() => useMediaQuery('(min-width: 1024px)'))!
    expect(matches.value).toBe(true)
    const listener = add.mock.calls[0]![1] as (event: { matches: boolean }) => void
    listener({ matches: false })
    expect(matches.value).toBe(false)
    listener({ matches: true })
    expect(matches.value).toBe(true)
    scope.stop()
    expect(remove).toHaveBeenCalledWith('change', listener)
  })
  it('supports an environment without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    const scope = effectScope()
    expect(scope.run(() => useMediaQuery('all'))!.value).toBe(false)
    scope.stop()
  })
})
