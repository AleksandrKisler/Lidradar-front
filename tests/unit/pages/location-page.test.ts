import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '@/app/router/routes'
import { fetchMe, useSessionStore } from '@/entities/session'
import { LocationPage } from '@/pages/onboarding'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

const user = {
  id: 'user-1',
  email: 'a@b.c',
  displayName: 'Мария Владелец',
  status: 'ACTIVE' as const,
  createdAt: '2026-10-13T00:00:00Z',
  updatedAt: '2026-10-13T00:00:00Z',
  emailVerifiedAt: null,
  deletionDueAt: null,
}
const week = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  closed: weekday === 7,
  ...(weekday === 7 ? {} : { opensAt: '09:00:00', closesAt: '20:00:00' }),
}))
const location = {
  id: 'loc-1',
  name: 'Студия на Тверской',
  timezone: 'Europe/Moscow',
  responseThresholdMinutes: 45,
  agreementThresholdMinutes: 120,
  active: true,
  businessHours: [] as unknown[],
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

/** Шаг 2 «Точка и график» (US-M02-02): состояния по макетам «Ошибка», «Сохранение», «Первичная загрузка». */
describe('страница «Точка и график» (шаг 2)', () => {
  let locationsResponse: () => Promise<Response>
  let hoursResponse: () => Promise<Response>
  let calls: string[]
  let bodies: unknown[]

  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    calls = []
    bodies = []
    vi.mocked(fetchMe).mockResolvedValue({
      user,
      memberships: [{ tenantId: 't-1', organizationName: 'Студия', role: 'OWNER' }],
      canCreateOrganization: false,
    })
    await useSessionStore().bootstrap()
    locationsResponse = async () => json({ items: [location] })
    hoursResponse = async () => json({ ...location, businessHours: week })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        const path = new URL(request.url).pathname
        calls.push(`${request.method} ${path}`)
        if (request.method === 'PUT') bodies.push(await request.clone().json())
        if (path === '/api/v1/locations') return locationsResponse()
        if (path.endsWith('/business-hours')) return hoursResponse()
        if (path === '/api/v1/organization')
          return json({
            id: 't-1',
            name: 'Студия',
            defaultTimezone: 'Europe/Moscow',
            defaultCurrency: 'RUB',
            status: 'ACTIVE',
            createdAt: '2026-09-01T00:00:00Z',
            updatedAt: '2026-09-01T00:00:00Z',
          })
        return json({ error: { code: 'NOT_FOUND', message: 'x', traceId: 't' } }, 404)
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  async function mountPage() {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/onboarding/location')
    await router.isReady()
    const wrapper = mount(LocationPage, {
      attachTo: document.body,
      global: {
        plugins: [
          router,
          [
            VueQueryPlugin,
            { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          ],
        ],
      },
    })
    await settle()
    return { wrapper, router }
  }

  it('показывает карточку «График точки · название», пояс «Москва · UTC+3», подсказки и подвал шага', async () => {
    const { wrapper } = await mountPage()
    expect(wrapper.get('h1').text()).toBe('Когда вы отвечаете клиентам?')
    expect(wrapper.get('#hours-title').text()).toBe('График точки · Студия на Тверской')
    expect(wrapper.text()).toContain('Москва · UTC+3')
    expect(wrapper.text()).toContain('Для копирования используется первый рабочий день.')
    expect(wrapper.text()).toContain('Далее: Услуги и цены')
    expect(wrapper.text()).toContain('Настройки можно изменить позже в разделе «Настройки».')
    expect(wrapper.findAll('li input[type="checkbox"]')).toHaveLength(7)
    wrapper.unmount()
  })

  it('первичная загрузка: каркас карточки, кнопка шага неактивна, «Назад» доступна', async () => {
    locationsResponse = () => new Promise(() => {})
    const { wrapper } = await mountPage()
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Загрузка точек')
    expect(wrapper.find('input').exists()).toBe(false)
    const buttons = wrapper.findAll('button')
    expect(buttons.map((button) => button.text())).toEqual(['Назад'])
    expect(wrapper.text()).toContain('Сохранить и продолжить')
    wrapper.unmount()
  })

  it('ошибка проверки: запрос не уходит, под днём «Время окончания должно быть позже начала.», фокус на поле', async () => {
    const { wrapper } = await mountPage()
    await wrapper.get('input[name="opens-1"]').setValue('20:00')
    await wrapper.get('input[name="closes-1"]').setValue('09:00')
    const next = wrapper.findAll('button').find((b) => b.text() === 'Сохранить и продолжить')!
    await next.trigger('click')
    await settle()
    expect(calls.some((call) => call.startsWith('PUT'))).toBe(false)
    expect(wrapper.text()).toContain('Время окончания должно быть позже начала.')
    expect(wrapper.get('input[name="opens-1"]').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('input[name="closes-1"]').attributes('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(wrapper.get('input[name="opens-1"]').element)
    wrapper.unmount()
  })

  it('сохранение: «Сохраняем…» с прежним именем кнопки, поля заблокированы; успех ведёт к шагу 3', async () => {
    let finish: (response: Response) => void = () => {}
    hoursResponse = () => new Promise((resolve) => (finish = resolve))
    const { wrapper, router } = await mountPage()
    await wrapper.get('input[name="closes-6"]').setValue('18:30')
    const next = wrapper.findAll('button').find((b) => b.text() === 'Сохранить и продолжить')!
    await next.trigger('click')
    await settle()
    const busy = wrapper.get('button[aria-busy="true"]')
    expect(busy.get('span[aria-hidden="true"]').text()).toBe('Сохраняем…')
    expect(busy.get('.sr-only').text()).toBe('Сохранить и продолжить')
    expect(wrapper.get('input[name="closes-6"]').attributes('disabled')).toBeDefined()
    finish(json({ ...location, businessHours: week }))
    await settle()
    expect(router.currentRoute.value.name).toBe('onboarding-services')
    wrapper.unmount()
  })

  it('равные время открытия и закрытия — ошибка; поля связаны с текстом ошибки', async () => {
    const { wrapper } = await mountPage()
    await wrapper.get('input[name="opens-2"]').setValue('09:00')
    await wrapper.get('input[name="closes-2"]').setValue('09:00')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Сохранить и продолжить')!
      .trigger('click')
    await settle()
    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toBe('Время окончания должно быть позже начала.')
    for (const name of ['opens-2', 'closes-2']) {
      expect(wrapper.get(`input[name="${name}"]`).attributes('aria-describedby')).toBe(
        alert.attributes('id'),
      )
    }
    expect(calls.some((call) => call.startsWith('PUT'))).toBe(false)
    wrapper.unmount()
  })

  it('00:00–23:59 у понедельника и выходное воскресенье уходят в одном PUT без времени у выходного', async () => {
    const { wrapper } = await mountPage()
    await wrapper.get('input[name="opens-1"]').setValue('00:00')
    await wrapper.get('input[name="closes-1"]').setValue('23:59')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Сохранить и продолжить')!
      .trigger('click')
    await settle()
    expect(bodies).toHaveLength(1)
    const days = (
      bodies[0] as {
        days: { weekday: number; closed: boolean; opensAt?: string; closesAt?: string }[]
      }
    ).days
    expect(days).toHaveLength(7)
    expect(days[0]).toMatchObject({
      weekday: 1,
      closed: false,
      opensAt: '00:00',
      closesAt: '23:59',
    })
    expect(days[6]).toEqual({ weekday: 7, closed: true })
    wrapper.unmount()
  })

  it('включение воскресенья даёт семь рабочих дней в теле запроса', async () => {
    const { wrapper } = await mountPage()
    await wrapper.get('input[name="day-7"]').setValue(true)
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Сохранить и продолжить')!
      .trigger('click')
    await settle()
    const days = (bodies[0] as { days: { closed: boolean }[] }).days
    expect(days.every((day) => day.closed === false)).toBe(true)
    wrapper.unmount()
  })

  it('двойное нажатие «Сохранить и продолжить» отправляет неделю один раз', async () => {
    hoursResponse = () => new Promise(() => {})
    const { wrapper } = await mountPage()
    await wrapper.get('input[name="closes-6"]').setValue('18:30')
    const next = wrapper.findAll('button').find((b) => b.text() === 'Сохранить и продолжить')!
    await next.trigger('click')
    await next.trigger('click')
    await settle()
    expect(bodies).toHaveLength(1)
    wrapper.unmount()
  })

  it('сбой сервера: остаёмся на шаге 2, видна плашка с идентификатором запроса, данные не потеряны', async () => {
    hoursResponse = async () =>
      json({ error: { code: 'INTERNAL', message: 'boom', traceId: 't-42' } }, 500)
    const { wrapper, router } = await mountPage()
    await wrapper.get('input[name="closes-6"]').setValue('18:30')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Сохранить и продолжить')!
      .trigger('click')
    await settle()
    expect(router.currentRoute.value.name).toBe('onboarding-location')
    expect(wrapper.text()).toContain('t-42')
    expect((wrapper.get('input[name="closes-6"]').element as HTMLInputElement).value).toBe('18:30')
    wrapper.unmount()
  })

  it('«Назад» ведёт к шагу 1', async () => {
    const { wrapper, router } = await mountPage()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Назад')!
      .trigger('click')
    await settle()
    expect(router.currentRoute.value.name).toBe('onboarding-company')
    wrapper.unmount()
  })

  it('без точки показывается форма первой точки, а не график', async () => {
    locationsResponse = async () => json({ items: [] })
    const { wrapper } = await mountPage()
    expect(wrapper.get('#first-location-title').text()).toBe('Первая точка')
    expect(wrapper.find('#hours-title').exists()).toBe(false)
    wrapper.unmount()
  })
})
