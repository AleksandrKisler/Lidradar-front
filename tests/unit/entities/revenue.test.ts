import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import { invalidateRisk, riskKeys } from '@/entities/risk'
import {
  ATTRIBUTION_TYPES,
  attributionDescription,
  attributionLabel,
  confirmRevenue,
  revenueKeys,
} from '@/entities/revenue'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const confirmation = {
  revenue: {
    id: 'rev-1',
    opportunityId: 'opp-1',
    amount: '31000.00',
    currency: 'RUB',
    status: 'CONFIRMED',
    source: 'USER_CONFIRMED',
    confirmedBy: 'user-1',
    confirmedAt: '2026-09-18T12:00:00Z',
  },
  attribution: {
    id: 'att-1',
    revenueEventId: 'rev-1',
    opportunityId: 'opp-1',
    type: 'RECOVERED',
    riskId: 'risk-1',
    actionId: 'act-1',
    outcomeId: 'out-1',
    createdAt: '2026-09-18T12:00:00Z',
  },
}

afterEach(() => vi.unstubAllGlobals())

describe('подтверждение выручки', () => {
  it('отправляет тело контракта с ключом идемпотентности и различает 201 и 200', async () => {
    const fetchMock = vi
      .fn<(request: Request) => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse(confirmation, 201))
      .mockResolvedValueOnce(jsonResponse(confirmation, 200))
    vi.stubGlobal('fetch', fetchMock)
    const body = {
      amount: '31000.00',
      currency: 'RUB',
      attributionType: 'RECOVERED' as const,
      riskId: 'risk-1',
      actionId: 'act-1',
      outcomeId: 'out-1',
    }
    const first = await confirmRevenue('tenant-a', 'opp-1', 'key-3', body)
    const second = await confirmRevenue('tenant-a', 'opp-1', 'key-3', body)
    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    expect(first.confirmation.attribution.type).toBe('RECOVERED')
    const request = fetchMock.mock.calls[0]![0]
    expect(request.method).toBe('POST')
    expect(new URL(request.url).pathname).toBe('/api/v1/opportunities/opp-1/revenue')
    expect(request.headers.get('X-Tenant-ID')).toBe('tenant-a')
    expect(request.headers.get('Idempotency-Key')).toBe('key-3')
    expect(await request.json()).toEqual(body)
  })

  it('409 по уже учтённой возвращённой выручке приходит как ApiError с кодом', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: 'RECOVERED_ALREADY_ATTRIBUTED', message: '', traceId: 't' } },
            409,
          ),
        ),
    )
    await expect(
      confirmRevenue('tenant-a', 'opp-1', 'key', {
        amount: '1.00',
        currency: 'RUB',
        attributionType: 'RECOVERED',
      }),
    ).rejects.toMatchObject({ httpStatus: 409, code: 'RECOVERED_ALREADY_ATTRIBUTED' })
  })

  it('подписи атрибуции и ключ выручки', () => {
    expect(ATTRIBUTION_TYPES).toEqual(['RECOVERED', 'ORGANIC', 'UNKNOWN'])
    expect(attributionLabel('RECOVERED')).toBe('Возвращённая выручка')
    expect(attributionLabel('ORGANIC')).toBe('Оплата без связи с риском')
    expect(attributionLabel('SOMETHING')).toBe('SOMETHING')
    expect(attributionDescription('UNKNOWN')).toContain('не доказана')
    expect(revenueKeys.scope('t')).toEqual(['tenant', 't', 'revenue'])
  })

  it('инвалидация после оплаты затрагивает аналитику и итоги выручки', async () => {
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    await invalidateRisk(queryClient, 'tenant-a', 'risk-1', { revenue: true })
    const keys = spy.mock.calls.map(
      ([filters]) => (filters as { queryKey?: readonly unknown[] } | undefined)?.queryKey,
    )
    expect(keys).toEqual([
      riskKeys.detail('tenant-a', 'risk-1'),
      ['tenant', 'tenant-a', 'risks'],
      ['tenant', 'tenant-a', 'radar'],
      ['tenant', 'tenant-a', 'analytics'],
      ['tenant', 'tenant-a', 'revenue'],
    ])
  })
})
