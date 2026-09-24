import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BOT_TOKEN_PATTERN,
  CONNECTABLE_PROVIDERS,
  capabilityLabel,
  checkConnectionHealth,
  connectChannel,
  connectionErrorLabel,
  connectionStatusLabel,
  connectionStatusTone,
  disconnectChannel,
  fetchConnectionHealth,
  fetchConnections,
  integrationKeys,
  providerLabel,
  verificationLabel,
} from '@/entities/integration'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('подписи интеграций', () => {
  it('провайдеры, статусы, возможности, коды и проверки', () => {
    expect(CONNECTABLE_PROVIDERS).toEqual(['CONNECTED_BUSINESS_BOT', 'GENERIC_WEBHOOK'])
    expect(providerLabel('CONNECTED_BUSINESS_BOT')).toBe('Telegram · бизнес-бот')
    expect(providerLabel('NEW')).toBe('NEW')
    expect(connectionStatusLabel('DEGRADED')).toBe('С перебоями')
    expect(connectionStatusTone('ERROR')).toBe('danger')
    expect(connectionStatusTone('UNKNOWN')).toBe('neutral')
    expect(capabilityLabel('CAN_RECEIVE_ATTACHMENTS')).toBe('вложения')
    expect(connectionErrorLabel('TELEGRAM_WEBHOOK_MISMATCH')).toContain('не на LidRadar')
    expect(connectionErrorLabel('SOMETHING_ELSE')).toBe('SOMETHING_ELSE')
    expect(verificationLabel('REMOTE')).toContain('опрошен')
    expect(BOT_TOKEN_PATTERN.test('123456789:AAHf1234567890abcdefghijklmnop')).toBe(true)
    expect(BOT_TOKEN_PATTERN.test('token')).toBe(false)
    expect(integrationKeys.health('t', 'c')).toEqual(['tenant', 't', 'integrations', 'c', 'health'])
  })
})

describe('запросы интеграций', () => {
  it('подключает по провайдеру, отключает, читает и проверяет здоровье', async () => {
    const connection = {
      id: 'conn-1',
      locationId: null,
      provider: 'GENERIC_WEBHOOK',
      name: 'CRM',
      status: 'ACTIVE',
      capabilities: ['CAN_RECEIVE_MESSAGES'],
      lastEventAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorCode: null,
      createdAt: '2026-09-24T00:00:00Z',
      updatedAt: '2026-09-24T00:00:00Z',
    }
    const health = {
      status: 'ACTIVE',
      lastEventAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorCode: null,
      checkedAt: '2026-09-24T00:01:00Z',
    }
    const fetchMock = vi
      .fn<(request: Request) => Promise<Response>>()
      .mockImplementation((request) => {
        const path = new URL(request.url).pathname
        if (request.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }))
        if (path.endsWith('/connect')) {
          return Promise.resolve(
            jsonResponse({ ...connection, webhookSecret: 'issued-secret-0123456789' }, 201),
          )
        }
        if (path.endsWith('/health/check'))
          return Promise.resolve(jsonResponse({ health, verification: 'LOCAL' }))
        if (path.endsWith('/health')) return Promise.resolve(jsonResponse(health))
        return Promise.resolve(jsonResponse({ items: [connection] }))
      })
    vi.stubGlobal('fetch', fetchMock)

    const list = await fetchConnections('t')
    expect(list).toHaveLength(1)
    const created = await connectChannel('t', 'GENERIC_WEBHOOK', { name: 'CRM', locationId: null })
    expect(created.webhookSecret).toBe('issued-secret-0123456789')
    await disconnectChannel('t', 'conn-1')
    const snapshot = await fetchConnectionHealth('t', 'conn-1')
    expect(snapshot.checkedAt).toBe('2026-09-24T00:01:00Z')
    const check = await checkConnectionHealth('t', 'conn-1')
    expect(check.verification).toBe('LOCAL')

    const calls = fetchMock.mock.calls.map(
      ([request]) => `${request.method} ${new URL(request.url).pathname}`,
    )
    expect(calls).toEqual([
      'GET /api/v1/integrations',
      'POST /api/v1/integrations/GENERIC_WEBHOOK/connect',
      'DELETE /api/v1/integrations/conn-1',
      'GET /api/v1/integrations/conn-1/health',
      'POST /api/v1/integrations/conn-1/health/check',
    ])
    expect(await fetchMock.mock.calls[1]![0].json()).toEqual({ name: 'CRM', locationId: null })
    for (const [request] of fetchMock.mock.calls) {
      expect(request.headers.get('X-Tenant-ID')).toBe('t')
    }
  })
})
