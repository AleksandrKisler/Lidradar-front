import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { defineComponent, h, ref } from 'vue'
import { ServiceFormDialog, useServiceCommands } from '@/features/manage-services'
import {
  createService,
  serviceKeys,
  updateService,
  type ServiceCatalogItem,
} from '@/entities/service'
import { ApiError } from '@/shared/api'

vi.mock('@/entities/service', async (original) => ({
  ...(await original<typeof import('@/entities/service')>()),
  createService: vi.fn(),
  updateService: vi.fn(),
}))
const service: ServiceCatalogItem = {
  id: 'service-a',
  name: 'Полировка',
  normalizedName: 'полировка',
  locationId: null,
  priceFrom: '31000.00',
  priceTo: '31000.00',
  currency: 'RUB',
  active: true,
  createdAt: '',
  updatedAt: '',
}
const wrappers: Array<{ unmount(): void }> = []
const body = () => new DOMWrapper(document.body)
const dialog = () => body().get('[role="dialog"]')
const button = (text: string) =>
  dialog()
    .findAll('button')
    .find((item) => item.text() === text)!
function setup(current: ServiceCatalogItem | null = null) {
  const wrapper = mount(ServiceFormDialog, {
    props: {
      open: true,
      tenantId: 'tenant-a',
      service: current,
      locations: [],
      defaultCurrency: 'RUB',
      'onUpdate:open': (open: boolean) => {
        void wrapper.setProps({ open })
      },
    },
    attachTo: document.body,
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
            }),
          },
        ],
      ],
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
async function settle() {
  await flushPromises()
  await vi.dynamicImportSettled()
  await vi.advanceTimersByTimeAsync(25)
  await flushPromises()
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
async function submit() {
  await dialog().get('form').trigger('submit')
  await settle()
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.mocked(createService).mockResolvedValue({ ...service, id: 'created-response-id' })
  vi.mocked(updateService).mockResolvedValue(service)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('N-SS-ADAPTIVE-01 · settings service operation lifecycle', () => {
  it('normalizes Unicode whitespace, decimal comma and null; success edits the response ID without another POST', async () => {
    vi.mocked(createService).mockResolvedValue({
      ...service,
      id: 'created-response-id',
      name: 'Мойка кузова',
      priceFrom: '1490.50',
      priceTo: null,
    })
    setup()
    await settle()
    await dialog().get('input[name=serviceName]').setValue('  Мойка\u00a0  кузова  ')
    await dialog().get('input[name=priceFrom]').setValue('1490,50')
    await submit()
    expect(createService).toHaveBeenCalledExactlyOnceWith('tenant-a', {
      name: 'Мойка кузова',
      locationId: null,
      priceFrom: '1490.50',
      priceTo: null,
      currency: 'RUB',
    })
    expect(dialog().find('form').exists()).toBe(false)
    expect(button('ОК')).toBeDefined()
    await button('Изменить услугу').trigger('click')
    await settle()
    await dialog().get('input[name=priceTo]').setValue('32000')
    await submit()
    expect(createService).toHaveBeenCalledTimes(1)
    expect(updateService).toHaveBeenCalledExactlyOnceWith('tenant-a', 'created-response-id', {
      name: 'Мойка кузова',
      locationId: null,
      priceFrom: '1490.50',
      priceTo: '32000.00',
      currency: 'RUB',
    })
  })

  it.each([
    ['', '', '', 'Введите название услуги'],
    ['Мойка', '-100', '', 'Цена — положительное число'],
    ['Мойка', 'abc', '', 'Цена — положительное число'],
    ['Мойка', '0', '', 'Цена — положительное число'],
    ['Мойка', '5000', '3000', 'Цена'],
  ])(
    'invalid name/price %j %j %j sends nothing and retains inputs',
    async (name, from, to, copy) => {
      setup()
      await settle()
      await dialog().get('input[name=serviceName]').setValue(name)
      await dialog().get('input[name=priceFrom]').setValue(from)
      await dialog().get('input[name=priceTo]').setValue(to)
      await submit()
      expect(createService).not.toHaveBeenCalled()
      expect(dialog().text()).toContain(copy)
      expect(dialog().find('[aria-invalid=true]').exists()).toBe(true)
      expect(dialog().get<HTMLInputElement>('input[name=priceFrom]').element.value).toBe(from)
    },
  )

  it('locks before asynchronous validation and deduplicates immediate submits until API completion', async () => {
    const gate = deferred<ServiceCatalogItem>()
    vi.mocked(createService).mockReturnValue(gate.promise)
    setup()
    await settle()
    await dialog().get('input[name=serviceName]').setValue('Мойка')
    await Promise.all([
      dialog().get('form').trigger('submit'),
      dialog().get('form').trigger('submit'),
    ])
    await settle()
    expect(createService).toHaveBeenCalledTimes(1)
    for (const field of dialog().findAll('input, select'))
      expect(field.attributes('disabled')).toBeDefined()
    expect(button('Отмена').attributes('disabled')).toBeDefined()
    const close = dialog().get('button[aria-label="Закрыть"]')
    expect(close.attributes('disabled')).toBeDefined()
    await dialog().trigger('keydown', { key: 'Escape' })
    expect(body().find('[role=dialog]').exists()).toBe(true)
    gate.resolve(service)
    await settle()
    expect(dialog().find('form').exists()).toBe(false)
  })

  it('known rejection keeps draft; explicit retry sends the same body and success emits only once', async () => {
    vi.mocked(createService).mockRejectedValueOnce(
      new ApiError({ httpStatus: 422, code: 'VALIDATION_ERROR' }),
    )
    const wrapper = setup()
    await settle()
    await dialog().get('input[name=serviceName]').setValue('Черновик')
    await submit()
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(dialog().get<HTMLInputElement>('input[name=serviceName]').element.value).toBe('Черновик')
    expect(dialog().findAll('[role=alert]')).toHaveLength(1)
    expect(createService).toHaveBeenCalledTimes(1)
    await button('Повторить сохранение').trigger('click')
    await settle()
    expect(createService).toHaveBeenCalledTimes(2)
    expect(vi.mocked(createService).mock.calls[1]).toEqual(vi.mocked(createService).mock.calls[0])
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(dialog().find('form').exists()).toBe(false)
    await button('ОК').trigger('click')
    await settle()
    expect(body().find('[role=dialog]').exists()).toBe(false)
  })

  it.each([
    ApiError.network(new TypeError('offline')),
    new ApiError({ httpStatus: 500, code: 'INTERNAL_ERROR' }),
  ])('unknown POST result does not emit success or allow repeated POST (%s)', async (error) => {
    vi.mocked(createService).mockRejectedValue(error)
    const wrapper = setup()
    await settle()
    await dialog().get('input[name=serviceName]').setValue('Мойка')
    await submit()
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(dialog().find('form').exists()).toBe(true)
    expect(dialog().find('[role=alert]').exists()).toBe(true)
    await submit()
    expect(createService).toHaveBeenCalledTimes(1)
    expect(button('ОК')).toBeUndefined()
  })

  it('service and tenant changes isolate draft B from late response A', async () => {
    const gate = deferred<ServiceCatalogItem>()
    vi.mocked(updateService).mockReturnValue(gate.promise)
    const wrapper = setup(service)
    await settle()
    await dialog().get('input[name=serviceName]').setValue('Черновик A')
    await submit()
    const second = { ...service, id: 'service-b', name: 'Услуга B' }
    await wrapper.setProps({ tenantId: 'tenant-b', service: second })
    await settle()
    expect(dialog().get<HTMLInputElement>('input[name=serviceName]').element.value).toBe('Услуга B')
    await dialog().get('input[name=serviceName]').setValue('Черновик B')
    gate.resolve({ ...service, name: 'Ответ A' })
    await settle()
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(dialog().find('form').exists()).toBe(true)
    expect(dialog().get<HTMLInputElement>('input[name=serviceName]').element.value).toBe(
      'Черновик B',
    )
    expect(vi.mocked(updateService).mock.calls[0]?.slice(0, 2)).toEqual(['tenant-a', 'service-a'])
  })

  it('same-ID cache refresh preserves dirty draft; PATCH clears prices as null', async () => {
    const wrapper = setup(service)
    await settle()
    await dialog().get('input[name=serviceName]').setValue('Мой черновик')
    await wrapper.setProps({ service: { ...service, name: 'Обновление cache' } })
    await settle()
    expect(dialog().get<HTMLInputElement>('input[name=serviceName]').element.value).toBe(
      'Мой черновик',
    )
    await dialog().get('input[name=priceFrom]').setValue('')
    await dialog().get('input[name=priceTo]').setValue('')
    await submit()
    expect(updateService).toHaveBeenCalledExactlyOnceWith('tenant-a', 'service-a', {
      name: 'Мой черновик',
      locationId: null,
      priceFrom: null,
      priceTo: null,
      currency: 'RUB',
    })
  })
})

describe('US-M03-02 · captured command tenant', () => {
  it('late A success invalidates A cache only after selected tenant becomes B', async () => {
    const tenant = ref('tenant-a')
    const gate = deferred<ServiceCatalogItem>()
    vi.mocked(updateService).mockReturnValue(gate.promise)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    let commands!: ReturnType<typeof useServiceCommands>
    const host = mount(
      defineComponent({
        setup() {
          commands = useServiceCommands(() => tenant.value)
          return () => h('div')
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
    )
    wrappers.push(host)
    const pending = commands.mutateAsync({
      kind: 'update',
      serviceId: service.id,
      body: { name: 'A' },
    })
    await settle()
    tenant.value = 'tenant-b'
    gate.resolve(service)
    await pending
    expect(updateService).toHaveBeenCalledExactlyOnceWith('tenant-a', service.id, { name: 'A' })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: serviceKeys.list('tenant-a') })
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: serviceKeys.list('tenant-b') })
  })
})
