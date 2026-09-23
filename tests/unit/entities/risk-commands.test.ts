import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import {
  acknowledgeRisk,
  createAction,
  createOutcome,
  ensureRecommendation,
  fetchRiskDetail,
  invalidateRisk,
  recordRiskFeedback,
  resolveRisk,
  riskKeys,
} from '@/entities/risk'
import { riskDetailFixture } from '../fixtures/risk-detail'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => vi.unstubAllGlobals())

/** Ключ из аргумента `invalidateQueries` (объект фильтров или функция). */
function queryKeyOf(filters: unknown): readonly unknown[] | undefined {
  return (filters as { queryKey?: readonly unknown[] } | undefined)?.queryKey
}

describe('команды риска', () => {
  it('взять в работу, закрыть и рекомендация — POST без тела с заголовком организации', async () => {
    // Каждый вызов получает свой Response: тело читается один раз.
    const fetchMock = vi.fn<(request: Request) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse(riskDetailFixture.risk)),
    )
    vi.stubGlobal('fetch', fetchMock)
    await acknowledgeRisk('tenant-a', 'risk-1')
    await resolveRisk('tenant-a', 'risk-1')
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          id: 'rec-1',
          riskId: 'risk-1',
          text: 'Ответить',
          source: 'TEMPLATE',
          createdAt: '2026-09-18T10:00:00Z',
        }),
      ),
    )
    const recommendation = await ensureRecommendation('tenant-a', 'risk-1')
    expect(recommendation.text).toBe('Ответить')
    const paths = fetchMock.mock.calls.map(
      ([request]) => new URL((request as Request).url).pathname,
    )
    expect(paths).toEqual([
      '/api/v1/risks/risk-1/acknowledge',
      '/api/v1/risks/risk-1/resolve',
      '/api/v1/risks/risk-1/recommendation',
    ])
    for (const [request] of fetchMock.mock.calls as [Request][]) {
      expect(request.method).toBe('POST')
      expect(request.headers.get('X-Tenant-ID')).toBe('tenant-a')
      expect(request.headers.has('Idempotency-Key')).toBe(false)
    }
  })

  it('действие отправляется с ключом идемпотентности; 201 — новая запись, 200 — повтор', async () => {
    const action = {
      id: 'act-1',
      riskId: 'risk-1',
      actorId: 'user-1',
      type: 'CALL',
      createdAt: '2026-09-18T10:05:00Z',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(action, 201))
      .mockResolvedValueOnce(jsonResponse(action, 200))
    vi.stubGlobal('fetch', fetchMock)
    const first = await createAction('tenant-a', 'risk-1', 'key-1', { type: 'CALL', note: '' })
    const second = await createAction('tenant-a', 'risk-1', 'key-1', {
      type: 'CALL',
      note: 'позвонил',
    })
    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    expect(first.action.id).toBe('act-1')
    const requests = fetchMock.mock.calls.map(([request]) => request as Request)
    expect(requests[0]!.headers.get('Idempotency-Key')).toBe('key-1')
    expect(new URL(requests[0]!.url).pathname).toBe('/api/v1/risks/risk-1/actions')
    // Пустая заметка не отправляется: у сервера additionalProperties: false и minLength нет.
    expect(await requests[0]!.json()).toEqual({ type: 'CALL' })
    expect(await requests[1]!.json()).toEqual({ type: 'CALL', note: 'позвонил' })
  })

  it('исход записывается на сделку, детали читаются по идентификатору риска', async () => {
    const outcome = {
      id: 'out-1',
      opportunityId: 'opp-1',
      actorId: 'user-1',
      status: 'THINKING',
      createdAt: '2026-09-18T10:10:00Z',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(outcome, 201))
      .mockResolvedValueOnce(jsonResponse(riskDetailFixture))
    vi.stubGlobal('fetch', fetchMock)
    const recorded = await createOutcome('tenant-a', 'opp-1', 'key-2', { status: 'THINKING' })
    expect(recorded.outcome.status).toBe('THINKING')
    expect(recorded.replayed).toBe(false)
    const detail = await fetchRiskDetail('tenant-a', 'risk-1')
    expect(detail.risk.id).toBe('risk-1')
    const requests = fetchMock.mock.calls.map(([request]) => request as Request)
    expect(new URL(requests[0]!.url).pathname).toBe('/api/v1/opportunities/opp-1/outcomes')
    expect(requests[0]!.headers.get('Idempotency-Key')).toBe('key-2')
    expect(new URL(requests[1]!.url).pathname).toBe('/api/v1/risks/risk-1')
    expect(requests[1]!.method).toBe('GET')
  })

  it('вердикт отправляется без ключа идемпотентности и возвращает запись', async () => {
    const stored = {
      id: 'fb-1',
      riskId: 'risk-1',
      opportunityId: 'opp-1',
      actorId: 'user-1',
      verdict: 'FALSE_POSITIVE',
      reason: 'CUSTOMER_ALREADY_BOOKED',
      note: '',
      context: {},
      datasetEligible: false,
      createdAt: '2026-09-18T12:00:00Z',
    }
    const fetchMock = vi
      .fn<(request: Request) => Promise<Response>>()
      .mockResolvedValue(jsonResponse(stored, 201))
    vi.stubGlobal('fetch', fetchMock)
    const result = await recordRiskFeedback('tenant-a', 'risk-1', {
      verdict: 'FALSE_POSITIVE',
      reason: 'CUSTOMER_ALREADY_BOOKED',
    })
    expect(result.datasetEligible).toBe(false)
    const request = fetchMock.mock.calls[0]![0]
    expect(request.method).toBe('POST')
    expect(new URL(request.url).pathname).toBe('/api/v1/risks/risk-1/feedback')
    expect(request.headers.has('Idempotency-Key')).toBe(false)
    expect(await request.json()).toEqual({
      verdict: 'FALSE_POSITIVE',
      reason: 'CUSTOMER_ALREADY_BOOKED',
    })
  })

  it('ошибка конверта превращается в ApiError с кодом', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: 'IDEMPOTENCY_CONFLICT', message: '', traceId: 't' } }, 409),
        ),
    )
    await expect(
      createAction('tenant-a', 'risk-1', 'key-1', { type: 'CALL' }),
    ).rejects.toMatchObject({
      httpStatus: 409,
      code: 'IDEMPOTENCY_CONFLICT',
    })
  })
})

