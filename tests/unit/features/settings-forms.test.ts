import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore } from '@/entities/session'
import type { Organization } from '@/entities/organization'
import type { Location } from '@/entities/location'
import type { ServiceCatalogItem } from '@/entities/service'
import { OrganizationForm } from '@/features/edit-organization'
import { BusinessHoursEditor } from '@/features/edit-business-hours'
import { ServiceForm } from '@/features/manage-services'
import { LocationForm } from '@/features/manage-locations'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

const organization: Organization = {
  id: 'tenant-a',
  name: 'Студия',
  defaultTimezone: 'Europe/Moscow',
  defaultCurrency: 'RUB',
  status: 'ACTIVE',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
}

const location: Location = {
  id: 'loc-1',
  name: 'Студия на Пресне',
  timezone: 'Europe/Moscow',
  responseThresholdMinutes: 45,
  agreementThresholdMinutes: 120,
  active: true,
  businessHours: [],
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
}

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

function mountWith(component: Component, props: Record<string, unknown>) {
  return mount(component, {
    props,
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

describe('формы настроек', () => {
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
      memberships: [{ tenantId: 'tenant-a', organizationName: 'Студия', role: 'OWNER' }],
    })
    await useSessionStore().bootstrap()
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('организация: без изменений не отправляет, смена валюты требует подтверждения', async () => {
    fetchMock.mockImplementation((request) =>
      request.url.endsWith('/auth/me')
        ? Promise.resolve(jsonResponse({ user: {}, memberships: [] }))
        : Promise.resolve(jsonResponse({ ...organization, defaultCurrency: 'KZT' })),
    )
    const wrapper = mountWith(OrganizationForm, { tenantId: 'tenant-a', organization })
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('select[name="organizationCurrency"]').setValue('KZT')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    const dialog = body().get('[role="dialog"]')
    expect(dialog.text()).toContain('Исторические суммы не конвертируются')
    await dialog
      .findAll('button')
      .find((button) => button.text() === 'Сохранить изменения')!
      .trigger('click')
    await settle()
    const patch = fetchMock.mock.calls.find(([request]) => request.method === 'PATCH')!
    expect(await patch[0].json()).toEqual({ defaultCurrency: 'KZT' })
    expect(wrapper.text()).toContain('Настройки компании сохранены.')
    wrapper.unmount()
  })

  it('точка: создание отправляет порог числом, изменение — только разницу', async () => {
    fetchMock.mockImplementation((request) =>
      Promise.resolve(
        jsonResponse({ ...location, id: 'loc-new' }, request.method === 'POST' ? 201 : 200),
      ),
    )
    const create = mountWith(LocationForm, {
      tenantId: 'tenant-a',
      location: null,
      defaultTimezone: 'Europe/Moscow',
    })
    await create.get('input[name="locationName"]').setValue('Новая точка')
    await create.get('input[name="responseThresholdMinutes"]').setValue('2000')
    await create.get('form').trigger('submit')
    await settle()
    expect(create.text()).toContain('От 1 до 1440 минут')
    expect(fetchMock).not.toHaveBeenCalled()
    await create.get('input[name="responseThresholdMinutes"]').setValue('60')
    expect(
      (create.get('input[name="agreementThresholdMinutes"]').element as HTMLInputElement).value,
    ).toBe('120')
    await create.get('input[name="agreementThresholdMinutes"]').setValue('1441')
    await create.get('form').trigger('submit')
    await settle()
    expect(create.text()).toContain('От 1 до 1440 минут')
    expect(fetchMock).not.toHaveBeenCalled()
    await create.get('input[name="agreementThresholdMinutes"]').setValue('120')
    await create.get('form').trigger('submit')
    await settle()
    expect(await fetchMock.mock.calls[0]![0].json()).toEqual({
      name: 'Новая точка',
      timezone: 'Europe/Moscow',
      responseThresholdMinutes: 60,
      agreementThresholdMinutes: 120,
    })
    expect(create.emitted('saved')).toHaveLength(1)
    create.unmount()

    fetchMock.mockClear()
    const edit = mountWith(LocationForm, {
      tenantId: 'tenant-a',
      location,
      defaultTimezone: 'Europe/Moscow',
    })
    await edit.get('input[name="agreementThresholdMinutes"]').setValue('240')
    await edit.get('form').trigger('submit')
    await settle()
    expect(await fetchMock.mock.calls[0]![0].json()).toEqual({ agreementThresholdMinutes: 240 })
    fetchMock.mockClear()
    await edit.get('input[name="agreementThresholdMinutes"]').setValue('120')
    await edit.get('input[name="locationActive"]').setValue(false)
    await edit.get('form').trigger('submit')
    await settle()
    expect(fetchMock.mock.calls[0]![0].method).toBe('PATCH')
    expect(await fetchMock.mock.calls[0]![0].json()).toEqual({ active: false })
    edit.unmount()
  })

  it.each(['create', 'update'] as const)(
    'точка: %s защищена от повторного submit во время валидации и запроса',
    async (kind) => {
      let resolveResponse!: (response: Response) => void
      const response = new Promise<Response>((resolve) => {
        resolveResponse = resolve
      })
      fetchMock.mockImplementation(async () => (await response).clone())
      const wrapper = mountWith(LocationForm, {
        tenantId: 'tenant-a',
        location: kind === 'update' ? location : null,
        defaultTimezone: 'Europe/Moscow',
      })
      await wrapper.get('input[name="locationName"]').setValue('Новая точка')
      const form = wrapper.get('form')
      await Promise.all([form.trigger('submit'), form.trigger('submit')])
      await settle()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
      await form.trigger('submit')
      await settle()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      resolveResponse(
        jsonResponse({ ...location, name: 'Новая точка' }, kind === 'create' ? 201 : 200),
      )
      await settle()
      expect(wrapper.emitted('saved')).toHaveLength(1)
      expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
      wrapper.unmount()
    },
  )

  it('график: локальная проверка, атомарный PUT и признак несохранённых изменений', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ ...location, businessHours: [] })),
    )
    const wrapper = mountWith(BusinessHoursEditor, { tenantId: 'tenant-a', location })
    await flushPromises()
    // Стартовая неделя новой точки — не «несохранённые изменения»: уход без правок не пугает.
    expect(wrapper.emitted('update:dirty')?.at(-1)).toEqual([false])
    await wrapper.get('input[name="opens-1"]').setValue('21:00')
    expect(wrapper.emitted('update:dirty')?.at(-1)).toEqual([true])
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.text()).toContain('Открытие должно быть раньше закрытия')
    expect(fetchMock).not.toHaveBeenCalled()
    await wrapper.get('input[name="opens-1"]').setValue('09:00')
    await wrapper.get('input[name="day-7"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await settle()
    const request = fetchMock.mock.calls[0]![0]
    expect(request.method).toBe('PUT')
    const sent = (await request.json()) as {
      timezone: string
      days: { weekday: number; closed: boolean }[]
    }
    expect(sent.timezone).toBe('Europe/Moscow')
    expect(sent.days).toHaveLength(7)
    expect(sent.days[6]).toEqual({ weekday: 7, closed: false, opensAt: '09:00', closesAt: '20:00' })
    expect(wrapper.text()).toContain('График сохранён.')
    wrapper.unmount()
  })

  it('график: у времени видимые подписи «с» и «до», доступные имена прежние', () => {
    const wrapper = mountWith(BusinessHoursEditor, { tenantId: 'tenant-a', location })
    const monday = wrapper.findAll('li')[0]!
    // Видимые подписи скрыты от скринридеров: имя поля остаётся «Понедельник, открытие».
    expect(monday.findAll('[aria-hidden="true"]').map((item) => item.text())).toEqual(['с', 'до'])
    expect(monday.findAll('.sr-only').map((item) => item.text())).toEqual([
      'Понедельник, открытие',
      'Понедельник, закрытие',
    ])
    wrapper.unmount()
  })

  it('график: «Применить время» копирует образец на рабочие дни и исчезает, когда всё одинаково', async () => {
    const wrapper = mountWith(BusinessHoursEditor, { tenantId: 'tenant-a', location })
    const apply = () =>
      wrapper.findAll('button').find((button) => button.text().startsWith('Применить время'))
    // В стартовой неделе суббота короче будней: выравнивать есть что, образец — понедельник.
    expect(apply()?.text()).toBe('Применить время понедельника ко всем рабочим дням')
    await wrapper.get('input[name="opens-1"]').setValue('08:00')
    await wrapper.get('input[name="closes-1"]').setValue('19:00')
    await apply()!.trigger('click')
    for (const weekday of [2, 3, 4, 5, 6]) {
      const opens = wrapper.get(`input[name="opens-${weekday}"]`).element as HTMLInputElement
      const closes = wrapper.get(`input[name="closes-${weekday}"]`).element as HTMLInputElement
      expect([opens.value, closes.value]).toEqual(['08:00', '19:00'])
    }
    // Выходной остаётся выходным, а кнопка не нужна, раз время везде одно.
    expect(wrapper.find('input[name="opens-7"]').exists()).toBe(false)
    expect(apply()).toBeUndefined()
    // Если понедельник выходной, образцом служит первый рабочий день.
    await wrapper.get('input[name="day-1"]').setValue(false)
    await wrapper.get('input[name="opens-3"]').setValue('10:00')
    expect(apply()?.text()).toBe('Применить время вторника ко всем рабочим дням')
    wrapper.unmount()
  })

  it('график в мастере: своей кнопки нет, save() сохраняет неделю и сообщает исход', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ ...location, businessHours: [] })),
    )
    const wrapper = mountWith(BusinessHoursEditor, {
      tenantId: 'tenant-a',
      location,
      hideSubmit: true,
    })
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    const save = () => (wrapper.vm as unknown as { save: () => Promise<boolean> }).save()
    // Ошибка проверки: запрос не уходит, шаг остаётся на месте, причина видна.
    await wrapper.get('input[name="opens-1"]').setValue('21:00')
    expect(await save()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Открытие должно быть раньше закрытия')
    // Исправили: неделя уходит одним PUT, результат true.
    await wrapper.get('input[name="opens-1"]').setValue('09:00')
    expect(await save()).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![0].method).toBe('PUT')
    wrapper.unmount()
  })

  it('save(): уже сохранённая и неизменённая неделя не уходит повторно, сбой сервера даёт false', async () => {
    const week = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      weekday,
      closed: weekday === 7,
      ...(weekday === 7 ? {} : { opensAt: '09:00', closesAt: '20:00' }),
    }))
    const wrapper = mountWith(BusinessHoursEditor, {
      tenantId: 'tenant-a',
      location: { ...location, businessHours: week },
      hideSubmit: true,
    })
    const save = () => (wrapper.vm as unknown as { save: () => Promise<boolean> }).save()
    expect(await save()).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    // Правка и отказ сервера: неделя не сохранена, значит и переходить нельзя.
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse({ error: { code: 'INTERNAL', message: 'x', traceId: 't-1' } }, 500),
      ),
    )
    await wrapper.get('input[name="closes-1"]').setValue('21:00')
    expect(await save()).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('услуга: пустая цена уходит null, нижняя граница не выше верхней', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ id: 'svc-1' }, 201)))
    const wrapper = mountWith(ServiceForm, {
      tenantId: 'tenant-a',
      service: null,
      locations: [location],
      defaultCurrency: 'RUB',
    })
    await wrapper.get('input[name="serviceName"]').setValue('Полировка кузова')
    await wrapper.get('input[name="priceFrom"]').setValue('90 000')
    await wrapper.get('input[name="priceTo"]').setValue('50000')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.text()).toContain('Нижняя граница не может быть выше верхней')
    expect(fetchMock).not.toHaveBeenCalled()
    await wrapper.get('input[name="priceTo"]').setValue('')
    await wrapper.get('select[name="serviceLocation"]').setValue('loc-1')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(await fetchMock.mock.calls[0]![0].json()).toEqual({
      name: 'Полировка кузова',
      locationId: 'loc-1',
      priceFrom: '90000.00',
      priceTo: null,
      currency: 'RUB',
    })
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect((wrapper.get('input[name="serviceName"]').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })

  it.each(['create', 'update'] as const)(
    'услуга: %s отправляется один раз при повторном submit до валидации и во время запроса',
    async (kind) => {
      const service: ServiceCatalogItem = {
        id: 'svc-1',
        name: 'Полировка',
        normalizedName: 'полировка',
        locationId: null,
        priceFrom: '1000.00',
        priceTo: '1500.00',
        currency: 'RUB',
        active: true,
        createdAt: '',
        updatedAt: '',
      }
      let resolveResponse!: (response: Response) => void
      const response = new Promise<Response>((resolve) => {
        resolveResponse = resolve
      })
      fetchMock.mockImplementation(async () => (await response).clone())
      const wrapper = mountWith(ServiceForm, {
        tenantId: 'tenant-a',
        service: kind === 'update' ? service : null,
        locations: [location],
        defaultCurrency: 'RUB',
      })
      await wrapper.get('input[name="serviceName"]').setValue('Полировка')
      const form = wrapper.get('form')
      // Оба события приходят до следующего обновления DOM и завершения валидации.
      await Promise.all([form.trigger('submit'), form.trigger('submit')])
      await settle()
      const callsBeforeResponse = fetchMock.mock.calls.length
      const disabledWhilePending = wrapper.get('button[type="submit"]').attributes('disabled')
      await form.trigger('submit')
      await settle()
      const callsAfterRepeat = fetchMock.mock.calls.length
      resolveResponse(jsonResponse(service, kind === 'create' ? 201 : 200))
      await settle()

      expect(callsBeforeResponse).toBe(1)
      expect(callsAfterRepeat).toBe(1)
      expect(disabledWhilePending).toBeDefined()
      expect(fetchMock.mock.calls[0]![0].method).toBe(kind === 'create' ? 'POST' : 'PATCH')
      expect(wrapper.emitted('saved')).toHaveLength(1)
      expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
      wrapper.unmount()
    },
  )

  it.each(['create', 'update'] as const)(
    'услуга: %s показывает лимит у поля и сохраняет после исправления длины Unicode',
    async (kind) => {
      const service: ServiceCatalogItem = {
        id: 'svc-1',
        name: 'Мойка',
        normalizedName: 'мойка',
        locationId: null,
        priceFrom: null,
        priceTo: null,
        currency: 'RUB',
        active: true,
        createdAt: '',
        updatedAt: '',
      }
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse(service, kind === 'create' ? 201 : 200)),
      )
      const wrapper = mountWith(ServiceForm, {
        tenantId: 'tenant-a',
        service: kind === 'update' ? service : null,
        locations: [],
        defaultCurrency: 'RUB',
      })
      const name = wrapper.get<HTMLInputElement>('input[name="serviceName"]')
      await name.setValue('Я'.repeat(201))
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('Не более 200 символов')
      expect(name.attributes('aria-invalid')).toBe('true')
      expect(name.element.value).toBe('Я'.repeat(201))

      // Emoji occupies two UTF-16 units: native maxlength must not truncate it.
      expect(name.attributes('maxlength')).toBeUndefined()
      await name.setValue('🚗'.repeat(200))
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0]![0].method).toBe(kind === 'create' ? 'POST' : 'PATCH')
      expect((await fetchMock.mock.calls[0]![0].json()).name).toBe('🚗'.repeat(200))
      expect(wrapper.emitted('saved')).toHaveLength(1)
      wrapper.unmount()
    },
  )

  it('услуга: после отказа API сохраняет поля и разрешает повтор, затем новую услугу', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'VALIDATION_ERROR' } }, 422))
      .mockImplementation(() => Promise.resolve(jsonResponse({ id: 'svc-1' }, 201)))
    const wrapper = mountWith(ServiceForm, {
      tenantId: 'tenant-a',
      service: null,
      locations: [],
      defaultCurrency: 'RUB',
    })
    const name = wrapper.get<HTMLInputElement>('input[name="serviceName"]')
    await name.setValue('Полировка')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(name.element.value).toBe('Полировка')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('form').trigger('submit')
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(name.element.value).toBe('')

    await name.setValue('Мойка')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(wrapper.emitted('saved')).toHaveLength(2)
    wrapper.unmount()
  })
})
