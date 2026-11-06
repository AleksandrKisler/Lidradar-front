import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
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

interface Hour {
  weekday: number
  closed: boolean
  opensAt?: string
  closesAt?: string
}
interface ServerLocation {
  id: string
  name: string
  timezone: string
  responseThresholdMinutes: number
  agreementThresholdMinutes: number
  active: boolean
  businessHours: Hour[]
  createdAt: string
  updatedAt: string
}

/** Сохранённая неделя в серверном формате: Пн–Пт 09:00–20:00, Сб 10:00–18:00, Вс выходной. */
const savedWeek = (): Hour[] =>
  [1, 2, 3, 4, 5, 6, 7].map((weekday) =>
    weekday === 7
      ? { weekday, closed: true }
      : weekday === 6
        ? { weekday, closed: false, opensAt: '10:00:00', closesAt: '18:00:00' }
        : { weekday, closed: false, opensAt: '09:00:00', closesAt: '20:00:00' },
  )
const point = (id: string, name: string, hours: Hour[] = savedWeek()): ServerLocation => ({
  id,
  name,
  timezone: 'Europe/Moscow',
  responseThresholdMinutes: 45,
  agreementThresholdMinutes: 120,
  active: true,
  businessHours: hours,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const failure = (status: number, code = 'VALIDATION_ERROR') =>
  json({ error: { code, message: 'x', traceId: 't-42' } }, status)
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

type Handler = (request: Request, body: unknown) => Promise<Response | null> | Response | null

/** Шаг 2 «Точки и графики» (US-M02-04, AC-M02-04-01–24): единый экран, черновики по ID, POST → PUT. */
describe('страница «Точки и графики» (шаг 2)', () => {
  let server: ServerLocation[]
  let calls: string[]
  let puts: { id: string; body: { timezone: string; days: Hour[] } }[]
  /** Разовые подмены ответов: первый подходящий обработчик снимается после срабатывания. */
  let overrides: { match: string; handler: Handler }[]
  let created: number
  /** Список недоступен, пока флаг поднят. */
  let listDown: boolean

  function override(match: string, handler: Handler): void {
    overrides.push({ match, handler })
  }

  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    server = [point('loc-1', 'Студия на Тверской')]
    calls = []
    puts = []
    overrides = []
    created = 0
    listDown = false
    vi.mocked(fetchMe).mockResolvedValue({
      user,
      memberships: [{ tenantId: 't-1', organizationName: 'Студия', role: 'OWNER' }],
      canCreateOrganization: false,
    })
    await useSessionStore().bootstrap()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        const path = new URL(request.url).pathname
        const key = `${request.method} ${path}`
        calls.push(key)
        const body = ['POST', 'PUT', 'PATCH'].includes(request.method)
          ? await request.clone().json()
          : null
        const index = overrides.findIndex((item) => key.startsWith(item.match))
        if (index >= 0) {
          const [item] = overrides.splice(index, 1)
          const response = await item!.handler(request, body)
          if (response) return response
        }
        if (key === 'GET /api/v1/locations')
          return listDown ? failure(500, 'INTERNAL') : json({ items: server })
        if (key === 'POST /api/v1/locations') {
          created += 1
          const next = { ...point(`new-${created}`, (body as { name: string }).name, []) }
          next.timezone = (body as { timezone: string }).timezone
          server.push(next)
          return json(next, 201)
        }
        const hours = path.match(/^\/api\/v1\/locations\/([^/]+)\/business-hours$/)
        if (hours && request.method === 'PUT') {
          const payload = body as { timezone: string; days: Hour[] }
          puts.push({ id: hours[1]!, body: payload })
          const target = server.find((item) => item.id === hours[1])!
          target.timezone = payload.timezone
          target.businessHours = payload.days.map((day) =>
            day.closed
              ? { weekday: day.weekday, closed: true }
              : { ...day, opensAt: `${day.opensAt}:00`, closesAt: `${day.closesAt}:00` },
          )
          return json(target)
        }
        const patch = path.match(/^\/api\/v1\/locations\/([^/]+)$/)
        if (patch && request.method === 'PATCH') {
          const target = server.find((item) => item.id === patch[1])!
          Object.assign(target, body)
          return json(target)
        }
        if (path === '/api/v1/organization/onboarding') {
          const done = server.some((item) => item.active && item.businessHours.length === 7)
          return json({
            complete: false,
            nextStep: done ? 'SERVICES' : 'LOCATION',
            steps: [
              { key: 'ORGANIZATION', done: true },
              { key: 'LOCATION', done },
              { key: 'SERVICES', done: false },
              { key: 'CHANNEL', done: false },
            ],
          })
        }
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
        return failure(404, 'NOT_FOUND')
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

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

  const continueButton = (wrapper: VueWrapper) => wrapper.get('[data-testid="location-continue"]')
  const cards = (wrapper: VueWrapper) => wrapper.findAll('[data-testid="location-card"]')
  const card = (wrapper: VueWrapper, name: string) =>
    cards(wrapper).find((item) => item.text().includes(name))!
  /** Подсказка шага на desktop/планшете и на телефоне (одна причина, два представления). */
  const hintFor = (wrapper: VueWrapper, view: 'desktop' | 'phone') => {
    const element = wrapper.get('#location-step-hint')
    const variant = element.find(`[data-hint="${view}"]`)
    return variant.exists() ? variant.text() : element.text()
  }
  const hint = (wrapper: VueWrapper) => hintFor(wrapper, 'desktop')
  const putsCount = () => calls.filter((call) => call.startsWith('PUT ')).length
  const postsCount = () => calls.filter((call) => call === 'POST /api/v1/locations').length
  const dialogInput = (name: string) =>
    document.body.querySelector<HTMLInputElement>(`[role="dialog"] input[name="${name}"]`)
  const dialogButton = (label: string) =>
    [...document.body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
      (button) => button.textContent?.trim() === label,
    )

  async function createPoint(wrapper: VueWrapper, name: string): Promise<void> {
    await wrapper.get('[data-testid="add-location"]').trigger('click')
    await settle()
    const input = dialogInput('locationName')!
    input.value = name
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    dialogButton('Добавить точку')!.click()
    await settle()
    await settle()
  }

  async function setDay(wrapper: VueWrapper, weekday: number, opens: string, closes: string) {
    await wrapper.get(`input[name="opens-${weekday}"]`).setValue(opens)
    await wrapper.get(`input[name="closes-${weekday}"]`).setValue(closes)
  }

  it('AC-01/22: единый экран — заголовки, точки слева с карандашом, график выбранной справа', async () => {
    const { wrapper } = await mountPage()
    const title = wrapper.get('h1')
    expect(title.get('.max-md\\:hidden').text()).toBe('Точки и графики работы')
    expect(title.get('.md\\:hidden').text()).toBe('Точки и графики')
    expect(wrapper.get('#hours-title').text()).toBe('График · Студия на Тверской')
    expect(wrapper.text()).toContain('Москва · UTC+3')
    expect(card(wrapper, 'Студия на Тверской').text()).toContain('График заполнен')
    expect(wrapper.find('[aria-label="Изменить точку «Студия на Тверской»"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="add-location"]').attributes('aria-label')).toBe(
      'Добавить точку',
    )
    expect(hint(wrapper)).toBe('Далее: Услуги и цены')
    expect(continueButton(wrapper).attributes('disabled')).toBeUndefined()
    expect(wrapper.findAll('li input[type="checkbox"]')).toHaveLength(7)
    wrapper.unmount()
  })

  it('AC-02: без точек — баннер, график и копирование недоступны, сохранение недоступно, плюс доступен', async () => {
    server = []
    const { wrapper } = await mountPage()
    expect(wrapper.text()).toContain('Сначала добавьте точку')
    expect(wrapper.text()).toContain('Точек пока нет')
    expect(wrapper.get('input[name="opens-1"]').attributes('disabled')).toBeDefined()
    const copy = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Применить ко всем рабочим дням')
    expect(copy!.attributes('disabled')).toBeDefined()
    expect(continueButton(wrapper).attributes('disabled')).toBeDefined()
    expect(hint(wrapper)).toBe('Сначала добавьте точку.')
    expect(wrapper.get('[data-testid="add-location"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('AC-18: первичная загрузка — каркас, плюс и сохранение недоступны, пустой список не объявлен', async () => {
    override('GET /api/v1/locations', () => new Promise(() => {}))
    const { wrapper } = await mountPage()
    expect(wrapper.get('[role="status"][aria-label="Загрузка точек"]').text()).toContain(
      'Загружаем точки…',
    )
    expect(wrapper.text()).not.toContain('Точек пока нет')
    expect(wrapper.get('[data-testid="add-location"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('input[name="opens-1"]').attributes('disabled')).toBeDefined()
    expect(continueButton(wrapper).attributes('disabled')).toBeDefined()
    expect(hint(wrapper)).toBe('Загружаем точки и графики…')
    wrapper.unmount()
  })

  it('AC-03/04/05: плюс → модалка; пустое название не создаёт; POST → PUT 10–19 с выходным Вс; продолжение без правки', async () => {
    server = []
    const { wrapper, router } = await mountPage()
    await wrapper.get('[data-testid="add-location"]').trigger('click')
    await settle()
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain(
      'График настраивается на этом же шаге',
    )
    // Окно открывается с фокусом на названии (Figma 02, F-S4).
    expect(document.activeElement).toBe(dialogInput('locationName'))
    dialogButton('Добавить точку')!.click()
    await settle()
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain(
      'Введите название точки.',
    )
    expect(postsCount()).toBe(0)
    document.body.querySelector<HTMLButtonElement>('[aria-label="Закрыть"]')!.click()
    await settle()

    await createPoint(wrapper, 'Студия на Арбате')
    expect(postsCount()).toBe(1)
    expect(puts).toHaveLength(1)
    expect(puts[0]!.id).toBe('new-1')
    expect(puts[0]!.body.timezone).toBe('Europe/Moscow')
    expect(puts[0]!.body.days).toEqual([
      ...[1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        closed: false,
        opensAt: '10:00',
        closesAt: '19:00',
      })),
      { weekday: 7, closed: true },
    ])
    expect(cards(wrapper)).toHaveLength(1)
    expect(wrapper.get('#hours-title').text()).toBe('График · Студия на Арбате')
    expect(card(wrapper, 'Студия на Арбате').text()).toContain('График заполнен')
    expect(continueButton(wrapper).attributes('disabled')).toBeUndefined()

    await continueButton(wrapper).trigger('click')
    await settle()
    // Подтверждённый default не отправляется повторно.
    expect(puts).toHaveLength(1)
    expect(router.currentRoute.value.name).toBe('onboarding-services')
    wrapper.unmount()
  })

  it('R4-N1: под открытым окном кнопка шага серая без точек и обычная у готового шага', async () => {
    const grey = 'bg-line!'
    server = []
    const empty = await mountPage()
    await empty.wrapper.get('[data-testid="add-location"]').trigger('click')
    await settle()
    expect(continueButton(empty.wrapper).attributes('disabled')).toBeDefined()
    expect(continueButton(empty.wrapper).classes()).toContain(grey)
    empty.wrapper.unmount()
    document.body.innerHTML = ''

    server = [point('loc-1', 'Студия на Тверской')]
    const ready = await mountPage()
    expect(continueButton(ready.wrapper).classes()).not.toContain(grey)
    await ready.wrapper.get('[aria-label="Изменить точку «Студия на Тверской»"]').trigger('click')
    await settle()
    expect(continueButton(ready.wrapper).attributes('disabled')).toBeDefined()
    expect(continueButton(ready.wrapper).classes()).not.toContain(grey)
    // Готовый шаг под окном не бледнеет (Figma 06): недоступность только в атрибуте.
    expect(continueButton(ready.wrapper).classes()).toContain('opacity-100!')
    ready.wrapper.unmount()
  })

  it('AC-05: двойное нажатие «Добавить точку» даёт один POST', async () => {
    server = []
    let release: () => void = () => {}
    override(
      'POST /api/v1/locations',
      () =>
        new Promise<null>((resolve) => {
          release = () => resolve(null)
        }),
    )
    const { wrapper } = await mountPage()
    await wrapper.get('[data-testid="add-location"]').trigger('click')
    await settle()
    const input = dialogInput('locationName')!
    input.value = 'Студия'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    dialogButton('Добавить точку')!.click()
    await flushPromises()
    dialogButton('Добавить точку')!.click()
    await settle()
    release()
    await settle()
    await settle()
    expect(postsCount()).toBe(1)
    expect(cards(wrapper)).toHaveLength(1)
    wrapper.unmount()
  })

  it('Codex-R2 п.3 / AC-04: «Добавить точку» доступна до ввода; пустое название — ошибка без POST; после исправления точка создаётся', async () => {
    server = []
    let release: () => void = () => {}
    override(
      'POST /api/v1/locations',
      () =>
        new Promise<null>((resolve) => {
          release = () => resolve(null)
        }),
    )
    const { wrapper } = await mountPage()
    await wrapper.get('[data-testid="add-location"]').trigger('click')
    await settle()
    const submit = () =>
      document.body.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')!
    // До ввода кнопка доступна и не выглядит недоступной: без атрибута и без серых классов.
    expect(submit().textContent?.trim()).toBe('Добавить точку')
    expect(submit().disabled).toBe(false)
    expect(submit().getAttribute('aria-disabled')).toBeNull()
    expect(submit().className).not.toMatch(/(^|\s)(bg-line|opacity-45|cursor-not-allowed)!?(\s|$)/)

    submit().click()
    await settle()
    const dialogText = () => document.body.querySelector('[role="dialog"]')!.textContent ?? ''
    expect(dialogText()).toContain('Введите название точки.')
    expect(dialogInput('locationName')!.getAttribute('aria-invalid')).toBe('true')
    expect(postsCount()).toBe(0)
    // Отправка формы (Enter в поле) идёт тем же путём проверки.
    document.body.querySelector<HTMLFormElement>('[role="dialog"] form')!.requestSubmit()
    await settle()
    expect(dialogText()).toContain('Введите название точки.')
    expect(postsCount()).toBe(0)
    expect(submit().disabled).toBe(false)

    const input = dialogInput('locationName')!
    input.value = 'Студия на Арбате'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    submit().click()
    await settle()
    // Во время отправки блокировка сохраняется.
    expect(submit().disabled).toBe(true)
    release()
    await settle()
    await settle()
    expect(postsCount()).toBe(1)
    expect(cards(wrapper)).toHaveLength(1)
    wrapper.unmount()
  })

  it('M-1 / US-M02-02 B1–B3: ошибки обоих порогов в окне мастера, без POST; границы 1 и 1440 принимаются', async () => {
    server = []
    const { wrapper } = await mountPage()
    await wrapper.get('[data-testid="add-location"]').trigger('click')
    await settle()
    const setInput = async (name: string, value: string) => {
      const input = dialogInput(name)!
      input.value = value
      input.dispatchEvent(new Event('input'))
      await flushPromises()
    }
    const submitDialog = async () => {
      document.body
        .querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')!
        .click()
      await settle()
    }
    const fieldError = (name: string) => {
      const input = dialogInput(name)!
      const id = input
        .getAttribute('aria-describedby')
        ?.split(' ')
        .find((part) => part.endsWith('-error'))
      return id ? document.getElementById(id)!.textContent?.trim() : null
    }
    await setInput('locationName', 'Студия')
    for (const field of ['responseThresholdMinutes', 'agreementThresholdMinutes']) {
      const other =
        field === 'responseThresholdMinutes'
          ? 'agreementThresholdMinutes'
          : 'responseThresholdMinutes'
      await setInput(other, '60')
      for (const [value, message] of [
        ['0', 'От 1 до 1440 минут.'],
        ['1441', 'От 1 до 1440 минут.'],
        ['abc', 'Порог — целое число минут.'],
      ] as const) {
        await setInput(field, value)
        await submitDialog()
        expect(fieldError(field), `${field} = ${value}`).toBe(message)
        expect(fieldError(other)).toBeNull()
        expect(postsCount()).toBe(0)
      }
      await setInput(field, '60')
    }
    await setInput('responseThresholdMinutes', '1')
    await setInput('agreementThresholdMinutes', '1440')
    await submitDialog()
    await settle()
    expect(postsCount()).toBe(1)
    const post = vi
      .mocked(fetch)
      .mock.calls.map(([request]) => request as Request)
      .find((request) => request.method === 'POST')!
    expect(await post.json()).toMatchObject({
      responseThresholdMinutes: 1,
      agreementThresholdMinutes: 1440,
    })
    wrapper.unmount()
  })

  it('AC-17: во время PUT после POST 201 виден индикатор, повтор и плюс недоступны', async () => {
    server = []
    let release: () => void = () => {}
    override(
      'PUT /api/v1/locations/new-1',
      () =>
        new Promise<null>((resolve) => {
          release = () => resolve(null)
        }),
    )
    const { wrapper } = await mountPage()
    await createPoint(wrapper, 'Студия')
    expect(wrapper.text()).toContain('Сохраняем график точки…')
    expect(hint(wrapper)).toBe('Сохраняем график точки…')
    expect(wrapper.find('[role="status"] svg').exists()).toBe(true)
    expect(continueButton(wrapper).attributes('aria-busy')).toBe('true')
    expect(continueButton(wrapper).text()).toContain('Сохраняем…')
    expect(wrapper.get('[data-testid="add-location"]').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('button').some((b) => b.text() === 'Повторить сохранение')).toBe(false)
    release()
    await settle()
    expect(wrapper.text()).not.toContain('Сохраняем график точки…')
    expect(continueButton(wrapper).attributes('disabled')).toBeUndefined()
    expect(puts).toHaveLength(1)
    wrapper.unmount()
  })

  it('AC-16/17: POST 201 → PUT 400 — точка и неделя остаются, повтор только PUT того же ID', async () => {
    server = []
    override('PUT /api/v1/locations/new-1', () => failure(400))
    const { wrapper } = await mountPage()
    await createPoint(wrapper, 'Студия на Арбате')
    expect(postsCount()).toBe(1)
    expect(cards(wrapper)).toHaveLength(1)
    expect(wrapper.text()).toContain('Не удалось сохранить график точки')
    expect(card(wrapper, 'Студия на Арбате').text()).toContain('График заполнен')
    expect((wrapper.get('input[name="opens-1"]').element as HTMLInputElement).value).toBe('10:00')
    expect(continueButton(wrapper).attributes('disabled')).toBeDefined()
    expect(hint(wrapper)).toBe('Сохраните график точки: Студия на Арбате.')

    const retry = wrapper.findAll('button').find((b) => b.text() === 'Повторить сохранение')!
    await retry.trigger('click')
    await settle()
    expect(postsCount()).toBe(1)
    expect(calls.filter((call) => call.startsWith('DELETE'))).toHaveLength(0)
    expect(puts.map((item) => item.id)).toEqual(['new-1'])
    expect(continueButton(wrapper).attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('AC-16: POST 201 → PUT 503 — свежий GET сверяет; совпадение подтверждает без второго PUT', async () => {
    server = []
    override('PUT /api/v1/locations/new-1', (_request, body) => {
      // Сервер успел записать неделю, но ответ потерян.
      const target = server.find((item) => item.id === 'new-1')!
      const payload = body as { timezone: string; days: Hour[] }
      target.businessHours = payload.days.map((day) =>
        day.closed ? day : { ...day, opensAt: `${day.opensAt}:00`, closesAt: `${day.closesAt}:00` },
      )
      return failure(503, 'INTERNAL')
    })
    const { wrapper } = await mountPage()
    await createPoint(wrapper, 'Студия')
    expect(
      calls.filter((call) => call === 'PUT /api/v1/locations/new-1/business-hours'),
    ).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Не удалось сохранить график точки')
    expect(continueButton(wrapper).attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('AC-16: unknown PUT и недоступный GET — без автозаписи; повтор сначала читает, затем ручной PUT', async () => {
    server = []
    override('PUT /api/v1/locations/new-1', () => failure(503, 'INTERNAL'))
    const { wrapper } = await mountPage()
    // Сверочное чтение после неизвестного исхода тоже недоступно.
    listDown = true
    await createPoint(wrapper, 'Студия')
    expect(putsCount()).toBe(1)
    expect(wrapper.text()).toContain('Не удалось проверить, сохранился ли график')
    listDown = false

    const retry = () => wrapper.findAll('button').find((b) => b.text() === 'Повторить сохранение')!
    await retry().trigger('click')
    await settle()
    // Первый повтор — только сверка: сервер графика не имеет, нужен ручной PUT.
    expect(putsCount()).toBe(1)
    await retry().trigger('click')
    await settle()
    expect(putsCount()).toBe(2)
    expect(postsCount()).toBe(1)
    expect(continueButton(wrapper).attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('AC-16: неизвестный исход POST — сверка списка без повторного POST; новая точка получает повтор PUT', async () => {
    server = []
    override('POST /api/v1/locations', (_request, body) => {
      server.push(point('srv-9', (body as { name: string }).name, []))
      return failure(504, 'INTERNAL')
    })
    const { wrapper } = await mountPage()
    await createPoint(wrapper, 'Студия')
    expect(postsCount()).toBe(1)
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(cards(wrapper)).toHaveLength(1)
    expect(putsCount()).toBe(0)
    expect(wrapper.text()).toContain('График точки ещё не сохранён')
    const save = wrapper.findAll('button').find((b) => b.text() === 'Сохранить график')!
    await save.trigger('click')
    await settle()
    expect(puts.map((item) => item.id)).toEqual(['srv-9'])
    expect(postsCount()).toBe(1)
    wrapper.unmount()
  })

  it('AC-07–11: неверная A → B → A — без PUT, ошибка и значения сохранены, B не разблокирует шаг', async () => {
    server = [point('loc-1', 'Студия на Тверской'), point('loc-2', 'Студия на Арбате')]
    const { wrapper } = await mountPage()
    await setDay(wrapper, 1, '20:00', '09:00')
    expect(wrapper.text()).toContain('Время окончания должно быть позже времени начала.')
    const opens = wrapper.get('input[name="opens-1"]')
    expect(opens.attributes('aria-invalid')).toBe('true')
    expect(opens.attributes('aria-describedby')).toBe('location-loc-1-day-error-1')
    expect(card(wrapper, 'Тверской').text()).toContain('График заполнен неверно')
    expect(hint(wrapper)).toBe('Исправьте время в понедельник, чтобы продолжить.')
    // N-3: предлог по дню — «во вторник».
    await setDay(wrapper, 1, '09:00', '20:00')
    await setDay(wrapper, 2, '20:00', '09:00')
    expect(hint(wrapper)).toBe('Исправьте время во вторник, чтобы продолжить.')
    // Codex-R2 п.5: телефон называет точку (Figma phone-08), день виден под селектором.
    expect(hintFor(wrapper, 'phone')).toBe('Исправьте график: Студия на Тверской.')
    expect(wrapper.get('[data-hint="phone"]').classes()).toContain('md:hidden')
    expect(wrapper.get('[data-hint="desktop"]').classes()).toContain('max-md:hidden')
    expect(continueButton(wrapper).attributes('aria-describedby')).toBe('location-step-hint')
    await setDay(wrapper, 2, '09:00', '20:00')
    await setDay(wrapper, 1, '20:00', '09:00')
    // Телефон: статус выбранной точки под селектором и связан с ним (Figma phone-08).
    expect(wrapper.get('#location-select-status').text()).toBe('График заполнен неверно')
    expect(wrapper.get('select[name="location"]').attributes('aria-describedby')).toBe(
      'location-select-status',
    )

    await card(wrapper, 'Арбате').trigger('click')
    await settle()
    expect(wrapper.get('#hours-title').text()).toBe('График · Студия на Арбате')
    expect((wrapper.get('input[name="opens-1"]').element as HTMLInputElement).value).toBe('09:00')
    expect(wrapper.find('#location-select-status').exists()).toBe(false)
    expect(card(wrapper, 'Тверской').text()).toContain('График заполнен неверно')
    expect(hint(wrapper)).toBe('Исправьте график: Студия на Тверской.')
    // Ошибка у невыбранной точки: текст одинаков для всех ширин, без второго варианта.
    expect(wrapper.find('[data-hint="phone"]').exists()).toBe(false)
    expect(continueButton(wrapper).attributes('disabled')).toBeDefined()
    // Мобильное пояснение называет проблемную точку и ведёт к ней.
    const back = wrapper
      .findAll('button')
      .find((b) => b.text().startsWith('График заполнен неверно:'))!
    expect(back.text()).toContain('Студия на Тверской')

    await back.trigger('click')
    await settle()
    expect((wrapper.get('input[name="opens-1"]').element as HTMLInputElement).value).toBe('20:00')
    expect((wrapper.get('input[name="closes-1"]').element as HTMLInputElement).value).toBe('09:00')
    expect(wrapper.text()).toContain('Время окончания должно быть позже времени начала.')
    expect(putsCount()).toBe(0)
    wrapper.unmount()
  })

  it('AC-12/13: копирование только при корректном образце и только внутри выбранной точки', async () => {
    server = [point('loc-1', 'Тверская'), point('loc-2', 'Арбат')]
    const { wrapper } = await mountPage()
    const copy = () =>
      wrapper.findAll('button').find((b) => b.text() === 'Применить ко всем рабочим дням')!
    expect(copy().classes()).not.toContain('opacity-45')
    await setDay(wrapper, 1, '11:00', '11:00')
    expect(copy().attributes('disabled')).toBeDefined()
    // N-R7-4: недоступная по образцу ссылка выглядит недоступной (Figma 08).
    expect(copy().classes()).toContain('opacity-45')
    await setDay(wrapper, 1, '11:00', '17:00')
    await copy().trigger('click')
    expect((wrapper.get('input[name="opens-6"]').element as HTMLInputElement).value).toBe('11:00')
    expect(wrapper.find('input[name="opens-7"]').exists()).toBe(false)
    await card(wrapper, 'Арбат').trigger('click')
    await settle()
    expect((wrapper.get('input[name="opens-6"]').element as HTMLInputElement).value).toBe('10:00')
    wrapper.unmount()
  })

  it('AC-15/16: A ACK / B 400 / C не отправлена — повтор пропускает A и сохраняет B и C', async () => {
    server = [point('a', 'A'), point('b', 'B'), point('c', 'C')]
    const { wrapper, router } = await mountPage()
    for (const name of ['A', 'B', 'C']) {
      await card(wrapper, name).trigger('click')
      await settle()
      await setDay(wrapper, 2, '08:00', '17:00')
    }
    override('PUT /api/v1/locations/b', () => failure(400))
    await continueButton(wrapper).trigger('click')
    await settle()
    expect(puts.map((item) => item.id)).toEqual(['a'])
    expect(calls.filter((call) => call.startsWith('PUT ')).length).toBe(2)
    expect(router.currentRoute.value.name).toBe('onboarding-location')
    expect(wrapper.get('#hours-title').text()).toBe('График · B')
    expect(wrapper.text()).toContain('Не удалось сохранить графики')
    expect((wrapper.get('input[name="opens-2"]').element as HTMLInputElement).value).toBe('08:00')
    expect(continueButton(wrapper).text()).toBe('Повторить сохранение')

    await continueButton(wrapper).trigger('click')
    await settle()
    expect(puts.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(router.currentRoute.value.name).toBe('onboarding-services')
    wrapper.unmount()
  })

  it('AC-15: сбой финального чтения повторяет только чтение, не подтверждённые PUT', async () => {
    const { wrapper, router } = await mountPage()
    await setDay(wrapper, 2, '08:00', '17:00')
    // Предварительное чтение проходит, финальное — нет.
    override('GET /api/v1/locations', () => null)
    override('GET /api/v1/locations', () => failure(500, 'INTERNAL'))
    override('GET /api/v1/locations', () => failure(500, 'INTERNAL'))
    await continueButton(wrapper).trigger('click')
    await settle()
    expect(puts).toHaveLength(1)
    expect(router.currentRoute.value.name).toBe('onboarding-location')
    expect(wrapper.text()).toContain('Не удалось проверить сохранение графиков')
    await continueButton(wrapper).trigger('click')
    await settle()
    expect(puts).toHaveLength(1)
    expect(router.currentRoute.value.name).toBe('onboarding-services')
    wrapper.unmount()
  })

  it('F-02 / AC-15: PUT подтвердил 11:00, финальный GET вернул 15:00 — остаёмся на шаге с сообщением и 11:00', async () => {
    const { wrapper, router } = await mountPage()
    await setDay(wrapper, 1, '11:00', '20:00')
    // Предварительное чтение — как есть; финальное — понедельник 15:00 у той же точки.
    override('GET /api/v1/locations', () => null)
    override('GET /api/v1/locations', () =>
      json({
        items: server.map((item) => ({
          ...item,
          businessHours: item.businessHours.map((hour) =>
            hour.weekday === 1 ? { ...hour, opensAt: '15:00:00' } : hour,
          ),
        })),
      }),
    )
    await continueButton(wrapper).trigger('click')
    await settle()
    expect(puts).toHaveLength(1)
    expect(puts[0]!.body.days[0]).toMatchObject({ weekday: 1, opensAt: '11:00' })
    expect(router.currentRoute.value.name).toBe('onboarding-location')
    expect(wrapper.text()).toContain('График на сервере отличается от сохранённого')
    expect(wrapper.text()).toContain('Студия на Тверской')
    expect((wrapper.get('input[name="opens-1"]').element as HTMLInputElement).value).toBe('11:00')
    expect(continueButton(wrapper).text()).toBe('Повторить сохранение')
    // Автоматической перезаписи нет: PUT — только по следующему нажатию пользователя.
    await settle()
    expect(puts).toHaveLength(1)
    wrapper.unmount()
  })

  it('AC-21: точка с пустой серверной неделей получает default и повтор только PUT', async () => {
    server = [point('loc-1', 'Студия', [])]
    const { wrapper } = await mountPage()
    expect((wrapper.get('input[name="opens-1"]').element as HTMLInputElement).value).toBe('10:00')
    expect((wrapper.get('input[name="closes-6"]').element as HTMLInputElement).value).toBe('19:00')
    expect(wrapper.find('input[name="opens-7"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('График точки ещё не сохранён')
    expect(continueButton(wrapper).attributes('disabled')).toBeDefined()
    expect(putsCount()).toBe(0)
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Сохранить график')!
      .trigger('click')
    await settle()
    expect(puts.map((item) => item.id)).toEqual(['loc-1'])
    expect(postsCount()).toBe(0)
    expect(continueButton(wrapper).attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('AC-06/20: карандаш → «Изменить точку»; переименование сохраняет черновик и ошибку той же точки', async () => {
    const { wrapper } = await mountPage()
    await setDay(wrapper, 1, '20:00', '09:00')
    await wrapper.get('[aria-label="Изменить точку «Студия на Тверской»"]').trigger('click')
    await settle()
    const dialog = document.body.querySelector('[role="dialog"]')!
    expect(dialog.textContent).toContain('Изменить точку')
    expect(dialog.textContent).toContain('Состояние точки')
    expect(dialog.textContent).toContain('настраивается справа на шаге «Точка и график»')
    const input = dialogInput('locationName')!
    input.value = 'Студия на Пресне'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    dialogButton('Сохранить точку')!.click()
    await settle()
    await settle()
    expect(calls).toContain('PATCH /api/v1/locations/loc-1')
    expect(wrapper.get('#hours-title').text()).toBe('График · Студия на Пресне')
    expect((wrapper.get('input[name="opens-1"]').element as HTMLInputElement).value).toBe('20:00')
    expect(card(wrapper, 'Пресне').text()).toContain('График заполнен неверно')
    expect(putsCount()).toBe(0)
    wrapper.unmount()
  })

  it('AC-17: во время сохранения «Сохраняем…», плюс, карандаш, выбор, ввод и «Назад» недоступны', async () => {
    let release: () => void = () => {}
    const { wrapper } = await mountPage()
    await setDay(wrapper, 2, '08:00', '17:00')
    override(
      'PUT /api/v1/locations/loc-1',
      () =>
        new Promise<null>((resolve) => {
          release = () => resolve(null)
        }),
    )
    await continueButton(wrapper).trigger('click')
    await continueButton(wrapper).trigger('click')
    await settle()
    expect(continueButton(wrapper).text()).toContain('Сохраняем…')
    expect(continueButton(wrapper).attributes('aria-busy')).toBe('true')
    expect(wrapper.get('[data-testid="add-location"]').attributes('disabled')).toBeDefined()
    expect(
      wrapper.get('[aria-label="Изменить точку «Студия на Тверской»"]').attributes('disabled'),
    ).toBeDefined()
    expect(card(wrapper, 'Тверской').attributes('disabled')).toBeDefined()
    expect(wrapper.get('input[name="opens-1"]').attributes('disabled')).toBeDefined()
    // Figma 10: приглушены карточки целиком (0.55 / 0.60), а не каждое поле.
    expect(wrapper.get('section[aria-labelledby="points-title"]').classes()).toContain(
      'md:opacity-55',
    )
    expect(wrapper.get('section[aria-labelledby="hours-title"]').classes()).toContain('opacity-60')
    expect(card(wrapper, 'Тверской').classes()).not.toContain('opacity-60')
    // N-R7-5: карандаш карточки не приглушается второй раз поверх карточки.
    expect(
      wrapper.get('[aria-label="Изменить точку «Студия на Тверской»"]').classes(),
    ).not.toContain('disabled:opacity-50')
    const back = wrapper.findAll('button').find((b) => b.text() === 'Назад')!
    expect(back.attributes('disabled')).toBeDefined()
    release()
    await settle()
    expect(putsCount()).toBe(1)
    wrapper.unmount()
  })

  it('прежняя проверка тела PUT: 00:00–23:59, выходной без времени, включённое Вс — семь рабочих дней', async () => {
    const { wrapper } = await mountPage()
    await setDay(wrapper, 1, '00:00', '23:59')
    await wrapper.get('input[name="day-7"]').setValue(true)
    await continueButton(wrapper).trigger('click')
    await settle()
    const days = puts[0]!.body.days
    expect(days[0]).toEqual({ weekday: 1, closed: false, opensAt: '00:00', closesAt: '23:59' })
    expect(days[6]).toEqual({ weekday: 7, closed: false, opensAt: '10:00', closesAt: '19:00' })
    expect(days.every((day) => !day.closed)).toBe(true)
    wrapper.unmount()
  })

  it('AC-19: «Назад» ведёт к шагу «Компания»', async () => {
    const { wrapper, router } = await mountPage()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Назад')!
      .trigger('click')
    await settle()
    expect(router.currentRoute.value.name).toBe('onboarding-company')
    wrapper.unmount()
  })
})
