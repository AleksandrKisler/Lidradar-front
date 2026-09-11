import { afterEach, expect, it, vi } from 'vitest'
import { getJson, HttpError } from '@/shared/api'
afterEach(() => vi.unstubAllGlobals())
it('returns JSON with Accept header and cancellation', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}'))
  vi.stubGlobal('fetch', fetchMock)
  const controller = new AbortController()
  expect(await getJson('/health', controller.signal)).toEqual({ ok: true })
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/health',
    expect.objectContaining({ signal: controller.signal, credentials: 'same-origin' }),
  )
})
it('exposes status without leaking response body', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private', { status: 503 })))
  await expect(getJson('health')).rejects.toMatchObject({ status: 503, name: 'HttpError' })
  expect(new HttpError(401).message).toBe('HTTP 401')
})
it('propagates network failures', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
  await expect(getJson('/health')).rejects.toThrow('offline')
})
