import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore } from '@/entities/session'
import { resetApiContext, setApiContext } from '@/shared/api'
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
      canCreateOrganization: false,
      user: {
        emailVerifiedAt: null,
        deletionDueAt: null,
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
      .find((button) => button.text() === 'Изменить этап')!
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

  it('перечитывание при том же этапе сохраняет выбор и ничего не объясняет', async () => {
    const wrapper = mountControl('NEW')
    await wrapper.get('select').setValue('QUALIFYING')
    // Фоновое перечитывание отдаёт тот же этап: компонент получает те же свойства снова.
    await wrapper.setProps({ currentStage: 'NEW' as never })
    expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('QUALIFYING')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).not.toContain('выбор сброшен')
    expect(fetchMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('смена этапа на сервере обновляет переходы, сбрасывает выбор с объяснением и ничего не отправляет', async () => {
    const wrapper = mountControl('NEW')
    await wrapper.get('select').setValue('QUALIFYING')
    await wrapper.setProps({ currentStage: 'BOOKED' as never })
    expect(optionValues(wrapper)).toEqual(['WON', 'LOST'])
    expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="status"]').text()).toContain('«Записан»')
    expect(wrapper.get('[role="status"]').text()).toContain('выбор сброшен')
    // Недопустимое значение (его нет в списке) не отправляется даже при прямом вызове.
    await wrapper.get('select').setValue('QUALIFYING')
    await wrapper.get('button').trigger('click')
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('без выбора смена этапа ничего не объясняет, новый выбор убирает пояснение', async () => {
    const wrapper = mountControl('NEW')
    await wrapper.setProps({ currentStage: 'ENGAGED' as never })
    expect(wrapper.text()).not.toContain('выбор сброшен')
    await wrapper.get('select').setValue('QUALIFYING')
    await wrapper.setProps({ currentStage: 'PRICE_SENT' as never })
    expect(wrapper.text()).toContain('выбор сброшен')
    await wrapper.get('select').setValue('WAITING_CUSTOMER')
    expect(wrapper.text()).not.toContain('выбор сброшен')
    wrapper.unmount()
  })

  it('открытый диалог закрытия закрывается при смене этапа, пояснение видно, пустого окна нет', async () => {
    const wrapper = mountControl('NEW')
    await wrapper.get('select').setValue('LOST')
    await wrapper.get('button').trigger('click')
    await settle()
    expect(body().find('[role="dialog"]').exists()).toBe(true)
    await wrapper.setProps({ currentStage: 'BOOKED' as never })
    await settle()
    expect(body().find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toContain('«Записан»')
    expect(fetchMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('пояснение обновляется при следующей смене этапа и не называет устаревший этап', async () => {
    const wrapper = mountControl('NEW')
    await wrapper.get('select').setValue('QUALIFYING')
    await wrapper.setProps({ currentStage: 'ENGAGED' as never })
    expect(wrapper.get('[role="status"]').text()).toContain('«В диалоге»')
    await wrapper.setProps({ currentStage: 'PRICE_SENT' as never })
    const text = wrapper.get('[role="status"]').text()
    expect(text).toContain('«Цена отправлена»')
    expect(text).not.toContain('«В диалоге»')
    wrapper.unmount()
  })

  it('другая сделка в том же компоненте не наследует выбор, пояснение и ошибку', async () => {
    const wrapper = mountControl('NEW')
    await wrapper.get('select').setValue('QUALIFYING')
    await wrapper.setProps({ riskId: 'risk-2', opportunityId: 'opp-2' })
    expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).not.toContain('выбор сброшен')
    wrapper.unmount()
  })

  it('этап пришёл во время собственной отправки: пояснения «перевели» нет', async () => {
    let release!: (response: Response) => void
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (release = resolve)))
    const wrapper = mountControl('NEW')
    await wrapper.get('select').setValue('ENGAGED')
    await wrapper.get('button').trigger('click')
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ currentStage: 'ENGAGED' as never })
    release(jsonResponse({ id: 'opp-1', stage: 'ENGAGED' }))
    await settle()
    expect(wrapper.text()).not.toContain('выбор сброшен')
    expect(wrapper.emitted('changed')?.[0]).toEqual(['ENGAGED'])
    wrapper.unmount()
  })

  it('ответ по прежней сделке не стирает выбор и не блокирует отправку по новой', async () => {
    const pending: Array<(response: Response) => void> = []
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => pending.push(resolve)))
    const wrapper = mountControl('NEW')
    await wrapper.get('select').setValue('ENGAGED')
    await wrapper.get('button').trigger('click')
    await settle()
    await wrapper.setProps({ riskId: 'risk-2', opportunityId: 'opp-2' })
    await wrapper.get('select').setValue('QUALIFYING')
    pending[0]!(jsonResponse({ id: 'opp-1', stage: 'ENGAGED' }))
    await settle()
    // Ответ по сделке A выбор для B не тронул и не выдал «changed» в чужой контекст.
    expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('QUALIFYING')
    expect(wrapper.emitted('changed')).toBeUndefined()
    await wrapper.get('button').trigger('click')
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(new URL(fetchMock.mock.calls[1]![0].url).pathname).toBe('/api/v1/opportunities/opp-2')
    pending[1]!(jsonResponse({ id: 'opp-2', stage: 'QUALIFYING' }))
    await settle()
    wrapper.unmount()
  })

  it('смена сделки очищает ошибку прежней отправки, закрывает диалог и убирает пояснение', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(
        { error: { code: 'INVALID_STAGE_TRANSITION', message: 'x', traceId: 't' } },
        409,
      ),
    )
    const wrapper = mountControl('NEW')
    // Пояснение от прежней сделки.
    await wrapper.get('select').setValue('QUALIFYING')
    await wrapper.setProps({ currentStage: 'ENGAGED' as never })
    expect(wrapper.text()).toContain('выбор сброшен')
    // Ошибка отправки по прежней сделке (409 реально получен).
    await wrapper.get('select').setValue('PRICE_SENT')
    await wrapper.get('button').trigger('click')
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Этап уже изменился')
    // Открытый диалог закрытия.
    await wrapper.get('select').setValue('LOST')
    await wrapper.get('button').trigger('click')
    await settle()
    expect(body().find('[role="dialog"]').exists()).toBe(true)
    await wrapper.setProps({ riskId: 'risk-2', opportunityId: 'opp-2' })
    await settle()
    expect(body().find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('выбор сброшен')
    expect(wrapper.text()).not.toContain('Этап уже изменился')
    expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('ошибка отправки по прежней сделке исчезает при переключении на другую', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(
        { error: { code: 'INVALID_STAGE_TRANSITION', message: 'x', traceId: 't' } },
        409,
      ),
    )
    const wrapper = mountControl('NEW')
    await wrapper.get('select').setValue('ENGAGED')
    await wrapper.get('button').trigger('click')
    await settle()
    expect(wrapper.text()).toContain('Этап уже изменился')
    await wrapper.setProps({ riskId: 'risk-2', opportunityId: 'opp-2' })
    expect(wrapper.text()).not.toContain('Этап уже изменился')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('поздний 409 или 500 по прежней сделке ничего не меняет у новой', async () => {
    for (const status of [409, 500]) {
      const pending: Array<(response: Response) => void> = []
      fetchMock.mockReset()
      fetchMock.mockImplementation(() => new Promise<Response>((resolve) => pending.push(resolve)))
      const wrapper = mountControl('NEW')
      await wrapper.get('select').setValue('ENGAGED')
      await wrapper.get('button').trigger('click')
      await settle()
      await wrapper.setProps({ riskId: 'risk-2', opportunityId: 'opp-2' })
      await wrapper.get('select').setValue('QUALIFYING')
      pending[0]!(
        jsonResponse(
          {
            error: {
              code: status === 409 ? 'INVALID_STAGE_TRANSITION' : 'INTERNAL',
              message: 'x',
              traceId: 't',
            },
          },
          status,
        ),
      )
      await settle()
      // У новой сделки нет ошибки, выбор цел, кнопка активна и не в состоянии отправки.
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('QUALIFYING')
      expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
      expect(wrapper.get('button').attributes('aria-busy')).not.toBe('true')
      expect(wrapper.emitted('changed')).toBeUndefined()
      expect(body().find('[role="dialog"]').exists()).toBe(false)
      wrapper.unmount()
    }
  })

  it('ответ по прежней сделке перечитывает именно прежнюю карточку, а не открытую сейчас', async () => {
    let release!: (response: Response) => void
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (release = resolve)))
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const wrapper = mountControl('NEW')
    await wrapper.get('select').setValue('ENGAGED')
    await wrapper.get('button').trigger('click')
    await settle()
    await wrapper.setProps({ riskId: 'risk-2', opportunityId: 'opp-2' })
    release(jsonResponse({ id: 'opp-1', stage: 'ENGAGED' }))
    await settle()
    const keys = invalidate.mock.calls.map(([f]) =>
      JSON.stringify((f as { queryKey?: unknown }).queryKey),
    )
    expect(keys).toContain(JSON.stringify(['tenant', 'tenant-a', 'risk', 'risk-1']))
    expect(keys).not.toContain(JSON.stringify(['tenant', 'tenant-a', 'risk', 'risk-2']))
    wrapper.unmount()
  })

  // Нажатие и переключение контекста происходят в одном синхронном блоке: запрос ещё не ушёл в fetch.
  const requestOf = (index = 0) => {
    const request = fetchMock.mock.calls[index]![0]
    return { path: new URL(request.url).pathname, tenant: request.headers.get('X-Tenant-ID') }
  }

  it('нажатие в сделке A и немедленное переключение на B: запрос уходит строго в A', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ id: 'opp-1', stage: 'ENGAGED' }))
    const wrapper = mountControl('NEW')
    await wrapper.get('select').setValue('ENGAGED')
    const click = wrapper.get('button').trigger('click')
    const switched = wrapper.setProps({ riskId: 'risk-2', opportunityId: 'opp-2' })
    await Promise.all([click, switched])
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(requestOf()).toEqual({ path: '/api/v1/opportunities/opp-1', tenant: 'tenant-a' })
    const request = fetchMock.mock.calls[0]![0]
    expect(request.method).toBe('PATCH')
    expect(await request.clone().json()).toEqual({ stage: 'ENGAGED' })
    wrapper.unmount()
  })

  it('одновременная смена организации и сделки: ни один запрос не уходит в B, A не смешивается с B', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ id: 'opp-1', stage: 'ENGAGED' }))
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const session = useSessionStore()
    session.$patch({
      memberships: [
        { tenantId: 'tenant-a', organizationName: 'A', role: 'MANAGER' },
        { tenantId: 'tenant-b', organizationName: 'B', role: 'MANAGER' },
      ],
    })
    const wrapper = mountControl('NEW')
    await wrapper.get('select').setValue('ENGAGED')
    const click = wrapper.get('button').trigger('click')
    session.selectTenant('tenant-b')
    const switched = wrapper.setProps({ riskId: 'risk-2', opportunityId: 'opp-2' })
    await Promise.all([click, switched])
    await settle()
    for (const index of fetchMock.mock.calls.keys()) {
      // Любой ушедший запрос целиком относится к A: путь, заголовок и тело.
      expect(requestOf(index)).toEqual({ path: '/api/v1/opportunities/opp-1', tenant: 'tenant-a' })
      expect(await fetchMock.mock.calls[index]![0].clone().json()).toEqual({ stage: 'ENGAGED' })
    }
    // Перечитывание, если оно было, относится только к контексту выполненной команды.
    const keys = invalidate.mock.calls.map(([f]) =>
      JSON.stringify((f as { queryKey?: unknown }).queryKey),
    )
    for (const key of keys) expect(key).not.toContain('tenant-b')
    expect(keys).not.toContain(JSON.stringify(['tenant', 'tenant-a', 'risk', 'risk-2']))
    wrapper.unmount()
  })

  it('с реальным контекстом API: после смены организации запись в A блокируется клиентом, форма B чистая', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ id: 'opp-1', stage: 'ENGAGED' }))
    const session = useSessionStore()
    session.$patch({
      memberships: [
        { tenantId: 'tenant-a', organizationName: 'A', role: 'MANAGER' },
        { tenantId: 'tenant-b', organizationName: 'B', role: 'MANAGER' },
      ],
    })
    setApiContext({ tenantId: () => session.tenantId })
    try {
      const wrapper = mountControl('NEW')
      await wrapper.get('select').setValue('ENGAGED')
      const click = wrapper.get('button').trigger('click')
      session.selectTenant('tenant-b')
      const switched = wrapper.setProps({ riskId: 'risk-2', opportunityId: 'opp-2' })
      await Promise.all([click, switched])
      await settle()
      // Клиент не отправил запись с заголовком A, пока выбрана B; в B ничего не ушло.
      expect(fetchMock).not.toHaveBeenCalled()
      // У новой формы нет ошибки, выбора и состояния отправки от прежней команды.
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('')
      expect(wrapper.get('button').attributes('aria-busy')).not.toBe('true')
      wrapper.unmount()
    } finally {
      resetApiContext()
    }
  })

  it('после позднего ответа A выбор в B цел и отправка по B идёт в B', async () => {
    const pending: Array<(response: Response) => void> = []
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => pending.push(resolve)))
    const wrapper = mountControl('NEW')
    await wrapper.get('select').setValue('ENGAGED')
    await wrapper.get('button').trigger('click')
    await settle()
    await wrapper.setProps({ riskId: 'risk-2', opportunityId: 'opp-2' })
    await wrapper.get('select').setValue('QUALIFYING')
    pending[0]!(jsonResponse({ id: 'opp-1', stage: 'ENGAGED' }))
    await settle()
    expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('QUALIFYING')
    await wrapper.get('button').trigger('click')
    await settle()
    expect(requestOf(1)).toEqual({ path: '/api/v1/opportunities/opp-2', tenant: 'tenant-a' })
    expect(await fetchMock.mock.calls[1]![0].clone().json()).toEqual({ stage: 'QUALIFYING' })
    pending[1]!(jsonResponse({ id: 'opp-2', stage: 'QUALIFYING' }))
    await settle()
    wrapper.unmount()
  })

  it('из архива переходов нет', () => {
    const wrapper = mountControl('ARCHIVED')
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.text()).toContain('Переходов с этого этапа нет')
    wrapper.unmount()
  })
})
