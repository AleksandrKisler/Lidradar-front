/**
 * Съёмка шага 2 «Точки и графики» (US-M02-04): 12 состояний × desktop/tablet/phone по
 * `design-index.json → onboarding.step2`. Не часть CI-матрицы.
 *
 *   US_M02_04_REVISION=R1 npx playwright test -c tooling/visual/playwright.config.ts us-m02-04
 *
 * Кадры — `artifacts/frontend-v2/us-m02-04/<revision>/actual/<устройство>-<NN>-<ключ>.png`
 * и `<имя>.geometry.json` (карточки, плюс, карандаш, ритм шаги → заголовок → подзаголовок →
 * содержимое, горизонтальное переполнение), условия — `capture-conditions.json`.
 * Состояния 03/04 и ошибка инициализации снимаются по уточнению поведения 30.10.2026
 * (default 10:00–19:00), а не по устаревшим подписям «График не задан» в Figma.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, type Page, type Route } from '@playwright/test'
import { mockOwner } from '../../tests/e2e/fixtures/api'

const REVISION = process.env.US_M02_04_REVISION ?? 'local'
const ROOT = resolve(process.env.VISUAL_OUT ?? 'artifacts/frontend-v2', 'us-m02-04', REVISION)
const OUT = `${ROOT}/actual`
mkdirSync(OUT, { recursive: true })

const NOW = new Date('2026-10-30T09:00:00Z')
const devices = [
  ['desktop', 1440, 1000],
  ['tablet', 834, 1194],
  ['phone', 390, 844],
] as const

test.use({
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  reducedMotion: 'reduce',
  deviceScaleFactor: 1,
})
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW)
})

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

type Hour = { weekday: number; closed: boolean; opensAt?: string; closesAt?: string }
const week = (opensAt: string, closesAt: string, saturday?: [string, string]): Hour[] =>
  [1, 2, 3, 4, 5, 6, 7].map((weekday) =>
    weekday === 7
      ? { weekday, closed: true }
      : weekday === 6 && saturday
        ? { weekday, closed: false, opensAt: saturday[0], closesAt: saturday[1] }
        : { weekday, closed: false, opensAt, closesAt },
  )
const TVERSKAYA = '01990000-0000-7000-8000-000000000201'
const ARBAT = '01990000-0000-7000-8000-000000000202'
const point = (id: string, name: string, hours: Hour[]) => ({
  id,
  name,
  timezone: 'Europe/Moscow',
  responseThresholdMinutes: 45,
  agreementThresholdMinutes: 120,
  active: true,
  businessHours: hours,
  createdAt: '2026-10-30T09:00:00Z',
  updatedAt: '2026-10-30T09:00:00Z',
})
const tverskaya = () =>
  point(TVERSKAYA, 'Студия на Тверской', week('09:00', '20:00', ['10:00', '18:00']))
const arbat = () => point(ARBAT, 'Студия на Арбате', week('10:00', '19:00'))

/**
 * Владелец на шаге 2 с заданным списком точек. POST создаёт точку с пустой неделей,
 * PUT сохраняет присланную неделю; `put` подменяет ответ PUT (ошибка, ожидание).
 */
async function mockStep(
  page: Page,
  initial: ReturnType<typeof point>[],
  options: { put?: (route: Route) => Promise<void> | void; list?: (route: Route) => void } = {},
): Promise<void> {
  await mockOwner(page)
  const locations = initial
  let created = 0
  await page.route('**/api/v1/organization/onboarding', (route) =>
    json(route, {
      complete: false,
      nextStep: 'LOCATION',
      steps: [
        { key: 'ORGANIZATION', required: true, done: true },
        { key: 'LOCATION', required: true, done: false },
        { key: 'SERVICES', required: true, done: false },
        { key: 'CHANNEL', required: true, done: false },
        { key: 'TELEGRAM_LINK', required: false, done: false },
      ],
      facts: {
        activeLocations: locations.length,
        locationsWithSchedule: 0,
        activeServices: 0,
        connections: 0,
        liveConnections: 0,
        telegramLinked: false,
      },
      computedAt: NOW.toISOString(),
    }),
  )
  await page.route('**/api/v1/locations', (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { name: string; timezone: string }
      created += 1
      const next = point(created === 1 && !locations.length ? TVERSKAYA : ARBAT, body.name, [])
      next.timezone = body.timezone
      locations.push(next)
      return json(route, next, 201)
    }
    if (options.list) return options.list(route)
    return json(route, { items: locations })
  })
  await page.route(/\/api\/v1\/locations\/[0-9a-f-]{36}(\/business-hours)?$/, async (route) => {
    const id = /locations\/([0-9a-f-]{36})/.exec(route.request().url())![1]
    const target = locations.find((item) => item.id === id)!
    if (route.request().method() === 'PUT') {
      if (options.put) return options.put(route)
      target.businessHours = (route.request().postDataJSON() as { days: Hour[] }).days
    }
    return json(route, target)
  })
}

