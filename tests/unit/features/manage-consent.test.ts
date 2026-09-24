import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore } from '@/entities/session'
import type { MLConsentStatus } from '@/entities/consent'
import { ConsentControls } from '@/features/manage-consent'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

const inactive: MLConsentStatus = { scope: 'DATASETS', active: false, consent: null }
const active: MLConsentStatus = {
  scope: 'DATASETS',
  active: true,
  consent: { id: 'c-1', scope: 'DATASETS', grantedBy: 'u', grantedAt: '2026-09-24T10:00:00Z' },
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

const body = () => new DOMWrapper(document.body)
const dialog = () => body().get('[role="dialog"]')
const buttonNamed = (root: { findAll: (s: string) => DOMWrapper<Element>[] }, text: string) =>
  root.findAll('button').find((button) => button.text() === text)!

describe('ConsentControls', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.mocked(fetchMe).mockResolvedValue({
      user: {
        id: 'u',
        email: 'o@b.c',
        displayName: 'Мария',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [{ tenantId: 'tenant-a', organizationName: 'A', role: 'OWNER' }],
    })
    await useSessionStore().bootstrap()
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  function mountControls(status: MLConsentStatus) {
    return mount(ConsentControls, {
      props: { tenantId: 'tenant-a', status },
      global: {
        plugins: [
          [
            VueQueryPlugin,
            { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          ],
        ],
      },
      attachTo: document.body,
    })
  }

  it('выдача подтверждается, 201 сообщает о новом согласии, повтор (200) — что оно уже действовало', async () => {
    fetchMock
      .mockImplementationOnce(async () => jsonResponse(active, 201))
      .mockImplementationOnce(async () => jsonResponse(active, 200))
    const wrapper = mountControls(inactive)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(dialog().text()).toContain('можно отозвать в любой момент')
    expect(dialog().text()).not.toMatch(/удал[её]н/i)
    await buttonNamed(dialog(), 'Дать согласие').trigger('click')
    await settle()
    expect(fetchMock.mock.calls[0]![0].method).toBe('POST')
    expect(wrapper.text()).toContain('Согласие выдано')
    expect(wrapper.emitted('changed')?.[0]).toEqual([active])

    await wrapper.get('button').trigger('click')
    await flushPromises()
    await buttonNamed(dialog(), 'Дать согласие').trigger('click')
    await settle()
    expect(wrapper.text()).toContain('уже действовало')
    wrapper.unmount()
  })

  it('отзыв объясняет, что история сохраняется, и уходит DELETE', async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }))
    const wrapper = mountControls(active)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(dialog().text()).toContain('история выдач остаётся в аудите')
    await buttonNamed(dialog(), 'Отозвать').trigger('click')
    await settle()
    expect(fetchMock.mock.calls[0]![0].method).toBe('DELETE')
    expect(wrapper.text()).toContain('Согласие отозвано')
    expect(wrapper.emitted('changed')?.[0]).toEqual([null])
    wrapper.unmount()
  })

  it('403 показывается без серверного текста и перечитывает сессию', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ error: { code: 'FORBIDDEN', message: 'raw', traceId: 't-3' } }, 403),
    )
    const refresh = vi.spyOn(useSessionStore(), 'refresh').mockResolvedValue()
    const wrapper = mountControls(inactive)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    await buttonNamed(dialog(), 'Дать согласие').trigger('click')
    await settle()
    const alert = dialog().get('[role="alert"]')
    expect(alert.text()).not.toContain('raw')
    expect(alert.text()).toContain('t-3')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('changed')).toBeUndefined()
    wrapper.unmount()
  })
})
