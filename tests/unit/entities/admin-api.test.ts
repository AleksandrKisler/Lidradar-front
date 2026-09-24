import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import {
  deliveryChannelLabel,
  discardAIJob,
  discardJob,
  discardOutboxEvent,
  fetchAINodes,
  fetchAIRuns,
  fetchAdminConnections,
  fetchAdminOrganizations,
  fetchConversationSummary,
  fetchDeadLetters,
  fetchPlatformAdmins,
  fetchQueueStats,
  fetchUsage,
  replayOutboxEvent,
  retryAIJob,
  revokePlatformAdmin,
  safeJson,
  useAINodesQuery,
  useAIRunsQuery,
  useAdminConnectionsQuery,
  useAdminJobsQuery,
  useAdminOrganizationsQuery,
  useConversationSummaryQuery,
  useDeadLettersQuery,
  usePlatformAdminsQuery,
  useQueueStatsQuery,
  useTraceQuery,
  useUsageQuery,
} from '@/entities/admin'

const respond = (body: unknown, status = 200) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('admin API: остальные запросы', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
  const path = (index: number) => new URL(fetchMock.mock.calls[index]![0].url).pathname
  const query = (index: number) => new URL(fetchMock.mock.calls[index]![0].url).searchParams

  beforeEach(() => {
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('каталоги и очереди разворачивают items и адресуют свои пути', async () => {
    fetchMock.mockImplementation(async (request) =>
      request.url.includes('/queue') || request.url.includes('/dead-letters')
        ? respond({ checkedAt: 'now', jobs: [], outbox: [], aiJobs: [], deliveries: [] })
        : respond({ items: [{ id: 'x' }] }),
    )
    expect(await fetchPlatformAdmins()).toEqual([{ id: 'x' }])
    expect(await fetchAdminOrganizations()).toEqual([{ id: 'x' }])
    expect(await fetchAdminConnections()).toEqual([{ id: 'x' }])
    expect(await fetchAINodes()).toEqual([{ id: 'x' }])
    expect(
      await fetchAIRuns({ status: 'FAILED', applicationStatus: 'REJECTED', tenantId: 't' }),
    ).toEqual([{ id: 'x' }])
    expect(await fetchAIRuns({})).toEqual([{ id: 'x' }])
    await fetchQueueStats()
    await fetchDeadLetters(100)
    expect([path(0), path(1), path(2), path(3), path(4), path(6), path(7)]).toEqual([
      '/api/v1/admin/admins',
      '/api/v1/admin/organizations',
      '/api/v1/admin/connections',
      '/api/v1/admin/ai/nodes',
      '/api/v1/admin/ai/runs',
      '/api/v1/admin/queue',
      '/api/v1/admin/dead-letters',
    ])
    expect(query(4).get('applicationStatus')).toBe('REJECTED')
    expect(query(4).get('tenantId')).toBe('t')
    expect(query(5).get('limit')).toBe('50')
    expect(query(7).get('limit')).toBe('100')
  })

  it('команды восстановления и точечные запросы адресуют объект', async () => {
    fetchMock.mockImplementation(async (request) =>
      request.method === 'DELETE' ? new Response(null, { status: 204 }) : respond({ id: 'x' }),
    )
    await discardJob('j')
    await replayOutboxEvent('e')
    await discardOutboxEvent('e')
    await retryAIJob('a')
    await discardAIJob('a')
    await revokePlatformAdmin('u')
    await fetchConversationSummary('t', 'c')
    await fetchUsage('2026-09-01T00:00:00.000Z', '2026-09-25T00:00:00.000Z')
    expect([path(0), path(1), path(2), path(3), path(4), path(5), path(6), path(7)]).toEqual([
      '/api/v1/admin/jobs/j/discard',
      '/api/v1/admin/outbox/e/replay',
      '/api/v1/admin/outbox/e/discard',
      '/api/v1/admin/ai/jobs/a/retry',
      '/api/v1/admin/ai/jobs/a/discard',
      '/api/v1/admin/admins/u',
      '/api/v1/admin/ai/tenants/t/conversations/c/summary',
      '/api/v1/admin/usage',
    ])
    expect(fetchMock.mock.calls[5]![0].method).toBe('DELETE')
    expect(query(7).get('from')).toBe('2026-09-01T00:00:00.000Z')
  })

  it('composable-запросы стартуют только с параметрами и без заголовка организации', async () => {
    fetchMock.mockImplementation(async (request) => {
      const url = request.url
      if (url.includes('/queue')) return respond({ checkedAt: 'now', deadUnhandled: 1 })
      if (url.includes('/dead-letters'))
        return respond({ jobs: [], outbox: [], aiJobs: [], deliveries: [] })
      if (url.includes('/usage')) return respond({ from: 'a', to: 'b', tenants: [] })
      if (url.includes('/trace/')) return respond({ message: { id: 'm' } })
      if (url.includes('/summary')) return respond({ facts: [] })
      return respond({ items: [] })
    })
    let hooks!: Record<string, { data: { value: unknown }; isFetched: { value: boolean } }>
    const wrapper = mount(
      defineComponent({
        setup() {
          hooks = {
            admins: usePlatformAdminsQuery(),
            organizations: useAdminOrganizationsQuery(),
            connections: useAdminConnectionsQuery(),
            queue: useQueueStatsQuery(),
            jobs: useAdminJobsQuery({ status: 'DEAD' }),
            dead: useDeadLettersQuery(50),
            nodes: useAINodesQuery(),
            runs: useAIRunsQuery({}),
            summary: useConversationSummaryQuery({ tenantId: 't', conversationId: 'c' }),
            summaryOff: useConversationSummaryQuery(null),
            usage: useUsageQuery({ from: 'a', to: 'b' }),
            usageOff: useUsageQuery(null),
            trace: useTraceQuery({ tenantId: 't', messageId: 'm' }),
            traceOff: useTraceQuery(null),
          }
          return () => h('div')
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] } },
    )
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 20))
    await flushPromises()
    expect(hooks.queue!.data.value).toEqual({ checkedAt: 'now', deadUnhandled: 1 })
    expect(hooks.jobs!.data.value).toEqual([])
    expect(hooks.usage!.data.value).toEqual({ from: 'a', to: 'b', tenants: [] })
    expect(hooks.trace!.data.value).toEqual({ message: { id: 'm' } })
    expect(hooks.summary!.data.value).toEqual({ facts: [] })
    expect(hooks.summaryOff!.isFetched.value).toBe(false)
    expect(hooks.usageOff!.isFetched.value).toBe(false)
    expect(hooks.traceOff!.isFetched.value).toBe(false)
    expect(
      fetchMock.mock.calls.every(([request]) => request.headers.get('X-Tenant-ID') === null),
    ).toBe(true)
    wrapper.unmount()
  })

  it('подписи каналов и нестроковый JSON', () => {
    expect(deliveryChannelLabel('TELEGRAM')).toBe('Telegram')
    expect(deliveryChannelLabel('SMS')).toBe('SMS')
    // Функции JSON.stringify не сериализует: показывается строковое представление.
    expect(safeJson(() => 1)).toContain('=>')
  })
})