async function createPoint(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Добавить точку' }).click()
  const dialog = page.getByRole('dialog', { name: 'Добавить точку' })
  await dialog.getByLabel('Название точки').fill(name)
  await dialog.getByRole('button', { name: 'Добавить точку' }).click()
  await dialog.waitFor({ state: 'hidden' })
  await page.locator('#hours-title').filter({ hasText: name }).waitFor()
  await page.getByTestId('location-continue').and(page.locator(':not([aria-busy])')).waitFor()
}

async function selectPoint(page: Page, name: string, phone: boolean): Promise<void> {
  if (phone) {
    const option = page.locator('select[name="location"] option', { hasText: name })
    await page
      .locator('select[name="location"]')
      .selectOption((await option.getAttribute('value'))!)
  } else await page.getByTestId('location-card').filter({ hasText: name }).click()
  await page.locator('#hours-title').filter({ hasText: name }).waitFor()
}

type State = (page: Page, phone: boolean) => Promise<void>
const states: Record<string, State> = {
  '01-empty': async (page) => {
    await mockStep(page, [])
    await page.goto('/onboarding/location')
    await page.getByText('Сначала добавьте точку', { exact: true }).waitFor()
  },
  '02-create_location': async (page) => {
    await mockStep(page, [])
    await page.goto('/onboarding/location')
    await page.getByText('Сначала добавьте точку', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Добавить точку' }).click()
    await page.getByRole('dialog', { name: 'Добавить точку' }).waitFor()
  },
  '03-schedule_unset': async (page) => {
    await mockStep(page, [])
    await page.goto('/onboarding/location')
    await page.getByText('Сначала добавьте точку', { exact: true }).waitFor()
    await createPoint(page, 'Студия на Тверской')
  },
  '04-other_schedule_unset': async (page) => {
    await mockStep(page, [tverskaya()])
    await page.goto('/onboarding/location')
    await page.locator('#hours-title').waitFor()
    await createPoint(page, 'Студия на Арбате')
  },
  '05-all_schedules_valid': async (page, phone) => {
    await mockStep(page, [tverskaya(), arbat()])
    await page.goto('/onboarding/location')
    await page.locator('#hours-title').waitFor()
    await selectPoint(page, 'Студия на Арбате', phone)
  },
  '06-edit_location': async (page) => {
    await mockStep(page, [tverskaya(), arbat()])
    await page.goto('/onboarding/location')
    await page.locator('#hours-title').waitFor()
    await page
      .getByRole('button', { name: 'Изменить точку «Студия на Тверской»' })
      .locator('visible=true')
      .click()
    await page.getByRole('dialog', { name: 'Изменить точку' }).waitFor()
  },
  '07-create_location_error': async (page) => {
    await mockStep(page, [])
    await page.goto('/onboarding/location')
    await page.getByText('Сначала добавьте точку', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Добавить точку' }).click()
    const dialog = page.getByRole('dialog', { name: 'Добавить точку' })
    await dialog.getByRole('button', { name: 'Добавить точку' }).click()
    await dialog.getByText('Введите название точки.').waitFor()
  },
  '08-invalid_schedule': async (page) => {
    await mockStep(page, [tverskaya(), arbat()])
    await page.goto('/onboarding/location')
    await page.locator('#hours-title').waitFor()
    await page.locator('input[name="opens-1"]').fill('20:00')
    await page.locator('input[name="closes-1"]').fill('09:00')
    await page.getByText('Время окончания должно быть позже времени начала.').waitFor()
  },
  '09-save_error': async (page) => {
    // Сервер хранит Сб 10:00–17:00; правка до 18:00 делает неделю изменённой, PUT отклоняется.
    await mockStep(
      page,
      [point(TVERSKAYA, 'Студия на Тверской', week('09:00', '20:00', ['10:00', '17:00'])), arbat()],
      {
        put: (route) =>
          json(
            route,
            { error: { code: 'VALIDATION_ERROR', message: 'x', traceId: 'trace-us-m02-04' } },
            400,
          ),
      },
    )
    await page.goto('/onboarding/location')
    await page.locator('#hours-title').waitFor()
    await page.locator('input[name="closes-6"]').fill('18:00')
    await page.getByTestId('location-continue').click()
    await page.getByText('Не удалось сохранить графики').waitFor()
  },
  '10-saving': async (page) => {
    await mockStep(
      page,
      [point(TVERSKAYA, 'Студия на Тверской', week('09:00', '20:00', ['10:00', '17:00'])), arbat()],
      { put: () => new Promise(() => {}) },
    )
    await page.goto('/onboarding/location')
    await page.locator('#hours-title').waitFor()
    await page.locator('input[name="closes-6"]').fill('18:00')
    await page.getByTestId('location-continue').click()
    await page.locator('[data-testid="location-continue"][aria-busy="true"]').waitFor()
  },
  '11-other_location_error': async (page, phone) => {
    await mockStep(page, [tverskaya(), arbat()])
    await page.goto('/onboarding/location')
    await page.locator('#hours-title').waitFor()
    await page.locator('input[name="opens-1"]').fill('20:00')
    await page.locator('input[name="closes-1"]').fill('09:00')
    await selectPoint(page, 'Студия на Арбате', phone)
  },
  '12-loading': async (page) => {
    await mockStep(page, [], { list: () => undefined })
    await page.goto('/onboarding/location')
    await page.getByText('Загружаем точки и графики…').first().waitFor()
  },
}

/** Шрифты загружены, фокуса и наведения нет, конечные переходы закончились. */
async function settle(page: Page): Promise<void> {
  await page.mouse.move(0, 0)
  // Кадр — первое окно: клик «Сохранить и продолжить» прокручивает телефон к нижней панели.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  )
  await page.evaluate(
    () => document.activeElement instanceof HTMLElement && document.activeElement.blur(),
  )
}

/** Геометрия AC-M02-04-22: карточки, плюс, карандаш, ритм и переполнение. */
async function geometry(page: Page) {
  return page.evaluate(() => {
    const box = (element: Element | null) => {
      if (!element) return null
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return null
      return { x: rect.x, y: rect.y + window.scrollY, width: rect.width, height: rect.height }
    }
    const typography = (element: Element | null) => {
      if (!element) return null
      const style = getComputedStyle(element)
      return {
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        fontWeight: style.fontWeight,
      }
    }
    const nav = document.querySelector('nav[aria-label="Шаги начала работы"]')
    const title = document.querySelector('h1')
    const description = title?.nextElementSibling ?? null
    const workspace = document.querySelector('section[aria-labelledby="points-title"]')
    const navBox = box(nav)
    const titleBox = box(title)
    const descriptionBox = box(description)
    const workspaceBox = box(workspace)
    const cards = [...document.querySelectorAll('[data-testid="location-card"]')].map((card) => ({
      box: box(card),
      name: typography(card.firstElementChild),
      status: typography(card.lastElementChild),
      statusLines:
        card.lastElementChild &&
        Math.round(card.lastElementChild.getBoundingClientRect().height / 20),
    }))
    const pencils = [...document.querySelectorAll('button[aria-label^="Изменить точку"]')]
      .map((button) => box(button))
      .filter(Boolean)
    const plus = document.querySelector('[data-testid="add-location"]') as HTMLButtonElement | null
    const plusStyle = plus ? getComputedStyle(plus) : null
    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      rhythm:
        navBox && titleBox && descriptionBox && workspaceBox
          ? {
              stepsToTitle: titleBox.y - (navBox.y + navBox.height),
              titleToSubtitle: descriptionBox.y - (titleBox.y + titleBox.height),
              subtitleToContent: workspaceBox.y - (descriptionBox.y + descriptionBox.height),
            }
          : null,
      cards,
      pencils,
      plus: plus
        ? {
            box: box(plus),
            disabled: plus.disabled,
            background: plusStyle?.backgroundColor,
            color: plusStyle?.color,
          }
        : null,
      continue: (() => {
        const button = document.querySelector(
          '[data-testid="location-continue"]',
        ) as HTMLButtonElement | null
        return button
          ? { box: box(button), disabled: button.disabled, text: button.innerText }
          : null
      })(),
      hint: document.querySelector<HTMLElement>('#location-step-hint')?.innerText.trim() ?? null,
      // Баннер над неделей («Сначала добавьте точку», ошибки сохранения): Figma 72 px.
      notice: box(
        document.querySelector(
          'section[aria-labelledby="hours-title"] :is([role="status"], [role="alert"])',
        ),
      ),
      // Окно точки: положение, пояснение и зазор до первого поля, кнопка отправки (фокус кадр снимает).
      dialog: (() => {
        const dialog = document.querySelector('[role="dialog"]')
        if (!dialog) return null
        const describedBy = dialog.getAttribute('aria-describedby')
        const description = describedBy ? document.getElementById(describedBy) : null
        const firstLabel = dialog.querySelector('form label')
        const submit = dialog.querySelector('button[type="submit"]')
        const descriptionBox = box(description)
        const labelBox = box(firstLabel)
        return {
          box: box(dialog),
          description: description
            ? {
                box: descriptionBox,
                ...typography(description),
                color: getComputedStyle(description).color,
              }
            : null,
          descriptionToFirstLabel:
            descriptionBox && labelBox
              ? labelBox.y - (descriptionBox.y + descriptionBox.height)
              : null,
          submit: submit
            ? {
                disabled: (submit as HTMLButtonElement).disabled,
                background: getComputedStyle(submit).backgroundColor,
              }
            : null,
        }
      })(),
    }
  })
}

const conditions = {
  revision: REVISION,
  capturedAt: new Date().toISOString(),
  clock: NOW.toISOString(),
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
  browser: 'chromium (playwright)',
  viewports: Object.fromEntries(devices.map(([name, width, height]) => [name, { width, height }])),
  fixtures: 'synthetic: Студия на Тверской / Студия на Арбате; mockOwner',
  referenceKind: {
    '03-schedule_unset': 'approved-pattern + behaviorClarification 2026-10-30',
    '04-other_schedule_unset': 'approved-pattern + behaviorClarification 2026-10-30',
  },
}
writeFileSync(`${ROOT}/capture-conditions.json`, JSON.stringify(conditions, null, 2))

test('US-M02-04 phone-05-all_schedules_valid-scroll-end', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await states['05-all_schedules_valid']!(page, true)
  await settle(page)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const file = `${OUT}/phone-05-all_schedules_valid-scroll-end`
  writeFileSync(
    `${file}.geometry.json`,
    JSON.stringify(
      await page.evaluate(() => {
        const panel = document.querySelector('#location-step-hint')!.parentElement!
        const rect = panel.getBoundingClientRect()
        return { panelBottom: rect.bottom, viewport: window.innerHeight }
      }),
      null,
      2,
    ),
  )
  await page.screenshot({ path: `${file}.png` })
})

