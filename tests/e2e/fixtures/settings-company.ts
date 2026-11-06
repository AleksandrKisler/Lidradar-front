import { expect, type Page, type Route } from '@playwright/test'
import { mockOwner, TENANT_ID } from './api'

export const SETTINGS_NOW = '2026-10-25T11:30:00Z'
export const FIRST_LOCATION = '01990000-0000-7000-8000-000000000201'
export const SECOND_LOCATION = '01990000-0000-7000-8000-000000000202'
export const SETTINGS_SCENARIOS = [
  'main',
  'loading',
  'refreshing',
  'refresh-error',
  'empty',
  'saving-week',
  'invalid-time',
  'add-location',
  'edit-location',
  'unsaved-week',
  'confirm-company',
] as const
export type SettingsScenario = (typeof SETTINGS_SCENARIOS)[number]
type Endpoint = 'company' | 'locations' | 'location' | 'week'
type Day = { weekday: number; closed: boolean; opensAt?: string; closesAt?: string }

export function deferred() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

/** Every settings request stays in this local mock; held requests have explicit teardown. */
export async function settingsFixture(
  page: Page,
  options: {
    empty?: boolean
    longNames?: boolean
    role?: 'OWNER' | 'MANAGER'
    sessionName?: string
    traceId?: string
  } = {},
) {
  await page.clock.setFixedTime(new Date(SETTINGS_NOW))
  await mockOwner(page, { events: 'unavailable', role: options.role })
  const stamp = '2026-09-01T09:00:00Z'
  const company = {
    id: TENANT_ID,
    name: 'Студия «Блик»',
    defaultTimezone: 'Europe/Moscow',
    defaultCurrency: 'RUB',
    status: 'ACTIVE',
    createdAt: stamp,
    updatedAt: stamp,
  }
  const week: Day[] = Array.from({ length: 7 }, (_, i) =>
    i < 5
      ? { weekday: i + 1, closed: false, opensAt: '09:00', closesAt: '20:00' }
      : { weekday: i + 1, closed: true },
  )
  const locations = options.empty
    ? []
    : [FIRST_LOCATION, SECOND_LOCATION].map((id, i) => ({
        id,
        name: options.longNames
          ? `Студия комплексного обслуживания автомобилей «Очень длинное название ${i + 1}»`
          : i
            ? 'Студия на Арбате'
            : 'Студия на Тверской',
        timezone: 'Europe/Moscow',
        responseThresholdMinutes: 45,
        agreementThresholdMinutes: 120,
        active: true,
        businessHours: i ? ([] as Day[]) : structuredClone(week),
        createdAt: stamp,
        updatedAt: stamp,
      }))
  const calls: { endpoint: Endpoint; method: string; body: unknown; path: string }[] = []
  const failures = new Set<Endpoint>()
  const holds = new Map<Endpoint, ReturnType<typeof deferred>>()
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, json: body })
  let auth: { memberships: Record<string, unknown>[]; [key: string]: unknown } | undefined
  page.on('response', async (response) => {
    if (new URL(response.url()).pathname === '/api/v1/auth/me' && response.ok()) {
      auth = (await response.json().catch(() => undefined)) as typeof auth
    }
  })
  await page.route('**/api/v1/auth/me', async (route) => {
    if (!auth) return route.fallback()
    return json(route, {
      ...auth,
      memberships: auth.memberships.map((item) => ({
        ...item,
        organizationName: options.sessionName ?? company.name,
      })),
    })
  })
  await page.route(
    /\/api\/v1\/(organization|locations(?:\/[0-9a-f-]{36}(?:\/business-hours)?)?)$/,
    async (route) => {
      const path = new URL(route.request().url()).pathname
      const method = route.request().method()
      const endpoint: Endpoint = path.endsWith('organization')
        ? 'company'
        : path.endsWith('business-hours')
          ? 'week'
          : path.endsWith('locations')
            ? 'locations'
            : 'location'
      const body: unknown = method === 'GET' ? null : route.request().postDataJSON()
      calls.push({ endpoint, method, body, path })
      const hold = holds.get(endpoint)
      if (hold) await hold.promise
      if (failures.has(endpoint))
        return json(
          route,
          {
            error: {
              code:
                endpoint === 'locations' && method === 'POST'
                  ? 'VALIDATION_ERROR'
                  : 'INTERNAL_ERROR',
              message: '',
              traceId: options.traceId ?? 'settings-fixture',
            },
          },
          // A definite rejection is retryable; an unknown create outcome is covered separately.
          endpoint === 'locations' && method === 'POST' ? 400 : 500,
        )
      if (endpoint === 'company') {
        if (method === 'PATCH') Object.assign(company, body)
        return json(route, company)
      }
      if (endpoint === 'locations') {
        if (method === 'POST') {
          const created = {
            id: '01990000-0000-7000-8000-000000000203',
            name: '',
            timezone: 'Europe/Moscow',
            responseThresholdMinutes: 45,
            agreementThresholdMinutes: 120,
            active: true,
            businessHours: [] as Day[],
            createdAt: stamp,
            updatedAt: stamp,
            ...(body as object),
          }
          locations.push(created)
          return json(route, created, 201)
        }
        return json(route, { items: locations })
      }
      const target = locations.find((item) => path.includes(item.id))
      if (!target) return json(route, { error: { code: 'NOT_FOUND' } }, 404)
      if (endpoint === 'week' && method === 'PUT')
        target.businessHours = (body as { days: Day[] }).days
      else if (method === 'PATCH') Object.assign(target, body)
      return json(route, target)
    },
  )
  return {
    company,
    locations,
    calls,
    failures,
    hold(endpoint: Endpoint) {
      const gate = deferred()
      holds.set(endpoint, gate)
      return gate
    },
    release(endpoint: Endpoint) {
      holds.get(endpoint)?.release()
      holds.delete(endpoint)
    },
    dispose() {
      holds.forEach((gate) => gate.release())
      holds.clear()
    },
    writes(endpoint?: Endpoint) {
      return calls.filter(
        (call) => call.method !== 'GET' && (!endpoint || call.endpoint === endpoint),
      )
    },
  }
}
export type SettingsFixture = Awaited<ReturnType<typeof settingsFixture>>

