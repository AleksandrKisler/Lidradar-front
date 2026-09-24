import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { useAnalyticsSummaryQuery, usePaymentsQuery, usePrecisionQuery } from '@/entities/report'
import { useConsentQuery } from '@/entities/consent'
import { useInvitationsQuery, useMembersQuery } from '@/entities/team'
import { usePreferencesQuery, useTelegramLinkQuery } from '@/entities/notification'

const respond = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('composable-запросы сущностей', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
  beforeEach(() => {
    fetchMock = vi.fn<(request: Request) => Promise<Response>>(async (request) => {
      const url = request.url
      if (url.includes('/analytics/summary')) return respond({ period: { timezone: 'UTC' } })
      if (url.includes('/analytics/payments')) return respond({ items: [], nextCursor: null })
      if (url.includes('/risks/precision')) return respond({ items: [] })
      if (url.includes('/ml-consent'))
        return respond({ scope: 'DATASETS', active: false, consent: null })
      if (url.includes('/telegram-link')) return respond({ linked: false })
      return respond({ items: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('стартуют только с организацией и параметрами и передают заголовок организации', async () => {
    const range = { from: '2026-09-01', to: '2026-09-24' }
    let hooks!: Record<string, { data: { value: unknown }; isFetched: { value: boolean } }>
    const wrapper = mount(
      defineComponent({
        setup() {
          hooks = {
            summary: useAnalyticsSummaryQuery('tenant-a', range),
            summaryOff: useAnalyticsSummaryQuery('tenant-a', null),
            precision: usePrecisionQuery('tenant-a', { from: 'a', to: 'b' }),
            precisionOff: usePrecisionQuery(null, { from: 'a', to: 'b' }),
            payments: usePaymentsQuery('tenant-a', range),
            consent: useConsentQuery('tenant-a'),
            consentOff: useConsentQuery(null),
            members: useMembersQuery('tenant-a'),
            invitations: useInvitationsQuery('tenant-a'),
            preferences: usePreferencesQuery('tenant-a'),
            link: useTelegramLinkQuery('tenant-a'),
          }
          return () => h('div')
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] } },
    )
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 20))
    await flushPromises()
    expect(hooks.summary!.data.value).toEqual({ period: { timezone: 'UTC' } })
    expect(hooks.precision!.data.value).toEqual({ items: [] })
    expect(hooks.consent!.data.value).toEqual({ scope: 'DATASETS', active: false, consent: null })
    expect(hooks.members!.data.value).toEqual([])
    expect(hooks.invitations!.data.value).toEqual([])
    expect(hooks.preferences!.data.value).toEqual([])
    expect(hooks.link!.data.value).toEqual({ linked: false })
    expect((hooks.payments!.data.value as { pages: unknown[] }).pages).toHaveLength(1)
    expect(hooks.summaryOff!.isFetched.value).toBe(false)
    expect(hooks.precisionOff!.isFetched.value).toBe(false)
    expect(hooks.consentOff!.isFetched.value).toBe(false)
    expect(
      fetchMock.mock.calls.every(([request]) => request.headers.get('X-Tenant-ID') === 'tenant-a'),
    ).toBe(true)
    wrapper.unmount()
  })
})
