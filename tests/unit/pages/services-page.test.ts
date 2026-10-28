import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '@/app/router/routes'
import { fetchMe, useSessionStore } from '@/entities/session'
import { ServicesPage } from '@/pages/onboarding'

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
const service = {
  id: 's-1',
  locationId: null,
  name: 'Полировка кузова',
  normalizedName: 'полировка кузова',
  priceFrom: '31000.00',
  priceTo: '31000.00',
  currency: 'RUB',
  active: true,
  createdAt: '2026-09-01T09:00:00Z',
  updatedAt: '2026-09-01T09:00:00Z',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

/** Шаг 3 «Услуги и цены» (US-M02-03): каталог, форма, подсказки, состояния по макетам. */
describe('страница «Услуги и цены» (шаг 3)', () => {
  let servicesResponse: () => Promise<Response>
  let locationsResponse: () => Promise<Response>
  let createResponse: () => Promise<Response>
  let posts: unknown[]

  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    posts = []
    vi.mocked(fetchMe).mockResolvedValue({
      user,
      memberships: [{ tenantId: 't-1', organizationName: 'Студия', role: 'OWNER' }],
      canCreateOrganization: false,
    })
    await useSessionStore().bootstrap()
    servicesResponse = async () => json({ items: [service] })
    locationsResponse = async () => json({ items: [] })
    createResponse = async () => json({ ...service, id: 's-2', name: 'Керамика' }, 201)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        const path = new URL(request.url).pathname
        if (path === '/api/v1/services' && request.method === 'POST') {
          posts.push(await request.clone().json())
          return createResponse()
        }
        if (path === '/api/v1/services') return servicesResponse()
        if (path === '/api/v1/locations') return locationsResponse()
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
    await router.push('/onboarding/services')
    await router.isReady()
    const wrapper = mount(ServicesPage, {
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

  it('показывает каталог с точкой и ценой, форму, подсказку про диапазон и подвал шага', async () => {
    const { wrapper } = await mountPage()
    expect(wrapper.get('h1').text()).toBe('Добавьте основные услуги')
    const row = wrapper.get('ul[aria-label="Добавленные услуги"] li')
    expect(row.text()).toContain('Полировка кузова')
    expect(row.text()).toContain('Все точки')
    expect(row.text().replace(/\s/g, ' ')).toContain('31 000 ₽')
    expect(wrapper.text()).toContain('Название — до 200 символов')
    expect(wrapper.text()).toContain('Диапазон не подменяет точную сумму')
    expect(wrapper.text()).toContain('Пустое поле — цена неизвестна.')
    expect(wrapper.text()).toContain('Далее: Источник сообщений')
    expect(wrapper.get('input[name="priceFrom"]').attributes('placeholder')).toBe('Не указана')
    wrapper.unmount()
  })

  it('цена «до» меньше цены «от»: запрос не уходит, оба поля красные, ошибка заменяет подсказку', async () => {
    const { wrapper } = await mountPage()
    await wrapper.get('input[name="serviceName"]').setValue('Керамика')
    await wrapper.get('input[name="priceFrom"]').setValue('90000')
    await wrapper.get('input[name="priceTo"]').setValue('50000')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(posts).toHaveLength(0)
    const note = wrapper.get('#service-price-note')
    expect(note.text()).toBe('Цена «до» не может быть меньше цены «от».')
    // Постоянная живая область: текст меняется с подсказки на ошибку, и читалка её озвучивает.
    expect(note.attributes('aria-live')).toBe('polite')
    expect(wrapper.text()).not.toContain('Пустое поле — цена неизвестна.')
    for (const name of ['priceFrom', 'priceTo']) {
      expect(wrapper.get(`input[name="${name}"]`).attributes('aria-invalid')).toBe('true')
      expect(wrapper.get(`input[name="${name}"]`).attributes('aria-describedby')).toBe(
        'service-price-note',
      )
    }
    wrapper.unmount()
  })

  it('пустые цены уходят как null; «Добавляем…» сохраняет имя кнопки; форма очищается после успеха', async () => {
    let finish: (response: Response) => void = () => {}
    createResponse = () => new Promise((resolve) => (finish = resolve))
    const { wrapper } = await mountPage()
    await wrapper.get('input[name="serviceName"]').setValue('Керамика')
    await wrapper.get('form').trigger('submit')
    await settle()
    const busy = wrapper.get('button[aria-busy="true"]')
    expect(busy.get('span[aria-hidden="true"]').text()).toBe('Добавляем…')
    expect(busy.get('.sr-only').text()).toBe('Добавить услугу')
    expect(wrapper.get('input[name="serviceName"]').attributes('disabled')).toBeDefined()
    expect(posts).toEqual([
      { name: 'Керамика', locationId: null, priceFrom: null, priceTo: null, currency: 'RUB' },
    ])
    finish(json({ ...service, id: 's-2', name: 'Керамика' }, 201))
    await settle()
    expect((wrapper.get('input[name="serviceName"]').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })

  it('двойная отправка даёт один запрос', async () => {
    createResponse = () => new Promise(() => {})
    const { wrapper } = await mountPage()
    await wrapper.get('input[name="serviceName"]').setValue('Керамика')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(posts).toHaveLength(1)
    wrapper.unmount()
  })

  it('первичная загрузка: каркасы карточек, без полей; «Назад» доступна, «Продолжить» — не кнопка', async () => {
    servicesResponse = () => new Promise(() => {})
    const { wrapper } = await mountPage()
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Загрузка услуг')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual(['Назад'])
    expect(wrapper.text()).toContain('Продолжить')
    wrapper.unmount()
  })

  it('три услуги подряд: каждая появляется в «Добавленные услуги», фокус возвращается к названию', async () => {
    const items = [service]
    servicesResponse = async () => json({ items })
    createResponse = async () => {
      const created = { ...service, id: `s-${items.length + 1}`, name: `Услуга ${items.length}` }
      items.push(created)
      return json(created, 201)
    }
    const { wrapper } = await mountPage()
    for (const title of ['Первая', 'Вторая', 'Третья']) {
      await wrapper.get('input[name="serviceName"]').setValue(title)
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(document.activeElement).toBe(wrapper.get('input[name="serviceName"]').element)
    }
    expect(posts).toHaveLength(3)
    expect(wrapper.findAll('ul[aria-label="Добавленные услуги"] li')).toHaveLength(4)
    wrapper.unmount()
  })

  it('«Отмена» очищает введённое и остаётся на шаге; фокус на названии', async () => {
    const { wrapper, router } = await mountPage()
    await wrapper.get('input[name="serviceName"]').setValue('Черновик')
    await wrapper.get('input[name="priceFrom"]').setValue('100')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Отмена')!
      .trigger('click')
    await settle()
    expect((wrapper.get('input[name="serviceName"]').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('input[name="priceFrom"]').element as HTMLInputElement).value).toBe('')
    expect(router.currentRoute.value.name).toBe('onboarding-services')
    expect(document.activeElement).toBe(wrapper.get('input[name="serviceName"]').element)
    wrapper.unmount()
  })

  it('ошибка сервера: введённое сохраняется, фокус на названии, плашка с идентификатором', async () => {
    createResponse = async () =>
      json({ error: { code: 'INTERNAL', message: 'boom', traceId: 't-77' } }, 500)
    const { wrapper } = await mountPage()
    await wrapper.get('input[name="serviceName"]').setValue('Керамика')
    await wrapper.get('input[name="priceFrom"]').setValue('5000')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.text()).toContain('t-77')
    expect((wrapper.get('input[name="serviceName"]').element as HTMLInputElement).value).toBe(
      'Керамика',
    )
    expect(document.activeElement).toBe(wrapper.get('input[name="serviceName"]').element)
    wrapper.unmount()
  })

  it('пока не пришли точки, показывается каркас: услугу нельзя привязать к неизвестной точке', async () => {
    locationsResponse = () => new Promise(() => {})
    const { wrapper } = await mountPage()
    expect(wrapper.find('input[name="serviceName"]').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Загрузка услуг')
    wrapper.unmount()
  })

  it('«Назад» ведёт к шагу 2, «Продолжить» — к шагу 4', async () => {
    const { wrapper, router } = await mountPage()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Продолжить')!
      .trigger('click')
    await settle()
    expect(router.currentRoute.value.name).toBe('onboarding-channel')
    await router.push('/onboarding/services')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Назад')!
      .trigger('click')
    await settle()
    expect(router.currentRoute.value.name).toBe('onboarding-location')
    wrapper.unmount()
  })

  it('пустой каталог: «Услуг пока нет.»; сбой загрузки: плашка с повтором', async () => {
    servicesResponse = async () => json({ items: [] })
    const first = await mountPage()
    expect(first.wrapper.text()).toContain('Услуг пока нет.')
    first.wrapper.unmount()
    servicesResponse = async () =>
      json({ error: { code: 'INTERNAL', message: 'x', traceId: 't-5' } }, 500)
    const second = await mountPage()
    expect(second.wrapper.text()).toContain('Не удалось загрузить услуги')
    second.wrapper.unmount()
  })
})
