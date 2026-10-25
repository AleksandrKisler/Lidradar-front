import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import {
  SANDBOX_POLL_INTERVAL_MS,
  SANDBOX_PENDING_POLL_INTERVAL_MS,
  createSandboxConversation,
  draftProblem,
  fetchSandboxConversation,
  fetchSandboxConversations,
  fetchSandboxOverview,
  fetchSandboxTemplates,
  formatMoment,
  formatPause,
  historyMinutes,
  planTimeline,
  pollInterval,
  sandboxKeys,
  sendSandboxMessage,
  stageLabel,
  storeSandboxConversation,
  verdictBadge,
  verdictText,
  type DraftMessage,
  type VerdictState,
} from '@/entities/sandbox'
import { SANDBOX_ID, priceTemplate, sandboxConversation, verdict } from '../fixtures/sandbox'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => vi.unstubAllGlobals())

const message = (
  text: string,
  pause = 0,
  direction: DraftMessage['direction'] = 'INCOMING',
): DraftMessage => ({
  direction,
  text,
  pauseBeforeMinutes: pause,
})

describe('время сообщений черновика', () => {
  const now = new Date('2026-10-25T12:00:00Z')

  it('считает паузы назад от отправки, как сервер', () => {
    const times = planTimeline(
      [message('a', 90), message('b', 10, 'OUTGOING'), message('c')],
      1440,
      now,
    )
    expect(times.map((time) => time.toISOString())).toEqual([
      '2026-10-24T11:49:59.000Z',
      '2026-10-24T11:59:59.000Z',
      '2026-10-24T12:00:00.000Z',
    ])
    expect(historyMinutes([message('a', 90), message('b', 10)], 60)).toBe(70)
  })

  it('называет причину, по которой черновик нельзя отправить', () => {
    expect(draftProblem([], 0)).toContain('хотя бы одно')
    expect(
      draftProblem(
        Array.from({ length: 31 }, () => message('a')),
        0,
      ),
    ).toContain('30')
    expect(draftProblem([message('  ')], 0)).toContain('пустое')
    expect(draftProblem([message('я'.repeat(4001))], 0)).toContain('4000')
    expect(draftProblem([message('a'), message('b', 60)], 7 * 24 * 60 - 59)).toContain('7 суток')
    expect(draftProblem([message('a')], 7 * 24 * 60)).toBeNull()
  })

  it('подписывает паузы', () => {
    expect([0, 10, 60, 90, 180, 1440, 7200].map(formatPause)).toEqual([
      'нет',
      '10 мин',
      '1 ч',
      '1 ч 30 мин',
      '3 ч',
      '1 сутки',
      '5 суток',
    ])
  })
})

describe('подписи сверки', () => {
  const now = new Date('2026-10-25T12:00:00Z')

  it('у каждого состояния есть метка и текст', () => {
    const states: VerdictState[] = [
      'PROCESSING',
      'MATCH',
      'PENDING',
      'CLOSED',
      'MISMATCH',
      'NO_EXPECTATION',
      'FAILED',
    ]
    for (const state of states) {
      expect(verdictBadge(state).label).not.toBe('')
      expect(verdictText(verdict({ state, stage: null }), 'Europe/Moscow', now).title).not.toBe('')
    }
    expect(verdictBadge('MISMATCH').tone).toBe('danger')
    expect(stageLabel('EVALUATING')).toContain('Radar')
  })

  it('этап обработки и срок риска берутся из ответа', () => {
    expect(verdictText(verdict({ stage: 'ANALYZING' }), 'UTC', now).title).toBe(
      'AI читает переписку',
    )
    expect(verdictText(verdict({ stage: 'SENDING' }), 'UTC', now).description).toContain(
      'Повторите',
    )
    const pending = verdictText(
      verdict({ state: 'PENDING', stage: null, dueAt: '2026-10-26T07:20:00Z' }),
      'Europe/Moscow',
      now,
    )
    expect(pending.description).toContain('завтра, 10:20')
    expect(
      verdictText(verdict({ state: 'PENDING', stage: null }), 'UTC', now).description,
    ).toContain('запланирована')
    expect(
      verdictText(
        verdict({ state: 'FAILED', stage: null, failureCode: 'EVENT_FAILED:X' }),
        'UTC',
        now,
      ).description,
    ).toContain('EVENT_FAILED:X')
    expect(
      verdictText(verdict({ state: 'FAILED', stage: null }), 'UTC', now).description,
    ).not.toContain('Код')
    expect(formatMoment('2026-10-25T09:00:00Z', 'UTC', now)).toBe('Сегодня, 09:00')
  })
})