for (const [device, width, height] of devices) {
  for (const [key, prepare] of Object.entries(states)) {
    test(`US-M02-04 ${device}-${key}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await prepare(page, device === 'phone')
      await settle(page)
      const file = `${OUT}/${device}-${key}`
      writeFileSync(`${file}.geometry.json`, JSON.stringify(await geometry(page), null, 2))
      await page.screenshot({ path: `${file}.png`, fullPage: device !== 'phone' })
    })
  }
}

/**
 * Дополнительные кадры R8 (вне сравнения 12 состояний): ошибка инициализации недели после POST,
 * видимый фокус окна точки (начальный на названии и с клавиатуры на кнопке панели) и общие шаги
 * 1/3/4 после правок ряда шагов и шапки. Кадры — `<revision>/extra/`.
 */
const EXTRA = `${ROOT}/extra`
mkdirSync(EXTRA, { recursive: true })

/** Как `settle`, но фокус остаётся: кадры проверяют видимое кольцо фокуса. */
async function settleKeepingFocus(page: Page): Promise<void> {
  await page.mouse.move(0, 0)
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  )
}

const STEP_KEYS = ['ORGANIZATION', 'LOCATION', 'SERVICES', 'CHANNEL'] as const
async function mockOnboardingAt(page: Page, next: (typeof STEP_KEYS)[number]): Promise<void> {
  await mockOwner(page)
  const index = STEP_KEYS.indexOf(next)
  await page.route('**/api/v1/organization/onboarding', (route) =>
    json(route, {
      complete: false,
      nextStep: next,
      steps: [
        ...STEP_KEYS.map((key, position) => ({ key, required: true, done: position < index })),
        { key: 'TELEGRAM_LINK', required: false, done: false },
      ],
      facts: {
        activeLocations: index > 1 ? 1 : 0,
        locationsWithSchedule: index > 1 ? 1 : 0,
        activeServices: index > 2 ? 1 : 0,
        connections: 0,
        liveConnections: 0,
        telegramLinked: false,
      },
      computedAt: NOW.toISOString(),
    }),
  )
}

const extras: Record<string, { prepare: State; keepFocus?: boolean }> = {
  init_error: {
    prepare: async (page) => {
      await mockStep(page, [], {
        put: (route) =>
          json(
            route,
            { error: { code: 'INTERNAL', message: 'x', traceId: 'trace-us-m02-04-init' } },
            500,
          ),
      })
      await page.goto('/onboarding/location')
      await page.getByText('Сначала добавьте точку', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Добавить точку' }).click()
      const dialog = page.getByRole('dialog', { name: 'Добавить точку' })
      await dialog.getByLabel('Название точки').fill('Студия на Тверской')
      await dialog.getByRole('button', { name: 'Добавить точку' }).click()
      await dialog.waitFor({ state: 'hidden' })
      await page.getByText('Не удалось сохранить график точки').waitFor()
    },
  },
  dialog_focus_initial: {
    keepFocus: true,
    prepare: async (page) => {
      await mockStep(page, [])
      await page.goto('/onboarding/location')
      await page.getByText('Сначала добавьте точку', { exact: true }).waitFor()
      await page.getByTestId('add-location').focus()
      await page.keyboard.press('Enter')
      await page.getByRole('dialog', { name: 'Добавить точку' }).waitFor()
      await page.locator('[role="dialog"] input[name="locationName"]:focus').waitFor()
    },
  },
  dialog_focus_keyboard: {
    keepFocus: true,
    prepare: async (page) => {
      await mockStep(page, [])
      await page.goto('/onboarding/location')
      await page.getByText('Сначала добавьте точку', { exact: true }).waitFor()
      await page.getByTestId('add-location').focus()
      await page.keyboard.press('Enter')
      const dialog = page.getByRole('dialog', { name: 'Добавить точку' })
      await dialog.waitFor()
      // Shift+Tab с названия: «Закрыть», затем по кругу — последняя кнопка панели «Добавить точку».
      await page.locator('[role="dialog"] input[name="locationName"]:focus').waitFor()
      const submit = dialog.locator('button[type="submit"]')
      for (let index = 0; index < 4; index += 1) {
        if (await submit.evaluate((element) => element === document.activeElement)) break
        await page.keyboard.press('Shift+Tab')
      }
      await dialog.locator('button[type="submit"]:focus').waitFor()
    },
  },
  step1_company: {
    prepare: async (page) => {
      await mockOnboardingAt(page, 'LOCATION')
      await page.goto('/onboarding/company')
      await page.locator('h1').waitFor()
    },
  },
  step3_services: {
    prepare: async (page) => {
      await mockOnboardingAt(page, 'SERVICES')
      await page.goto('/onboarding/services')
      await page.locator('h1').waitFor()
    },
  },
  step4_channel: {
    prepare: async (page) => {
      await mockOnboardingAt(page, 'CHANNEL')
      await page.goto('/onboarding/channel')
      await page.locator('h1').waitFor()
    },
  },
}

for (const [device, width, height] of devices) {
  for (const [key, { prepare, keepFocus }] of Object.entries(extras)) {
    test(`US-M02-04 extra ${device}-${key}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await prepare(page, device === 'phone')
      if (keepFocus) await settleKeepingFocus(page)
      else await settle(page)
      const file = `${EXTRA}/${device}-${key}`
      writeFileSync(
        `${file}.json`,
        JSON.stringify(
          await page.evaluate(() => ({
            url: location.pathname,
            h1: document.querySelector('h1')?.textContent?.trim() ?? null,
            focused: (() => {
              const element = document.activeElement as HTMLElement | null
              if (!element || element === document.body) return null
              const style = getComputedStyle(element)
              return {
                tag: element.tagName.toLowerCase(),
                name: element.getAttribute('name') ?? element.textContent?.trim() ?? null,
                focusVisible: element.matches(':focus-visible'),
                outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
                boxShadow: style.boxShadow,
              }
            })(),
            overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          })),
          null,
          2,
        ),
      )
      await page.screenshot({ path: `${file}.png`, fullPage: device !== 'phone' })
    })
  }
}