describe('инвалидация после команд', () => {
  it('затрагивает карточку, ленты и сводку; исход — ещё сделку и аналитику', async () => {
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    await invalidateRisk(queryClient, 'tenant-a', 'risk-1')
    const keys = spy.mock.calls.map(([filters]) => queryKeyOf(filters))
    expect(keys).toEqual([
      riskKeys.detail('tenant-a', 'risk-1'),
      ['tenant', 'tenant-a', 'risks'],
      ['tenant', 'tenant-a', 'radar'],
    ])
    spy.mockClear()
    await invalidateRisk(queryClient, 'tenant-a', 'risk-1', { opportunity: true })
    expect(spy.mock.calls.map(([filters]) => queryKeyOf(filters))).toContainEqual([
      'tenant',
      'tenant-a',
      'analytics',
    ])
    expect(spy).toHaveBeenCalledTimes(5)
  })

  it('вердикт инвалидирует сделку, точность и аналитику', async () => {
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    await invalidateRisk(queryClient, 'tenant-a', 'risk-1', { feedback: true })
    const keys = spy.mock.calls.map(([filters]) => queryKeyOf(filters))
    expect(keys).toContainEqual(['tenant', 'tenant-a', 'precision'])
    expect(keys).toContainEqual(['tenant', 'tenant-a', 'opportunity'])
    expect(keys).toContainEqual(['tenant', 'tenant-a', 'analytics'])
    expect(spy).toHaveBeenCalledTimes(6)
  })

  it('ключ карточки не пересекается с префиксом лент', () => {
    expect(riskKeys.detail('t', 'r')).toEqual(['tenant', 't', 'risk', 'r'])
    expect(riskKeys.activeFeed('t', {})[2]).toBe('risks')
  })
})
