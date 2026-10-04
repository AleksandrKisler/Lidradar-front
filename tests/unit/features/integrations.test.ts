import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore } from '@/entities/session'
import type { ChannelConnection } from '@/entities/integration'
import { ConnectChannelDialog } from '@/features/connect-channel'
import { DisconnectChannelButton } from '@/features/disconnect-channel'
import { CheckHealthButton } from '@/features/check-channel-health'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

const connection: ChannelConnection = {
  id: 'conn-1',
  locationId: null,
  provider: 'CONNECTED_BUSINESS_BOT',
  name: 'Telegram · переписка',
  status: 'ACTIVE',
  capabilities: ['CAN_RECEIVE_MESSAGES'],
  lastEventAt: null,
  lastSuccessAt: '2026-09-24T00:00:00Z',
  lastErrorAt: null,
  lastErrorCode: null,
  createdAt: '2026-09-24T00:00:00Z',
  updatedAt: '2026-09-24T00:00:00Z',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const errorResponse = (status: number, code: string) =>
  jsonResponse({ error: { code, message: 'raw', traceId: 't-1' } }, status)

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

const body = () => new DOMWrapper(document.body)
const dialog = () => body().get('[role="dialog"]')

function plugins() {
  return [
    [
      VueQueryPlugin,
      { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
    ],
  ] as never
}

describe('интеграции', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>

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

  it('Telegram: токен проверяется по формату, уходит один раз и очищается', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...connection, webhookSecret: null }, 201))
    const wrapper = mount(ConnectChannelDialog, {
      props: { tenantId: 'tenant-a', locations: [], open: true },
      global: { plugins: plugins() },
      attachTo: document.body,
    })
    await flushPromises()
    await dialog().get('input[name="connectionName"]').setValue('Telegram · переписка')
    await dialog().get('input[name="botToken"]').setValue('bad-token')
    await dialog().get('form').trigger('submit')
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(dialog().text()).toContain('Токен бота имеет вид')

    await dialog()
      .get('input[name="botToken"]')
      .setValue('123456789:AAHf1234567890abcdefghijklmnop')
    await dialog().get('form').trigger('submit')
    await settle()
    const request = fetchMock.mock.calls[0]![0]
    expect(new URL(request.url).pathname).toBe(
      '/api/v1/integrations/CONNECTED_BUSINESS_BOT/connect',
    )
    expect(await request.json()).toEqual({
      name: 'Telegram · переписка',
      locationId: null,
      botToken: '123456789:AAHf1234567890abcdefghijklmnop',
    })
    expect(dialog().text()).toContain('Подключение создано')
    expect(dialog().text()).toContain('Работает')
    expect(dialog().text()).not.toContain('Секрет webhook')
    expect(wrapper.emitted('connected')).toHaveLength(1)
    wrapper.unmount()
  })

  it('две отправки подряд в окне проверки формы создают одно подключение', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...connection, webhookSecret: null }, 201))
    const wrapper = mount(ConnectChannelDialog, {
      props: { tenantId: 'tenant-a', locations: [], open: true },
      global: { plugins: plugins() },
      attachTo: document.body,
    })
    await flushPromises()
    await dialog().get('input[name="connectionName"]').setValue('Telegram · переписка')
    await dialog()
      .get('input[name="botToken"]')
      .setValue('123456789:AAHf1234567890abcdefghijklmnop')
    // Клик и Enter почти одновременно: проверка формы ещё не завершилась.
    const form = dialog().get('form')
    await Promise.all([form.trigger('submit'), form.trigger('submit')])
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('connected')).toHaveLength(1)
    wrapper.unmount()
  })

  it('Webhook: выпущенный сервером секрет показывается один раз, черновик при 503 остаётся без секрета', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(503, 'CONNECTOR_UNAVAILABLE'))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            ...connection,
            provider: 'GENERIC_WEBHOOK',
            status: 'ACTIVE',
            lastSuccessAt: null,
            webhookSecret: 'issued-secret-0123456789',
          },
          201,
        ),
      )
    const wrapper = mount(ConnectChannelDialog, {
      props: { tenantId: 'tenant-a', locations: [], open: true },
      global: { plugins: plugins() },
      attachTo: document.body,
    })
    await flushPromises()
    await dialog().get('select[name="provider"]').setValue('GENERIC_WEBHOOK')
    await dialog().get('input[name="connectionName"]').setValue('CRM')
    await dialog().get('input[name="webhookSecret"]').setValue('my-own-secret-value-16')
    await dialog().get('form').trigger('submit')
    await settle()
    expect(dialog().text()).toContain('Подключение временно недоступно')
    expect((dialog().get('input[name="connectionName"]').element as HTMLInputElement).value).toBe(
      'CRM',
    )
    expect((dialog().get('input[name="webhookSecret"]').element as HTMLInputElement).value).toBe('')
    expect(await fetchMock.mock.calls[0]![0].json()).toEqual({
      name: 'CRM',
      locationId: null,
      webhookSecret: 'my-own-secret-value-16',
    })

    await dialog().get('form').trigger('submit')
    await settle()
    expect(await fetchMock.mock.calls[1]![0].json()).toEqual({ name: 'CRM', locationId: null })
    expect(dialog().get('[data-testid="webhook-secret"]').text()).toBe('issued-secret-0123456789')
    expect(dialog().text()).toContain('показывается один раз')
    expect(dialog().text()).toContain('Ожидает первое событие')
    expect(dialog().text()).not.toContain('Работает')
    expect(dialog().get('[data-testid="webhook-url"]').text()).toContain(
      '/api/v1/webhooks/GENERIC_WEBHOOK/tenant-a/conn-1',
    )
    expect(dialog().text()).toContain('X-LidRadar-Webhook-Secret')
    wrapper.unmount()
  })

  it('отключение: подтверждение, а при 503 — предупреждение и перечитывание', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(503, 'CONNECTOR_UNAVAILABLE'))
    const wrapper = mount(DisconnectChannelButton, {
      props: { tenantId: 'tenant-a', connection },
      global: { plugins: plugins() },
      attachTo: document.body,
    })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(dialog().text()).toContain('Telegram · переписка · Telegram · бизнес-бот')
    await dialog()
      .findAll('button')
      .find((button) => button.text() === 'Отключить')!
      .trigger('click')
    await settle()
    expect(fetchMock.mock.calls[0]![0].method).toBe('DELETE')
    expect(wrapper.text()).toContain('Отключено локально')
    expect(wrapper.emitted('done')?.[0]).toEqual([true])
    wrapper.unmount()
  })

  it('свой секрет: инструкция доступна без повторного показа секрета, повторное подключение меняет адрес', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          { ...connection, provider: 'GENERIC_WEBHOOK', lastSuccessAt: null, webhookSecret: null },
          201,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            ...connection,
            id: 'conn-2',
            provider: 'GENERIC_WEBHOOK',
            lastSuccessAt: null,
            webhookSecret: null,
          },
          201,
        ),
      )
    const wrapper = mount(ConnectChannelDialog, {
      props: { tenantId: 'tenant-a', locations: [], open: true },
      global: { plugins: plugins() },
      attachTo: document.body,
    })
    for (const id of ['conn-1', 'conn-2']) {
      await flushPromises()
      await dialog().get('select[name="provider"]').setValue('GENERIC_WEBHOOK')
      await dialog().get('input[name="connectionName"]').setValue('CRM')
      await dialog().get('input[name="webhookSecret"]').setValue('my-own-secret-value-16')
      await dialog().get('form').trigger('submit')
      await settle()
      expect(dialog().get('[data-testid="webhook-url"]').text()).toContain(`/tenant-a/${id}`)
      expect(dialog().text()).not.toContain('my-own-secret-value-16')
      expect(dialog().find('[data-testid="webhook-secret"]').exists()).toBe(false)
      expect(dialog().text()).toContain('новый адрес и секрет')
      await wrapper.setProps({ open: false })
      await settle()
      await wrapper.setProps({ open: true })
      await settle()
      expect(dialog().find('[data-testid="webhook-instructions"]').exists()).toBe(false)
      await dialog().get('select[name="provider"]').setValue('GENERIC_WEBHOOK')
      expect(dialog().get<HTMLInputElement>('input[name="webhookSecret"]').element.value).toBe('')
    }
    wrapper.unmount()
  })

  it('локальная проверка webhook не объявляет доставку подтверждённой до события', async () => {
    const health = {
      status: 'ACTIVE',
      lastEventAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorCode: null,
      checkedAt: '2026-10-04T12:00:00Z',
    }
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ health, verification: 'LOCAL' }))
      .mockResolvedValueOnce(
        jsonResponse({
          health: { ...health, lastEventAt: health.checkedAt, lastSuccessAt: health.checkedAt },
          verification: 'LOCAL',
        }),
      )
    const wrapper = mount(CheckHealthButton, {
      props: {
        tenantId: 'tenant-a',
        connectionId: 'conn-1',
        provider: 'GENERIC_WEBHOOK',
        timeZone: 'Europe/Moscow',
      },
      global: { plugins: plugins() },
    })
    expect(wrapper.get('button').text()).toBe('Обновить статус')
    await wrapper.get('button').trigger('click')
    await settle()
    expect(wrapper.get('[role="status"]').text()).toContain('Ожидает первое событие')
    await wrapper.get('button').trigger('click')
    await settle()
    expect(wrapper.get('[role="status"]').text()).toContain('Приём подтверждён')
    wrapper.unmount()
  })

  it('проверка связи показывает статус, вид проверки и безопасный код', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        health: {
          status: 'ERROR',
          lastEventAt: null,
          lastSuccessAt: null,
          lastErrorAt: '2026-09-24T00:05:00Z',
          lastErrorCode: 'TELEGRAM_WEBHOOK_MISMATCH',
          checkedAt: '2026-09-24T00:05:00Z',
        },
        verification: 'REMOTE',
      }),
    )
    const wrapper = mount(CheckHealthButton, {
      props: {
        tenantId: 'tenant-a',
        connectionId: 'conn-1',
        provider: 'CONNECTED_BUSINESS_BOT',
        timeZone: 'Europe/Moscow',
      },
      global: { plugins: plugins() },
    })
    await wrapper.get('button').trigger('click')
    await settle()
    expect(new URL(fetchMock.mock.calls[0]![0].url).pathname).toBe(
      '/api/v1/integrations/conn-1/health/check',
    )
    const status = wrapper.get('[role="status"]').text()
    expect(status).toContain('Ошибка')
    expect(status).toContain('провайдер опрошен')
    expect(status).toContain('не на LidRadar')
    wrapper.unmount()
  })
})
