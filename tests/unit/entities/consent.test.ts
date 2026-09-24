import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  consentKeys,
  consentState,
  fetchConsent,
  grantConsent,
  revokeConsent,
  type MLConsentStatus,
} from '@/entities/consent'

const active: MLConsentStatus = {
  scope: 'DATASETS',
  active: true,
  consent: { id: 'c-1', scope: 'DATASETS', grantedBy: 'u-1', grantedAt: '2026-09-24T10:00:00Z' },
}

describe('ML-согласие', () => {
  it('различает действующее, отозванное и никогда не выдававшееся', () => {
    expect(consentState(active)).toBe('active')
    expect(
      consentState({
        scope: 'DATASETS',
        active: false,
        consent: { ...active.consent!, revokedBy: 'u-1', revokedAt: '2026-09-25T10:00:00Z' },
      }),
    ).toBe('revoked')
    expect(consentState({ scope: 'DATASETS', active: false, consent: null })).toBe('never')
  })

  describe('запросы', () => {
    let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
    const respond = (body: unknown, status = 200) =>
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })

    beforeEach(() => {
      fetchMock = vi.fn<(request: Request) => Promise<Response>>()
      vi.stubGlobal('fetch', fetchMock)
    })
    afterEach(() => vi.unstubAllGlobals())

    it('ключ лежит в области организации, чтение идёт с заголовком', async () => {
      expect(consentKeys.status('t-1')).toEqual(['tenant', 't-1', 'ml-consent'])
      fetchMock.mockImplementation(async () => respond(active))
      expect(await fetchConsent('t-1')).toEqual(active)
      const request = fetchMock.mock.calls[0]![0]
      expect(new URL(request.url).pathname).toBe('/api/v1/organization/ml-consent')
      expect(request.headers.get('X-Tenant-ID')).toBe('t-1')
    })

    it('выдача различает новое согласие (201) и повтор (200); отзыв — 204 без тела', async () => {
      fetchMock
        .mockImplementationOnce(async () => respond(active, 201))
        .mockImplementationOnce(async () => respond(active, 200))
        .mockImplementationOnce(async () => new Response(null, { status: 204 }))
      expect(await grantConsent('t-1')).toEqual({ status: active, alreadyActive: false })
      expect(await grantConsent('t-1')).toEqual({ status: active, alreadyActive: true })
      expect(fetchMock.mock.calls[0]![0].method).toBe('POST')
      await revokeConsent('t-1')
      expect(fetchMock.mock.calls[2]![0].method).toBe('DELETE')
    })
  })
})
