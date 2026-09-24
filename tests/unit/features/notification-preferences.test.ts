import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { NotificationPreference } from '@/entities/notification'
import { PreferenceEditor } from '@/features/edit-notification-preference'

const preference: NotificationPreference = {
  riskType: 'PROMISE_NOT_FULFILLED',
  minimumSeverity: 'MEDIUM',
  deliveryMode: 'IMMEDIATE',
  inAppEnabled: true,
  telegramEnabled: false,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  digestTime: '09:00',
  timezone: 'Europe/Moscow',
  isDefault: true,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const body = () => new DOMWrapper(document.body)

function mountEditor(overrides: Partial<NotificationPreference> = {}, telegramLinked = false) {
  return mount(PreferenceEditor, {
    props: {
      tenantId: 'tenant-a',
      preference: { ...preference, ...overrides },
      telegramLinked,
      timeZone: 'Europe/Moscow',
    },
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

const submitButton = (wrapper: ReturnType<typeof mountEditor>) =>
  wrapper.get('button[type="submit"]')

describe('PreferenceEditor', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>

  beforeEach(() => {
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('без изменений не отправляет, отличает значение по умолчанию и не предлагает сброс', async () => {
    const wrapper = mountEditor()
    expect(wrapper.text()).toContain('По умолчанию')
    expect(wrapper.text()).not.toContain('Вернуть по умолчанию')
    expect(submitButton(wrapper).attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('проверяет тихие часы локально: одинаковые границы не уходят на сервер', async () => {
    const wrapper = mountEditor()
    await wrapper.get('input[name="quiet-PROMISE_NOT_FULFILLED"]').setValue(true)
    await wrapper.get('input[name="quiet-start-PROMISE_NOT_FULFILLED"]').setValue('22:00')
    await wrapper.get('input[name="quiet-end-PROMISE_NOT_FULFILLED"]').setValue('22:00')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Границы тихих часов должны различаться')
    await wrapper.get('input[name="quiet-end-PROMISE_NOT_FULFILLED"]').setValue('07:00')
    expect(wrapper.text()).toContain('22:00–07:00, через полночь')
    wrapper.unmount()
  })

  it('отправляет полное тело PUT и сообщает об успехе', async () => {
    fetchMock.mockImplementation(async (request) =>
      request.method === 'PUT'
        ? jsonResponse({
            ...preference,
            deliveryMode: 'DIGEST',
            digestTime: '10:30',
            quietHoursEnabled: true,
            quietHoursStart: '22:00',
            quietHoursEnd: '07:00',
            isDefault: false,
            updatedAt: '2026-09-24T10:00:00Z',
          })
        : jsonResponse({ items: [] }),
    )
    const wrapper = mountEditor()
    await wrapper.get('select[name="mode-PROMISE_NOT_FULFILLED"]').setValue('DIGEST')
    await wrapper.get('input[name="digest-PROMISE_NOT_FULFILLED"]').setValue('10:30')
    await wrapper.get('input[name="quiet-PROMISE_NOT_FULFILLED"]').setValue(true)
    await wrapper.get('input[name="quiet-start-PROMISE_NOT_FULFILLED"]').setValue('22:00')
    await wrapper.get('input[name="quiet-end-PROMISE_NOT_FULFILLED"]').setValue('07:00')
    expect(submitButton(wrapper).attributes('disabled')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const put = fetchMock.mock.calls.find(([request]) => request.method === 'PUT')![0]
    expect(new URL(put.url).pathname).toBe(
      '/api/v1/notifications/preferences/PROMISE_NOT_FULFILLED',
    )
    expect(put.headers.get('X-Tenant-ID')).toBe('tenant-a')
    expect(await put.json()).toEqual({
      minimumSeverity: 'MEDIUM',
      deliveryMode: 'DIGEST',
      inAppEnabled: true,
      telegramEnabled: false,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      digestTime: '10:30',
    })
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(wrapper.text()).toContain('Настройка сохранена')
    wrapper.unmount()
  })

  it('предупреждает о Telegram без привязки и молчит при активной привязке', async () => {
    const unlinked = mountEditor()
    await unlinked.get('input[name="telegram-PROMISE_NOT_FULFILLED"]').setValue(true)
    expect(unlinked.get('[role="status"]').text()).toContain('Telegram не привязан')
    unlinked.unmount()
    const linked = mountEditor({}, true)
    await linked.get('input[name="telegram-PROMISE_NOT_FULFILLED"]').setValue(true)
    expect(linked.find('[role="status"]').exists()).toBe(false)
    linked.unmount()
  })

  it('сброс к значению по умолчанию — DELETE после подтверждения', async () => {
    fetchMock.mockImplementation(async (request) =>
      request.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : jsonResponse({ items: [] }),
    )
    const wrapper = mountEditor({ isDefault: false, updatedAt: '2026-09-24T08:00:00Z' })
    expect(wrapper.text()).toContain('Настроено вами')
    expect(wrapper.text()).toContain('изменено 24 сент.')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Вернуть по умолчанию')!
      .trigger('click')
    await flushPromises()
    const dialog = body().get('[role="dialog"]')
    await dialog
      .findAll('button')
      .find((button) => button.text() === 'Вернуть')!
      .trigger('click')
    await flushPromises()
    const del = fetchMock.mock.calls.find(([request]) => request.method === 'DELETE')![0]
    expect(new URL(del.url).pathname).toBe(
      '/api/v1/notifications/preferences/PROMISE_NOT_FULFILLED',
    )
    expect(wrapper.emitted('reset')).toHaveLength(1)
    wrapper.unmount()
  })

  it('ошибка PUT объясняется по коду без серверного текста', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'VALIDATION_FAILED', message: 'raw', traceId: 't-9' } }, 400),
    )
    const wrapper = mountEditor()
    await wrapper.get('select[name="mode-PROMISE_NOT_FULFILLED"]').setValue('DISABLED')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).not.toContain('raw')
    expect(alert.text()).toContain('t-9')
    expect(wrapper.emitted('saved')).toBeUndefined()
    wrapper.unmount()
  })

  it('перечитанный список с той же настройкой не стирает черновик, изменённая — стирает', async () => {
    const wrapper = mountEditor()
    const mode = () =>
      (wrapper.get('select[name="mode-PROMISE_NOT_FULFILLED"]').element as HTMLSelectElement).value
    await wrapper.get('select[name="mode-PROMISE_NOT_FULFILLED"]').setValue('DIGEST')
    await wrapper.setProps({ preference: { ...preference } })
    expect(mode()).toBe('DIGEST')
    await wrapper.setProps({
      preference: { ...preference, isDefault: false, updatedAt: '2026-09-24T10:00:00Z' },
    })
    expect(mode()).toBe('IMMEDIATE')
    wrapper.unmount()
  })
})