describe('запросы песочницы', () => {
  it('читает обзор, шаблоны, список и переписку организации', async () => {
    const fetchMock = vi
      .fn<(request: Request) => Promise<Response>>()
      .mockImplementationOnce(async () =>
        jsonResponse({
          enabled: true,
          limits: { conversationsPerDay: 20, messagesPerDay: 200, aiQueueLimit: 3 },
          usage: { conversations: 1, messages: 2 },
          rules: { maxMessagesPerBuild: 30, maxHistoryMinutes: 10080, maxTextLength: 4000 },
        }),
      )
      .mockImplementationOnce(async () => jsonResponse({ items: [priceTemplate] }))
      .mockImplementationOnce(async () => jsonResponse({ items: [sandboxConversation()] }))
      .mockImplementationOnce(async () => jsonResponse(sandboxConversation()))
    vi.stubGlobal('fetch', fetchMock)
    expect((await fetchSandboxOverview('tenant-a')).usage.messages).toBe(2)
    expect((await fetchSandboxTemplates('tenant-a'))[0]!.code).toBe('customer_silent_after_price')
    expect(await fetchSandboxConversations('tenant-a')).toHaveLength(1)
    expect((await fetchSandboxConversation('tenant-a', SANDBOX_ID)).id).toBe(SANDBOX_ID)
    const paths = fetchMock.mock.calls.map(([request]) => new URL(request.url).pathname)
    expect(paths).toEqual([
      '/api/v1/sandbox',
      '/api/v1/sandbox/templates',
      '/api/v1/sandbox/conversations',
      `/api/v1/sandbox/conversations/${SANDBOX_ID}`,
    ])
    expect(
      fetchMock.mock.calls.every(([request]) => request.headers.get('X-Tenant-ID') === 'tenant-a'),
    ).toBe(true)
  })

  it('команды идут с ключом идемпотентности и различают 201 и 200', async () => {
    const fetchMock = vi
      .fn<(request: Request) => Promise<Response>>()
      .mockImplementationOnce(async () => jsonResponse(sandboxConversation(), 201))
      .mockImplementationOnce(async () => jsonResponse(sandboxConversation(), 200))
      .mockImplementationOnce(async () => jsonResponse(sandboxConversation(), 201))
    vi.stubGlobal('fetch', fetchMock)
    const body = {
      locationId: 'loc',
      templateCode: 'empty' as const,
      tailMinutes: 0,
      messages: [{ direction: 'INCOMING' as const, text: 'Да', pauseBeforeMinutes: 0 }],
    }
    expect((await createSandboxConversation('tenant-a', 'key-1', body)).created).toBe(true)
    expect((await createSandboxConversation('tenant-a', 'key-1', body)).created).toBe(false)
    expect(
      (
        await sendSandboxMessage('tenant-a', SANDBOX_ID, 'key-2', {
          direction: 'OUTGOING',
          text: 'Ждём',
        })
      ).created,
    ).toBe(true)
    const [create, , send] = fetchMock.mock.calls.map(([request]) => request)
    expect(create!.headers.get('Idempotency-Key')).toBe('key-1')
    expect(await create!.json()).toEqual(body)
    expect(new URL(send!.url).pathname).toBe(`/api/v1/sandbox/conversations/${SANDBOX_ID}/messages`)
    expect(send!.headers.get('Idempotency-Key')).toBe('key-2')
  })

  it('опрашивает обработку и ожидающий риск, обновляет кеш после команды', async () => {
    expect(pollInterval(undefined)).toBe(false)
    expect(
      pollInterval([sandboxConversation({ status: verdict({ state: 'MATCH', stage: null }) })]),
    ).toBe(false)
    expect(pollInterval([sandboxConversation()])).toBe(SANDBOX_POLL_INTERVAL_MS)
    expect(
      pollInterval([sandboxConversation({ status: verdict({ state: 'PENDING', stage: null }) })]),
    ).toBe(SANDBOX_PENDING_POLL_INTERVAL_MS)
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    await storeSandboxConversation(queryClient, 'tenant-a', sandboxConversation())
    expect(queryClient.getQueryData(sandboxKeys.conversation('tenant-a', SANDBOX_ID))).toBeTruthy()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: sandboxKeys.conversations('tenant-a') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: sandboxKeys.overview('tenant-a') })
    expect(sandboxKeys.all('tenant-a')).toEqual(['tenant', 'tenant-a', 'sandbox'])
    expect(sandboxKeys.templates('tenant-a')).toContain('templates')
  })
})

describe('хуки запросов песочницы', () => {
  it('грузят данные выбранной организации и ничего не запрашивают без неё', async () => {
    const { defineComponent, h, ref } = await import('vue')
    const { flushPromises, mount } = await import('@vue/test-utils')
    const { VueQueryPlugin } = await import('@tanstack/vue-query')
    const {
      useSandboxConversationQuery,
      useSandboxConversationsQuery,
      useSandboxOverviewQuery,
      useSandboxTemplatesQuery,
    } = await import('@/entities/sandbox')
    const fetchMock = vi.fn<(request: Request) => Promise<Response>>(async (request) => {
      const path = new URL(request.url).pathname
      if (path === '/api/v1/sandbox')
        return jsonResponse({
          enabled: true,
          limits: { conversationsPerDay: 20, messagesPerDay: 200, aiQueueLimit: 3 },
          usage: { conversations: 0, messages: 0 },
          rules: { maxMessagesPerBuild: 30, maxHistoryMinutes: 10080, maxTextLength: 4000 },
        })
      if (path === '/api/v1/sandbox/templates') return jsonResponse({ items: [priceTemplate] })
      if (path === '/api/v1/sandbox/conversations')
        return jsonResponse({
          items: [sandboxConversation({ status: verdict({ state: 'MATCH', stage: null }) })],
        })
      return jsonResponse(sandboxConversation({ status: verdict({ state: 'MATCH', stage: null }) }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const tenant = ref<string | null>(null)
    const conversation = ref<string | null>(SANDBOX_ID)
    let results: Record<string, { data: { value: unknown } }> = {}
    mount(
      defineComponent({
        setup() {
          results = {
            overview: useSandboxOverviewQuery(tenant),
            templates: useSandboxTemplatesQuery(tenant),
            list: useSandboxConversationsQuery(tenant),
            detail: useSandboxConversationQuery(tenant, conversation),
          }
          return () => h('div')
        },
      }),
      {
        global: {
          plugins: [
            [
              VueQueryPlugin,
              { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
            ],
          ],
        },
      },
    )
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    tenant.value = 'tenant-a'
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 20))
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect((results.templates!.data.value as unknown[]).length).toBe(1)
    expect((results.detail!.data.value as { id: string }).id).toBe(SANDBOX_ID)
  })
})
