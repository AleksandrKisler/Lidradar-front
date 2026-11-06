import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { useSessionStore } from '@/entities/session'
import { integrationKeys, type ConnectedChannel } from '@/entities/integration'
import { organizationKeys } from '@/entities/organization'
import { ConnectChannelDialog } from '@/features/connect-channel'

const token = '123456789:AAHf1234567890abcdefghijklmnop'
const connection: ConnectedChannel = {
  id: 'connection-a',
  provider: 'CONNECTED_BUSINESS_BOT',
  locationId: null,
  name: 'Переписка',
  status: 'ACTIVE',
  capabilities: ['CAN_RECEIVE_MESSAGES'],
  lastEventAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorCode: null,
  createdAt: '',
  updatedAt: '',
  webhookSecret: null,
}

function response(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const dialog = () => new DOMWrapper(document.body).get('[role="dialog"]:not(.invisible)')
const input = (name: string) => dialog().get<HTMLInputElement>(`input[name="${name}"]`)

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

describe('контекст подключения Telegram', () => {
  let client: QueryClient
  let session: ReturnType<typeof useSessionStore>
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    setActivePinia(createPinia())
    session = useSessionStore()
    session.user = {
      id: 'user-a',
      email: 'a@example.test',
      displayName: 'A',
      status: 'ACTIVE',
      emailVerifiedAt: null,
      deletionDueAt: null,
      createdAt: '',
      updatedAt: '',
    }
    session.status = 'authenticated'
    session.tenantId = 'tenant-a'
    session.memberships = [
      { tenantId: 'tenant-a', organizationName: 'A', role: 'OWNER' },
      { tenantId: 'tenant-b', organizationName: 'B', role: 'OWNER' },
    ]
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    client.clear()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  async function open(): Promise<VueWrapper> {
    wrapper = mount(ConnectChannelDialog, {
      props: { tenantId: 'tenant-a', locations: [], open: true },
      global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
      attachTo: document.body,
    })
    await vi.dynamicImportSettled()
    await flushPromises()
    return wrapper
  }

  async function fill(): Promise<void> {
    await input('connectionName').setValue('Переписка')
    await input('botToken').setValue(token)
  }

  function expectNoCachedToken(): void {
    const cache = JSON.stringify({
      queries: client
        .getQueryCache()
        .getAll()
        .map((query) => query.state),
      mutations: client
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state),
    })
    expect(cache.includes('botToken')).toBe(false)
    expect(cache.includes(token)).toBe(false)
  }

  it('очищает токен при отправке, не помещает его в query/mutation cache и блокирует дубль', async () => {
    const pending = deferred<Response>()
    fetchMock.mockReturnValue(pending.promise)
    await open()
    await fill()
    const form = dialog().get('form')
    await Promise.all([form.trigger('submit'), form.trigger('submit')])
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(input('botToken').element.value.length).toBe(0)
    expectNoCachedToken()
    const request = fetchMock.mock.calls[0]![0]
    expect(request.headers.get('X-Tenant-ID')).toBe('tenant-a')
    expect(new URL(request.url).pathname).toBe(
      '/api/v1/integrations/CONNECTED_BUSINESS_BOT/connect',
    )
    const body = await request.clone().json()
    expect(body.name).toBe('Переписка')
    expect(body.locationId).toBeNull()
    expect(body.botToken === token).toBe(true)
    pending.resolve(response(connection))
    await settle()
    expect(dialog().text()).toContain('Активно')
    expect(dialog().text()).not.toMatch(/бизнес-бот|business|premium/i)
    expectNoCachedToken()
    expect(wrapper!.emitted('connected')).toHaveLength(1)
  })

  it('поздний ответ после смены tenant не заполняет результат, invalidation использует captured tenant', async () => {
    const pending = deferred<Response>()
    fetchMock.mockReturnValue(pending.promise)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await open()
    await fill()
    await dialog().get('form').trigger('submit')
    await settle()
    session.tenantId = 'tenant-b'
    await wrapper!.setProps({ tenantId: 'tenant-b' })
    expect(input('connectionName').element.value).toBe('')
    expect(input('botToken').element.value.length).toBe(0)
    pending.resolve(response(connection))
    await settle()
    expect(wrapper!.emitted('connected')).toBeUndefined()
    expect(dialog().text()).not.toContain('Подключение создано')
    expect(
      invalidate.mock.calls.map(([options]) =>
        typeof options === 'function' ? options().queryKey : options?.queryKey,
      ),
    ).toEqual([integrationKeys.list('tenant-a'), organizationKeys.onboarding('tenant-a')])
    expectNoCachedToken()
  })

  it.each(['role', 'user', 'tenant-prop'] as const)(
    'смена %s сбрасывает draft и скрытую инструкцию',
    async (change) => {
      await open()
      await fill()
      await dialog()
        .findAll('button')
        .find((button) => button.text().includes('Подробная инструкция'))!
        .trigger('click')
      await vi.dynamicImportSettled()
      await settle()
      expect(dialog().text()).toContain('Вернуться к подключению')
      if (change === 'role') session.memberships[0]!.role = 'MANAGER'
      if (change === 'user') session.user = { ...session.user!, id: 'user-b' }
      if (change === 'tenant-prop') await wrapper!.setProps({ tenantId: 'tenant-b' })
      await settle()
      expect(dialog().text()).not.toContain('Вернуться к подключению')
      expect(input('connectionName').element.value).toBe('')
      expect(input('botToken').element.value.length).toBe(0)
      await dialog().get('form').trigger('submit')
      await settle()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it.each(['role', 'user', 'close', 'unmount'] as const)(
    'игнорирует поздний успех после %s',
    async (change) => {
      const pending = deferred<Response>()
      fetchMock.mockReturnValue(pending.promise)
      await open()
      await fill()
      await dialog().get('form').trigger('submit')
      await settle()
      const mounted = wrapper!
      if (change === 'role') session.memberships[0]!.role = 'MANAGER'
      if (change === 'user') session.user = { ...session.user!, id: 'user-b' }
      if (change === 'close') {
        await mounted.setProps({ open: false })
        await mounted.setProps({ open: true })
      }
      if (change === 'unmount') {
        mounted.unmount()
        wrapper = undefined
      }
      pending.resolve(response(connection))
      await settle()
      expect(mounted.emitted('connected')).toBeUndefined()
      if (change !== 'unmount') expect(dialog().text()).not.toContain('Подключение создано')
      expectNoCachedToken()
    },
  )

  it('при revoked permission не отправляет даже заполненную форму', async () => {
    await open()
    await fill()
    session.memberships[0]!.role = 'MANAGER'
    await dialog().get('form').trigger('submit')
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('смена прав во время асинхронной валидации отменяет команду', async () => {
    await open()
    await fill()
    const submitting = dialog().get('form').trigger('submit')
    session.memberships[0]!.role = 'MANAGER'
    await submitting
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(input('botToken').element.value.length).toBe(0)
  })

  it('поздняя ошибка после смены и возврата tenant не меняет новый draft', async () => {
    const pending = deferred<Response>()
    fetchMock.mockReturnValue(pending.promise)
    await open()
    await fill()
    await dialog().get('form').trigger('submit')
    await settle()
    session.tenantId = 'tenant-b'
    await wrapper!.setProps({ tenantId: 'tenant-b' })
    session.tenantId = 'tenant-a'
    await wrapper!.setProps({ tenantId: 'tenant-a' })
    await fill()
    pending.resolve(
      response(
        {
          error: {
            code: 'CHANNEL_CREDENTIALS_REJECTED',
            message: 'raw',
            traceId: 'old-trace',
          },
        },
        400,
      ),
    )
    await settle()
    expect(input('connectionName').element.value).toBe('Переписка')
    expect(input('botToken').element.value === token).toBe(true)
    expect(dialog().text()).not.toContain('Токен не принят')
    expect(wrapper!.emitted('connected')).toBeUndefined()
    expectNoCachedToken()
  })

  it('сетевой отказ очищает токен и не уничтожает название подключения', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))
    await open()
    await fill()
    await dialog().get('form').trigger('submit')
    await settle()
    expect(input('connectionName').element.value).toBe('Переписка')
    expect(input('botToken').element.value.length).toBe(0)
    expect(wrapper!.emitted('connected')).toBeUndefined()
    expectNoCachedToken()
  })

  it('уже показанный результат очищается при смене пользователя', async () => {
    fetchMock.mockResolvedValue(response(connection))
    await open()
    await fill()
    await dialog().get('form').trigger('submit')
    await settle()
    expect(dialog().text()).toContain('Подключение создано')
    session.user = { ...session.user!, id: 'user-b' }
    await settle()
    expect(dialog().text()).not.toContain('Подключение создано')
    expect(input('connectionName').element.value).toBe('')
  })

  it('инструкция сохраняет draft при возврате, отмена уничтожает его', async () => {
    await open()
    await fill()
    expect(dialog().get('[data-testid="telegram-token-help"]').findAll('li')).toHaveLength(5)
    await dialog()
      .findAll('button')
      .find((button) => button.text().includes('Подробная инструкция'))!
      .trigger('click')
    await vi.dynamicImportSettled()
    await settle()
    expect(dialog().findAll('ol > li')).toHaveLength(16)
    await dialog()
      .findAll('button')
      .find((button) => button.text() === 'Вернуться к подключению')!
      .trigger('click')
    await settle()
    expect(input('connectionName').element.value).toBe('Переписка')
    expect(input('botToken').element.value === token).toBe(true)
    await dialog()
      .findAll('button')
      .find((button) => button.text() === 'Отмена')!
      .trigger('click')
    await wrapper!.setProps({ open: false })
    await wrapper!.setProps({ open: true })
    await settle()
    expect(input('connectionName').element.value).toBe('')
    expect(input('botToken').element.value.length).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([400, 409, 503])(
    'после ошибки %s сохраняет имя, очищает токен и cache',
    async (status) => {
      fetchMock.mockResolvedValue(
        response(
          {
            error: {
              code:
                status === 400
                  ? 'CHANNEL_CREDENTIALS_REJECTED'
                  : status === 409
                    ? 'CHANNEL_ALREADY_CONNECTED'
                    : 'CONNECTOR_UNAVAILABLE',
              message: 'raw',
              traceId: 'synthetic-trace',
            },
          },
          status,
        ),
      )
      await open()
      await fill()
      await dialog().get('form').trigger('submit')
      await settle()
      expect(input('connectionName').element.value).toBe('Переписка')
      expect(input('botToken').element.value.length).toBe(0)
      expectNoCachedToken()
      expect(wrapper!.emitted('connected')).toBeUndefined()
    },
  )

  it('201 ERROR показывает ошибку источника и предупреждение вместо зелёного успеха', async () => {
    fetchMock.mockResolvedValue(
      response({
        ...connection,
        status: 'ERROR',
        lastErrorCode: 'TELEGRAM_CONFIGURATION_REQUIRED',
      }),
    )
    await open()
    await fill()
    await dialog().get('form').trigger('submit')
    await settle()
    expect(dialog().text()).toContain('Ошибка')
    expect(dialog().text()).toContain('Удалённая настройка не завершилась')
    expect(dialog().text()).not.toContain('Активно')
    expect(dialog().get('[role="alert"]').classes()).toContain('bg-warning-pale')
    expect(dialog().find('.bg-success-pale').exists()).toBe(false)
    expect(wrapper!.emitted('connected')).toHaveLength(1)
    expectNoCachedToken()
  })
})
