import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classifyAttempt,
  createBeaconSink,
  recordApiFailure,
  recordMutation,
  recordRouteTiming,
  resetTelemetry,
  setTelemetrySink,
  telemetryBuffer,
  templatePath,
} from '@/shared/observability'
import { createApiClient, unwrap } from '@/shared/api'
import { installRouteTimings } from '@/app/router'
import { createMemoryHistory, createRouter } from 'vue-router'
import { installTelemetry } from '@/app/config'

describe('телеметрия операций', () => {
  beforeEach(() => resetTelemetry())
  afterEach(() => {
    resetTelemetry()
    vi.unstubAllGlobals()
  })

  it('шаблон пути скрывает идентификаторы и отбрасывает query', () => {
    expect(
      templatePath(
        'http://x/api/v1/risks/01990000-0000-7000-8000-000000000301/actions?email=a@b.c',
      ),
    ).toBe('/api/v1/risks/{id}/actions')
    expect(templatePath('/api/v1/analytics/summary?from=2026-09-01#x')).toBe(
      '/api/v1/analytics/summary',
    )
    expect(templatePath('/orders/123456/items')).toBe('/orders/{id}/items')
    expect(templatePath('/risks/:riskId')).toBe('/risks/:riskId')
  })

  it('классифицирует попытку и очищает код и trace', () => {
    expect(classifyAttempt(0)).toBe('network')
    expect(classifyAttempt(0, 'TIMEOUT')).toBe('timeout')
    expect(classifyAttempt(403)).toBe('auth')
    expect(classifyAttempt(409)).toBe('conflict')
    expect(classifyAttempt(503)).toBe('server')
    expect(classifyAttempt(422)).toBe('client')
    const event = recordApiFailure({
      method: 'post',
      url: 'http://x/api/v1/opportunities/01990000-0000-7000-8000-000000000401/revenue?k=1',
      status: 409,
      code: 'secret <b>text</b>',
      traceId: 'trace with spaces',
    })
    expect(event).toMatchObject({
      kind: 'api.failure',
      method: 'POST',
      path: '/api/v1/opportunities/{id}/revenue',
      status: 409,
      code: 'UNKNOWN',
      traceId: null,
      attempt: 'conflict',
    })
    expect(Object.keys(event).sort()).toEqual(
      ['at', 'attempt', 'code', 'kind', 'method', 'path', 'status', 'traceId'].sort(),
    )
  })

  it('буфер ограничен, приёмник получает каждую запись', () => {
    const received: unknown[] = []
    setTelemetrySink((event) => received.push(event))
    for (let index = 0; index < 250; index += 1) recordRouteTiming('/radar', index)
    expect(telemetryBuffer()).toHaveLength(200)
    expect(received).toHaveLength(250)
    expect(
      recordMutation('confirm revenue!', 'error', 'RECOVERED_ALREADY_ATTRIBUTED'),
    ).toMatchObject({
      operation: 'confirmrevenue',
      status: 'error',
      code: 'RECOVERED_ALREADY_ATTRIBUTED',
    })
  })

  it('beacon-приёмник отправляет JSON без cookie-логики и не бросает', () => {
    const sendBeacon = vi.fn<(url: string, data?: BodyInit | null) => boolean>(() => true)
    vi.stubGlobal('navigator', { sendBeacon })
    const sink = createBeaconSink('https://telemetry.example.test/events')
    sink(recordRouteTiming('/radar', 12))
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(sendBeacon.mock.calls[0]![0]).toBe('https://telemetry.example.test/events')
    vi.stubGlobal('navigator', {
      sendBeacon: () => {
        throw new Error('blocked')
      },
    })
    expect(() => sink(recordRouteTiming('/radar', 1))).not.toThrow()
  })

  it('клиент записывает HTTP-сбой и сетевую ошибку, а не тело запроса', async () => {
    const fetchMock = vi
      .fn<(request: Request) => Promise<Response>>()
      .mockImplementationOnce(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: 'VALIDATION_FAILED', message: 'raw', traceId: 'tr-1' },
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
      )
      .mockImplementationOnce(async () => {
        throw new TypeError('offline')
      })
    const client = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock })
    await expect(
      unwrap(
        client.POST('/api/v1/risks/{riskId}/feedback', {
          params: {
            header: { 'X-Tenant-ID': 't-1' },
            path: { riskId: '01990000-0000-7000-8000-000000000301' },
          },
          body: { verdict: 'TRUE_POSITIVE', note: 'секретный текст' },
        }),
      ),
    ).rejects.toBeTruthy()
    await expect(
      unwrap(
        client.GET('/api/v1/risks', {
          params: { header: { 'X-Tenant-ID': 't-1' }, query: { limit: 5 } },
        }),
      ),
    ).rejects.toBeTruthy()
    const events = telemetryBuffer()
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      path: '/api/v1/risks/{id}/feedback',
      status: 400,
      code: 'VALIDATION_FAILED',
      traceId: 'tr-1',
      attempt: 'client',
    })
    expect(events[1]).toMatchObject({
      path: '/api/v1/risks',
      status: 0,
      code: 'NETWORK',
      attempt: 'network',
    })
    expect(JSON.stringify(events)).not.toContain('секретный')
    expect(JSON.stringify(events)).not.toContain('limit=5')
  })

  it('маршрутизатор записывает длительность по шаблону маршрута', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/risks/:riskId', name: 'risk', component: { template: '<div />' } }],
    })
    installRouteTimings(router)
    await router.push('/risks/01990000-0000-7000-8000-000000000301?tab=x')
    const timing = telemetryBuffer().find((event) => event.kind === 'route.timing')
    expect(timing).toMatchObject({ route: '/risks/:riskId' })
    expect(JSON.stringify(timing)).not.toContain('01990000')
  })

  it('установка приёмника: адрес — beacon, разработка — консоль, иначе ничего', () => {
    const log = vi.fn()
    installTelemetry({ endpoint: '', development: true, log })
    recordRouteTiming('/radar', 1)
    expect(log).toHaveBeenCalledTimes(1)
    installTelemetry({ endpoint: '', development: false })
    recordRouteTiming('/radar', 1)
    expect(log).toHaveBeenCalledTimes(1)
  })
})
