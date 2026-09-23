import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { useOrganizationQuery } from '@/entities/organization'
import { useLocationsQuery } from '@/entities/location'
import { useActiveRisksQuery, useRadarSummaryQuery } from '@/entities/risk'
import { riskDetailFixture } from '../fixtures/risk-detail'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Монтирует composable внутри компонента с собственным QueryClient без повторов. */
function mountWithQuery<Result>(setup: () => Result): { result: Result; unmount: () => void } {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let result!: Result
  const wrapper = mount(
    defineComponent({
      setup() {
        result = setup()
        return () => h('div')
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  )
  return { result, unmount: () => wrapper.unmount() }
}

afterEach(() => vi.unstubAllGlobals())

describe('запросы сущностей через TanStack Query', () => {
  it('организация и точки выключены без организации и запрашиваются с её заголовком', async () => {
    const fetchMock = vi.fn().mockImplementation((request: Request) => {
      const url = new URL(request.url)
      if (url.pathname === '/api/v1/organization') {
        return Promise.resolve(
          jsonResponse({
            id: 'tenant-a',
            name: 'Организация',
            defaultTimezone: 'Europe/Moscow',
            defaultCurrency: 'RUB',
            status: 'ACTIVE',
            createdAt: '2026-09-01T00:00:00Z',
            updatedAt: '2026-09-01T00:00:00Z',
          }),
        )
      }
      return Promise.resolve(jsonResponse({ items: [{ id: 'loc-1', name: 'Студия' }] }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const tenantId = ref<string | null>(null)
    const { result, unmount } = mountWithQuery(() => ({
      organization: useOrganizationQuery(tenantId),
      locations: useLocationsQuery(tenantId),
    }))
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    tenantId.value = 'tenant-a'
    await vi.waitFor(() => expect(result.organization.data.value?.defaultCurrency).toBe('RUB'))
    await vi.waitFor(() => expect(result.locations.data.value?.[0]?.name).toBe('Студия'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const [request] of fetchMock.mock.calls as [Request][]) {
      expect(request.headers.get('X-Tenant-ID')).toBe('tenant-a')
    }
    unmount()
  })

  it('лента подгружает страницы по курсору, сводка использует те же фильтры', async () => {
    let feedCalls = 0
    const fetchMock = vi.fn().mockImplementation((request: Request) => {
      const url = new URL(request.url)
      if (url.pathname === '/api/v1/radar') {
        return Promise.resolve(
          jsonResponse({
            openRisks: 3,
            criticalRisks: 1,
            potentialRevenue: '15000.00',
            confirmedRecoveredRevenue: '7000.00',
          }),
        )
      }
      feedCalls += 1
      const cursor = url.searchParams.get('cursor')
      return Promise.resolve(
        jsonResponse({
          items: [
            {
              ...riskDetailFixture,
              risk: { ...riskDetailFixture.risk, id: cursor ? 'risk-2' : 'risk-1' },
            },
          ],
          nextCursor: cursor ? null : 'next',
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const filters = ref({ severity: 'HIGH' as const })
    const { result, unmount } = mountWithQuery(() => ({
      summary: useRadarSummaryQuery('tenant-a', filters),
      feed: useActiveRisksQuery('tenant-a', filters),
    }))
    await vi.waitFor(() => expect(result.summary.data.value?.openRisks).toBe(3))
    await vi.waitFor(() => expect(result.feed.data.value?.pages).toHaveLength(1))
    expect(result.feed.hasNextPage.value).toBe(true)
    await result.feed.fetchNextPage()
    await vi.waitFor(() => expect(result.feed.data.value?.pages).toHaveLength(2))
    expect(result.feed.data.value?.pages[1]?.items[0]?.risk.id).toBe('risk-2')
    expect(result.feed.hasNextPage.value).toBe(false)
    expect(feedCalls).toBe(2)
    const radarCall = fetchMock.mock.calls.find(
      ([request]) => new URL((request as Request).url).pathname === '/api/v1/radar',
    )
    expect(new URL((radarCall![0] as Request).url).searchParams.get('severity')).toBe('HIGH')
    unmount()
  })
})
