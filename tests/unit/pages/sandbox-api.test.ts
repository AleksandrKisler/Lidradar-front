import { afterEach, describe, expect, it, vi } from 'vitest'
import { sandboxApi, type Draft, type Send } from '@/pages/sandbox/api/sandbox-api'

const sandboxId = '01990000-0000-7000-8000-000000000901'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

afterEach(() => vi.unstubAllGlobals())

describe('sandbox v2 transport: сохранённые проверки stage', () => {
  it('читает четыре ресурса с tenant header и правильными путями', async () => {
    const fetchMock = vi
      .fn<(request: Request) => Promise<Response>>()
      .mockResolvedValueOnce(json({ enabled: true }))
      .mockResolvedValueOnce(json({ items: [] }))
      .mockResolvedValueOnce(json({ items: [] }))
      .mockResolvedValueOnce(json({ id: sandboxId }))
    vi.stubGlobal('fetch', fetchMock)
    expect((await sandboxApi.overview('tenant-a')).enabled).toBe(true)
    expect((await sandboxApi.templates('tenant-a')).items).toEqual([])
    expect((await sandboxApi.list('tenant-a')).items).toEqual([])
    expect((await sandboxApi.detail('tenant-a', sandboxId)).id).toBe(sandboxId)
    const requests = fetchMock.mock.calls.map(([request]) => request)
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      '/api/v1/sandbox',
      '/api/v1/sandbox/templates',
      '/api/v1/sandbox/conversations',
      `/api/v1/sandbox/conversations/${sandboxId}`,
    ])
    expect(requests.every((request) => request.method === 'GET')).toBe(true)
    expect(requests.every((request) => request.headers.get('X-Tenant-ID') === 'tenant-a')).toBe(
      true,
    )
  })

  it('принимает 201/200 и повторяет исходные key/body, не меняя ресурс отправки', async () => {
    const fetchMock = vi
      .fn<(request: Request) => Promise<Response>>()
      .mockImplementationOnce(async () => json({ id: sandboxId }, 201))
      .mockImplementationOnce(async () => json({ id: sandboxId }, 200))
      .mockImplementationOnce(async () => json({ id: sandboxId }, 201))
    vi.stubGlobal('fetch', fetchMock)
    const body: Draft = {
      locationId: '01990000-0000-7000-8000-000000000201',
      templateCode: 'empty',
      tailMinutes: 0,
      messages: [{ direction: 'INCOMING', text: 'Да', pauseBeforeMinutes: 0 }],
    }
    const sendBody: Send = { direction: 'OUTGOING', text: 'Ждём' }
    expect((await sandboxApi.create('tenant-a', body, 'key-1')).id).toBe(sandboxId)
    expect((await sandboxApi.create('tenant-a', body, 'key-1')).id).toBe(sandboxId)
    expect((await sandboxApi.send('tenant-a', sandboxId, sendBody, 'key-2')).id).toBe(sandboxId)
    const requests = fetchMock.mock.calls.map(([request]) => request)
    for (const request of requests) {
      expect(request.method).toBe('POST')
      expect(request.headers.get('X-Tenant-ID')).toBe('tenant-a')
    }
    for (const request of requests.slice(0, 2)) {
      expect(new URL(request.url).pathname).toBe('/api/v1/sandbox/conversations')
      expect(request.headers.get('Idempotency-Key')).toBe('key-1')
      expect(await request.json()).toEqual(body)
    }
    expect(new URL(requests[2]!.url).pathname).toBe(
      `/api/v1/sandbox/conversations/${sandboxId}/messages`,
    )
    expect(requests[2]!.headers.get('Idempotency-Key')).toBe('key-2')
    expect(await requests[2]!.json()).toEqual(sendBody)
  })
})
