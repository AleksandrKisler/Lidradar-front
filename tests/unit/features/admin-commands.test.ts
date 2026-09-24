import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { useRecoveryCommand, type RecoveryTarget } from '@/features/admin/recover-dead-letter'

describe('useRecoveryCommand', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
  beforeEach(() => {
    fetchMock = vi.fn<(request: Request) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ id: 'x' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('каждая пара объект/операция вызывает свой путь и инвалидирует свой список', async () => {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    let command!: ReturnType<typeof useRecoveryCommand>
    const wrapper = mount(
      defineComponent({
        setup() {
          command = useRecoveryCommand()
          return () => h('div')
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    )
    const target = (kind: RecoveryTarget['kind']): RecoveryTarget => ({
      kind,
      id: 'obj',
      tenantId: 't',
      status: 'DEAD',
    })
    await command.mutateAsync({ target: target('aiJob'), action: 'retry' })
    await command.mutateAsync({ target: target('aiJob'), action: 'discard' })
    await command.mutateAsync({ target: target('outbox'), action: 'replay' })
    await command.mutateAsync({ target: target('outbox'), action: 'discard' })
    await command.mutateAsync({ target: target('delivery'), action: 'discard' })
    await command.mutateAsync({ target: target('job'), action: 'discard' })
    const paths = fetchMock.mock.calls.map(([request]) => new URL(request.url).pathname)
    expect(paths).toEqual([
      '/api/v1/admin/ai/jobs/obj/retry',
      '/api/v1/admin/ai/jobs/obj/discard',
      '/api/v1/admin/outbox/obj/replay',
      '/api/v1/admin/outbox/obj/discard',
      '/api/v1/admin/notifications/deliveries/obj/discard',
      '/api/v1/admin/jobs/obj/discard',
    ])
    const keys = invalidate.mock.calls.map(([filters]) =>
      JSON.stringify((filters as { queryKey?: unknown }).queryKey),
    )
    expect(keys).toContain(JSON.stringify(['admin', 'ai', 'runs']))
    expect(keys).toContain(JSON.stringify(['admin', 'jobs']))
    await expect(
      command.mutateAsync({
        target: { ...target('job'), kind: 'unknown' as RecoveryTarget['kind'] },
        action: 'retry',
      }),
    ).rejects.toThrow('Неизвестный объект')
    wrapper.unmount()
  })
})