export async function openSettings(page: Page) {
  await page.goto('/settings/company')
  await expect(page.locator('input[name=organizationName]')).toBeVisible()
  await expect(page.locator('[aria-label="Загрузка точек"]')).toHaveCount(0)
}

/** Move only Date beyond the query stale time, then emit the browser focus signal. */
export async function refreshSettings(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-25T11:36:00Z'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(
    page.getByText('Обновляем данные. Предыдущие значения остаются на экране.', { exact: true }),
  ).toBeVisible()
  // Expire only the query cache; all captured UI timestamps use the canonical clock.
  await page.clock.setFixedTime(new Date(SETTINGS_NOW))
}

export async function selectSettingsLocation(page: Page, id: string) {
  await page
    .getByRole('list', { name: 'Список точек' })
    .getByRole('button', {
      name: id === FIRST_LOCATION ? 'Студия на Тверской Активна' : 'Студия на Арбате Активна',
    })
    .click()
}

export async function prepareSettingsScenario(
  page: Page,
  scenario: SettingsScenario,
): Promise<SettingsFixture> {
  const fixture = await settingsFixture(page, { empty: scenario === 'empty' })
  if (scenario === 'loading') {
    fixture.hold('company')
    fixture.hold('locations')
  }
  // Visual fixtures mirror the approved desktop example. Functional fixtures keep two points.
  if (scenario !== 'unsaved-week') fixture.locations.splice(1)
  fixture.locations.forEach((location) => {
    location.businessHours = []
  })
  await page.addInitScript(() => {
    const fetchNetwork = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : null
      const url = new URL(request?.url ?? String(input), location.origin)
      if (url.pathname !== '/api/v1/events') return fetchNetwork(input, init)
      const signal = init?.signal ?? request?.signal
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(': connected\n\n'))
            signal?.addEventListener(
              'abort',
              () => {
                try {
                  controller.close()
                } catch {
                  /* closed */
                }
              },
              { once: true },
            )
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } },
      )
    }
  })
  await page.goto('/settings/company')
  if (scenario === 'loading') {
    await expect(page.getByRole('status', { name: 'Загрузка компании', exact: true })).toBeVisible()
    return fixture
  }
  await expect(page.locator('input[name=organizationName]')).toBeVisible()
  await expect(page.locator('[aria-label="Загрузка точек"]')).toHaveCount(0)
  if (scenario === 'refreshing' || scenario === 'refresh-error') {
    if (scenario === 'refreshing') {
      fixture.hold('company')
      fixture.hold('locations')
    } else {
      fixture.failures.add('company')
      fixture.failures.add('locations')
    }
    await refreshSettings(page)
    await expect(
      page.getByText(
        scenario === 'refreshing'
          ? 'Обновляем данные. Предыдущие значения остаются на экране.'
          : 'Параметры компании не обновлены',
        { exact: true },
      ),
    ).toBeVisible({ timeout: 20_000 })
  } else if (
    scenario === 'saving-week' ||
    scenario === 'invalid-time' ||
    scenario === 'unsaved-week'
  ) {
    if (scenario === 'invalid-time') await page.locator('input[name=closes-2]').fill('08:00')
    if (scenario === 'unsaved-week') await page.locator('input[name=opens-1]').fill('10:00')
    if (scenario === 'saving-week') {
      fixture.hold('week')
      await page.getByRole('button', { name: 'Сохранить график', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Сохраняем…', exact: true })).toBeVisible()
    }
    if (scenario === 'invalid-time') {
      await page.getByRole('button', { name: 'Сохранить график', exact: true }).click()
      await expect(page.locator('#day-error-2')).toBeVisible()
    }
    if (scenario === 'unsaved-week') {
      await selectSettingsLocation(page, SECOND_LOCATION)
      await expect(
        page.getByRole('dialog', { name: 'Сохранить изменения графика?', exact: true }),
      ).toBeVisible()
    }
  } else if (scenario === 'add-location') {
    await page.getByRole('button', { name: 'Добавить точку', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Добавить точку', exact: true })).toBeVisible()
  } else if (scenario === 'edit-location') {
    await page
      .getByRole('button', { name: 'Изменить точку', exact: true })
      .filter({ visible: true })
      .first()
      .click()
    await expect(page.getByRole('dialog', { name: 'Изменить точку', exact: true })).toBeVisible()
  } else if (scenario === 'confirm-company') {
    await page.locator('select[name=organizationTimezone]').selectOption('Europe/Kaliningrad')
    await page.getByRole('button', { name: 'Сохранить компанию', exact: true }).click()
    await expect(
      page.getByRole('dialog', { name: 'Изменить валюту и часовой пояс?', exact: true }),
    ).toBeVisible()
  }
  return fixture
}

/** Approved adaptive visual dataset; functional defaults above deliberately remain unchanged. */
export const VISUAL_LONG_LOCATION =
  'Студия профессионального детейлинга и комплексного ухода за автомобилями на Ленинградском проспекте — полировка кузова, защита керамикой, химчистка салона и восстановление лакокрасочного покрытия авто'

export async function settingsVisualFixture(page: Page) {
  const fixture = await settingsFixture(page, { sessionName: 'Студия «Блик»', traceId: '' })
  const first = fixture.locations[0]!
  first.businessHours = []
  fixture.locations[1]!.name = 'Арбат'
  for (const [index, name] of [
    'Студия в Хамовниках',
    'Студия в Сокольниках',
    VISUAL_LONG_LOCATION,
  ].entries()) {
    fixture.locations.push({
      ...structuredClone(first),
      id: `01990000-0000-7000-8000-00000000020${index + 4}`,
      name,
      active: index !== 1,
    })
  }
  await page.addInitScript(() => {
    const fetchNetwork = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : null
      const url = new URL(request?.url ?? String(input), location.origin)
      if (url.pathname !== '/api/v1/events') return fetchNetwork(input, init)
      const signal = init?.signal ?? request?.signal
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(': connected\n\n'))
            signal?.addEventListener(
              'abort',
              () => {
                try {
                  controller.close()
                } catch {
                  /* closed */
                }
              },
              { once: true },
            )
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } },
      )
    }
  })
  return fixture
}

/** Build the visual draft through real inputs, without changing runtime/API time defaults. */
export async function fillSettingsVisualWeek(page: Page) {
  for (let weekday = 1; weekday <= 6; weekday++) {
    await page.locator(`input[name=day-${weekday}]`).check()
    await page.locator(`input[name=opens-${weekday}]`).fill(weekday === 6 ? '10:00' : '09:00')
    await page.locator(`input[name=closes-${weekday}]`).fill(weekday === 6 ? '18:00' : '20:00')
  }
  await page.locator('input[name=day-7]').uncheck()
}
