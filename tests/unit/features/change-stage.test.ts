import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore } from '@/entities/session'
import { StageChangeControl } from '@/features/change-opportunity-stage'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

const body = () => new DOMWrapper(document.body)
const optionValues = (wrapper: ReturnType<typeof mount>) =>
  wrapper
    .findAll('option')
    .map((option) => option.attributes('value'))
    .filter(Boolean)

describe('StageChangeControl', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
  let queryClient: QueryClient

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.mocked(fetchMe).mockResolvedValue({
      user: {
        id: 'u',
        email: 'a@b.c',
        displayName: 'A',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [{ tenantId: 'tenant-a', organizationName: 'A', role: 'MANAGER' }],
    })
    await useSessionStore().bootstrap()
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  function mountControl(currentStage: string) {
    return mount(StageChangeControl, {
      props: { riskId: 'risk-1', opportunityId: 'opp-1', currentStage: currentStage as never },
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
      attachTo: document.body,
    })
  }

  it('предлагает только разрешённые цели и переводит на активный этап без диалога', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ id: 'opp-1', stage: 'ENGAGED' }))
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const wrapper = mountControl('NEW')
    expect(optionValues(wrapper)).toEqual([
      'ENGAGED',
      'QUALIFYING',
      'PRICE_SENT',
      'WAITING_CUSTOMER',
      'WAITING_BUSINESS',
      'BOOKING_INTENT',
      'BOOKED',
      'LOST',
    ])
    await wrapper.get('select').setValue('ENGAGED')
    await wrapper.get('button').trigger('click')
    await settle()
    expect(body().find('[role="dialog"]').exists()).toBe(false)
    const request = fetchMock.mock.calls[0]![0]
    expect(request.method).toBe('PATCH')
    expect(new URL(request.url).pathname).toBe('/api/v1/opportunities/opp-1')
    expect(await request.json()).toEqual({ stage: 'ENGAGED' })
    const keys = invalidate.mock.calls.map(([f]) =>
      JSON.stringify((f as { queryKey?: unknown }).queryKey),
    )
    expect(keys).toContain(JSON.stringify(['tenant', 'tenant-a', 'opportunity']))
    expect(keys).toContain(JSON.stringify(['tenant', 'tenant-a', 'risk', 'risk-1']))
    expect(keys).toContain(JSON.stringify(['tenant', 'tenant-a', 'analytics']))
    expect(wrapper.emitted('changed')?.[0]).toEqual(['ENGAGED'])
    wrapper.unmount()
  })

  it('закрывающий переход требует подтверждения с последствиями', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ id: 'opp-1', stage: 'LOST' }))
    const wrapper = mountControl('BOOKED')
    expect(optionValues(wrapper)).toEqual(['WON', 'LOST'])
    await wrapper.get('select').setValue('LOST')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    const dialog = body().get('[role="dialog"]')
    expect(dialog.text()).toContain('вернуть её в работу нельзя')
    expect(fetchMock).not.toHaveBeenCalled()
    await dialog
      .findAll('button')
      .find((button) => button.text() === 'Перевести')!
      .trigger('click')
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('changed')?.[0]).toEqual(['LOST'])
    wrapper.unmount()
  })

  it('409 объясняет, что этап уже изменился, и перечитывает сделку без заявления успеха', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(
        { error: { code: 'INVALID_STAGE_TRANSITION', message: 'raw', traceId: 't-2' } },
        409,
      ),
    )
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const wrapper = mountControl('NEW')
    await wrapper.get('select').setValue('QUALIFYING')
    await wrapper.get('button').trigger('click')
    await settle()
    const alert = wrapper.get('[role="alert"], [role="status"]')
    expect(alert.text()).toContain('Этап уже изменился')
    expect(alert.text()).not.toContain('raw')
    expect(wrapper.emitted('changed')).toBeUndefined()
    const keys = invalidate.mock.calls.map(([f]) =>
      JSON.stringify((f as { queryKey?: unknown }).queryKey),
    )
    expect(keys).toContain(JSON.stringify(['tenant', 'tenant-a', 'opportunity']))
    wrapper.unmount()
  })

  it('из архива переходов нет', () => {
    const wrapper = mountControl('ARCHIVED')
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.text()).toContain('Переходов с этого этапа нет')
    wrapper.unmount()
  })
})
