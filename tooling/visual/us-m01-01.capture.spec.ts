/**
 * Кадры US-M01-01 (A/B2/B3/C, нейтральный отказ US-M01-02, нижняя строка AuthLayout) для сверки
 * с эталонами Figma `artifacts/frontend-v2/us-m01-01/reference/` (source-map:
 * `docs/frontend-v2/evidence/US-M01-01/source-map.md`). Не часть CI-матрицы.
 *
 * Запуск только этого пакета:
 *   US_M01_01_REVISION=R2-codex npx playwright test -c tooling/visual/playwright.config.ts us-m01-01
 *   US_M01_01_REVISION=R2-codex node tooling/visual/us-m01-01-compare.mjs
 * Кадры — `artifacts/frontend-v2/us-m01-01/<revision>/actual/<имя>.png` и `<имя>.geometry.json`,
 * условия съёмки — `capture-conditions.json` там же.
 *
 * Условия: Chromium, DPR 1, ru-RU, Europe/Moscow, reduced-motion, фиксированное «сейчас», шрифты
 * загружены, анимации остановлены (индикатор статичен), фокуса и наведения нет; кадр снимается
 * только после появления конкретного состояния — без произвольных пауз. Данные синтетические:
 * демонстрационные имена/адреса из макетов (`example.com`/`example.test`), коды — 43 символа.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, type Locator, type Page, type Route } from '@playwright/test'

const REVISION = process.env.US_M01_01_REVISION ?? 'local'
const ROOT = resolve(process.env.VISUAL_OUT ?? 'artifacts/frontend-v2', 'us-m01-01', REVISION)
const OUT = `${ROOT}/actual`
mkdirSync(OUT, { recursive: true })

/** «Сейчас» съёмки: 29.10.2026 13:00 МСК. */
const NOW = new Date('2026-10-29T10:00:00Z')
/** Демонстрационный код макетов (Figma 811:7463, 811:7613): 43 символа base64url. */
const CODE = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0UvW'
const PASSWORD = 'synthetic-12'
const CONTEXT_KEY = 'lidradar.registration.invitation'

const DEVICES = {
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 834, height: 1194 },
  mobile: { width: 390, height: 844 },
  // Регрессия узкого телефона: отдельного кадра Figma нет.
  '375': { width: 375, height: 812 },
} as const
type Device = keyof typeof DEVICES

test.use({
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  reducedMotion: 'reduce',
  deviceScaleFactor: 1,
  browserName: 'chromium',
})

test.beforeAll(async ({ browser }) => {
  writeFileSync(
    `${ROOT}/capture-conditions.json`,
    JSON.stringify(
      {
        revision: REVISION,
        browser: 'chromium (Playwright)',
        browserVersion: browser.version(),
        deviceScaleFactor: 1,
        locale: 'ru-RU',
        timezoneId: 'Europe/Moscow',
        reducedMotion: 'reduce',
        now: NOW.toISOString(),
        fonts: 'document.fonts.ready перед каждым кадром',
        animations: "screenshot({ animations: 'disabled' })",
        devices: DEVICES,
        fixtures: {
          code: 'синтетический 43-символьный код макета',
          password: 'синтетический, в кадре скрыт',
          emails: ['maria.example.com', 'maria.owner@example.com', 'owner@example.test'],
        },
      },
      null,
      2,
    ),
  )
})

const json = (route: Route, status: number, body: unknown, headers: Record<string, string> = {}) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    headers,
    body: JSON.stringify(body),
  })
const failure = (code: string) => ({ error: { code, message: '', traceId: 'visual' } })
const never = () => new Promise<void>(() => {})

interface Api {
  mode?: 'open' | 'invite_only' | 'pending'
  check?: (route: Route) => Promise<void>
  register?: (route: Route) => Promise<void>
  me?: 'guest' | 'pending'
}

async function mock(page: Page, api: Api = {}): Promise<void> {
  await page.route('**/api/v1/auth/me', async (route) => {
    if (api.me === 'pending') await never()
    await json(route, 401, failure('UNAUTHENTICATED'))
  })
  await page.route('**/api/v1/auth/registration', async (route) => {
    if (api.mode === 'pending') await never()
    await json(route, 200, { mode: api.mode ?? 'open' })
  })
  await page.route('**/api/v1/auth/registration/invitation/check', (route) =>
    api.check ? api.check(route) : route.fulfill({ status: 204 }),
  )
  await page.route('**/api/v1/auth/register', (route) =>
    api.register ? api.register(route) : never(),
  )
  await page.route('**/api/v1/auth/email/verify', (route) =>
    json(route, 400, failure('VERIFICATION_TOKEN_INVALID')),
  )
}

async function fillAccount(
  page: Page,
  values: { name: string; email: string; password?: string },
): Promise<void> {
  await page.getByLabel('Имя').fill(values.name)
  await page.getByLabel('Электронная почта').fill(values.email)
  await page.getByLabel('Пароль', { exact: true }).fill(values.password ?? PASSWORD)
}

async function toDetails(page: Page): Promise<void> {
  await page.goto('/register?flow=invite')
  await page.getByLabel('Код приглашения').fill(CODE)
  await page.getByText('Приглашение проверено. Заполните данные для создания аккаунта.').waitFor()
}

const visible = async (locator: Locator) => locator.waitFor({ state: 'visible' })

/** Ждём именно видимую подсказку, связанную с полем, а не её копию в live region. */
async function codeMessage(page: Page, text: string): Promise<void> {
  const field = page.getByLabel('Код приглашения', { exact: true })
  await visible(field)
  const messageId = await field.getAttribute('aria-describedby')
  if (!messageId) throw new Error('Поле кода не связано с видимой подсказкой')
  await visible(page.locator(`[id=${JSON.stringify(messageId)}]`).getByText(text, { exact: true }))
}

/** Состояние → подготовка и ожидание конкретного признака готового кадра. */
const STATES: Record<string, (page: Page) => Promise<void>> = {
  login: async (page) => {
    await mock(page)
    await page.goto('/login')
    await page.getByLabel('Электронная почта').fill('owner@example.test')
    await visible(page.getByRole('link', { name: 'У меня есть приглашение' }))
  },
  'b2-default': async (page) => {
    await mock(page)
    await page.goto('/register?flow=invite')
    await codeMessage(page, 'Код проверится автоматически после ввода.')
  },
  'b2-empty': async (page) => {
    await mock(page)
    await page.goto('/register?flow=invite')
    await page.getByLabel('Код приглашения').press('Enter')
    await codeMessage(page, 'Для регистрации нужен код приглашения')
  },
  'b2-format': async (page) => {
    await mock(page)
    await page.goto('/register?flow=invite')
    await page.getByLabel('Код приглашения').fill('LDR-2026')
    await page.getByRole('button', { name: 'Проверить код' }).click()
    await codeMessage(page, 'Код состоит из 43 символов: латиница, цифры, «-» и «_»')
  },
  'b2-check': async (page) => {
    await mock(page, { check: never })
    await page.goto('/register?flow=invite')
    await page.getByLabel('Код приглашения').fill(CODE)
    await codeMessage(page, 'Проверяем код приглашения…')
  },
  'b2-skeleton': async (page) => {
    await mock(page, { me: 'pending' })
    await page.goto('/register?flow=invite')
    await visible(page.getByText('Загружаем форму…'))
  },
  'b2-403': async (page) => {
    await mock(page, { check: (route) => json(route, 403, failure('INVITATION_INVALID')) })
    await page.goto('/register?flow=invite')
    await page.getByLabel('Код приглашения').fill(CODE)
    await codeMessage(page, 'Код приглашения не подошёл')
  },
  'b2-service': async (page) => {
    await mock(page, { check: (route) => json(route, 500, failure('INTERNAL_ERROR')) })
    await page.goto('/register?flow=invite')
    await page.getByLabel('Код приглашения').fill(CODE)
    await codeMessage(page, 'Не удалось проверить код. Попробуйте ещё раз.')
  },
  'b2-429': async (page) => {
    await mock(page, {
      check: (route) => json(route, 429, failure('RATE_LIMITED'), { 'Retry-After': '30' }),
    })
    await page.goto('/register?flow=invite')
    await page.getByLabel('Код приглашения').fill(CODE)
    await codeMessage(page, 'Слишком много проверок. Повторите через 30 с.')
  },
  'b3-default': async (page) => {
    await mock(page)
    await toDetails(page)
  },
  'b3-email-error': async (page) => {
    await mock(page)
    await toDetails(page)
    await fillAccount(page, { name: 'Мария', email: 'maria.example.com' })
    await page.getByRole('button', { name: 'Создать аккаунт' }).click()
    await visible(page.getByText('Введите корректный адрес электронной почты.'))
  },
  'b3-submitting': async (page) => {
    await mock(page)
    await toDetails(page)
    await fillAccount(page, { name: 'Мария', email: 'owner@example.test' })
    await page.getByRole('button', { name: 'Создать аккаунт' }).click()
    await visible(page.locator('button[aria-busy="true"]'))
  },
  'b3-skeleton': async (page) => {
    await mock(page, { check: never })
    await page.addInitScript(
      ([key, value]) => sessionStorage.setItem(key!, value!),
      [CONTEXT_KEY, JSON.stringify({ v: 1, code: CODE, checkedAt: NOW.getTime() - 60_000 })],
    )
    await page.goto('/register?flow=invite')
    await visible(page.getByText('Загружаем форму регистрации…'))
  },
  'b3-generic-error': async (page) => {
    await mock(page, { register: (route) => json(route, 400, failure('REGISTRATION_FAILED')) })
    await toDetails(page)
    await fillAccount(page, { name: 'Мария Владелец', email: 'maria.owner@example.com' })
    await page.getByRole('button', { name: 'Создать аккаунт' }).click()
    await visible(
      page
        .getByTestId('register-feedback')
        .getByText('Не удалось создать аккаунт', { exact: true }),
    )
  },
  'a-default': async (page) => {
    await mock(page, { mode: 'open' })
    await page.goto('/register')
    await visible(page.getByLabel('Имя'))
  },
  'a-email-error': async (page) => {
    await mock(page, { mode: 'open' })
    await page.goto('/register')
    await fillAccount(page, { name: 'Мария', email: 'maria.example.com' })
    await page.getByRole('button', { name: 'Создать аккаунт' }).click()
    await visible(page.getByText('Введите корректный адрес электронной почты.'))
  },
  'a-submitting': async (page) => {
    await mock(page, { mode: 'open' })
    await page.goto('/register')
    await fillAccount(page, { name: 'Мария', email: 'owner@example.test' })
    await page.getByRole('button', { name: 'Создать аккаунт' }).click()
    await visible(page.locator('button[aria-busy="true"]'))
  },
  'a-skeleton': async (page) => {
    // После загрузки сессии ждём режим текущего входа.
    await mock(page, { mode: 'pending' })
    await page.goto('/register')
    await visible(page.getByText('Загружаем форму регистрации…'))
  },
  'a-generic-error': async (page) => {
    await mock(page, {
      mode: 'open',
      register: (route) => json(route, 400, failure('REGISTRATION_FAILED')),
    })
    await page.goto('/register')
    await fillAccount(page, { name: 'Мария Владелец', email: 'maria.owner@example.com' })
    await page.getByRole('button', { name: 'Создать аккаунт' }).click()
    await visible(
      page
        .getByTestId('register-feedback')
        .getByText('Не удалось создать аккаунт', { exact: true }),
    )
  },
  'c-default': async (page) => {
    await mock(page, { mode: 'invite_only' })
    await page.goto('/register')
    await visible(page.getByText('Регистрация закрыта'))
  },
  'c-skeleton': async (page) => {
    // Каркас до загрузки сессии: режим ещё не известен, A и C выглядят одинаково.
    await mock(page, { me: 'pending' })
    await page.goto('/register')
    await visible(page.getByText('Загружаем форму регистрации…'))
  },
  'footer-forgot': async (page) => {
    await mock(page)
    await page.goto('/forgot-password')
    await page.getByLabel('Электронная почта').fill('owner@example.test')
  },
  'footer-reset': async (page) => {
    await mock(page)
    await page.goto(`/reset-password#token=${'T'.repeat(43)}`)
    await visible(page.getByLabel('Новый пароль'))
  },
  'footer-reset-invalid': async (page) => {
    await mock(page)
    await page.goto('/reset-password')
    await visible(page.getByText('Ссылка недействительна'))
  },
  'footer-verify': async (page) => {
    await mock(page)
    await page.goto(`/verify-email#token=${'T'.repeat(43)}`)
    await visible(page.getByText('Ссылка недействительна'))
  },
}

/** Какие состояния снимаются на каком устройстве (по матрице ТЗ §5 и эталонам source-map). */
const MATRIX: Record<Device, string[]> = {
  desktop: Object.keys(STATES),
  tablet: Object.keys(STATES).filter((state) => !/^footer-(reset|verify)/.test(state)),
  mobile: Object.keys(STATES).filter((state) => !/^footer-(reset|verify)/.test(state)),
  '375': Object.keys(STATES).filter((state) => !state.startsWith('footer-')),
}

/** Шрифты загружены, фокуса и наведения нет, документ прокручен к началу. */
async function settle(page: Page): Promise<void> {
  await page.mouse.move(0, 0)
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(
    () => document.activeElement instanceof HTMLElement && document.activeElement.blur(),
  )
  await page.evaluate(() => window.scrollTo(0, 0))
  // Завершённая отрисовка после реактивного feedback/фокуса, без произвольного sleep.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

/** Замеры геометрии, проверяемые `us-m01-01-compare.mjs` (поле 46, 44/36/20, footer 64/24…). */
async function measure(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const rect = (element: Element | null) => {
      if (!element) return null
      const box = element.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    }
    const borders = (element: Element) => {
      const style = getComputedStyle(element)
      return [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ]
    }
    const root = document.documentElement
    const main = document.querySelector('main')
    const code = document.querySelector('input[name="invite-code"]')
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      fonts: { status: document.fonts.status, family: getComputedStyle(document.body).fontFamily },
      document: {
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
        scrollHeight: root.scrollHeight,
      },
      horizontalOverflow: root.scrollWidth > root.clientWidth,
      card: rect(main?.querySelector('.rounded-card') ?? null),
      cardPresentation: (() => {
        const parent = main?.querySelector('.rounded-card')?.parentElement
        return parent
          ? { classes: parent.className, translate: getComputedStyle(parent).translate }
          : null
      })(),
      warning: rect(
        [...(main?.querySelectorAll('[role="alert"]') ?? [])].find((alert) =>
          alert.textContent?.includes('Регистрация закрыта'),
        ) ?? null,
      ),
      fields: [...(main?.querySelectorAll('input') ?? [])].map((input) => ({
        name: input.getAttribute('name'),
        ...rect(input)!,
        borders: borders(input),
        placeholderColor: getComputedStyle(input, '::placeholder').color,
      })),
      skeletonFields: [...(main?.querySelectorAll('.h-input') ?? [])].map((block) => rect(block)!),
      accountPlaceholderRadii: [
        ...(main?.querySelectorAll('form[aria-label="Загрузка"] > div > .h-input') ?? []),
      ].map((block) => parseFloat(getComputedStyle(block).borderRadius)),
      code: code
        ? {
            field: rect(code),
            wrapper: rect(code.parentElement),
            borders: borders(code),
            action: rect(document.querySelector('[data-testid="invitation-check"]')),
            face: rect(document.querySelector('[data-testid="invitation-check-face"]')),
            icon: rect(document.querySelector('[data-testid="invitation-check-icon"]')),
            // Размер самого индикатора — по вычисленному стилю: вращение не влияет на значение.
            spinner: (() => {
              const spinner = document.querySelector('[data-testid="invitation-check-spinner"]')
              if (!spinner) return null
              const style = getComputedStyle(spinner)
              return { width: style.width, height: style.height }
            })(),
          }
        : null,
      // B2 submit — встроенное действие 44×44; оно измеряется отдельно как code.action.
      submit: rect(
        main?.querySelector('button[type="submit"]:not([data-testid="invitation-check"])') ?? null,
      ),
      feedback: rect(document.querySelector('[data-testid="register-feedback"]')),
      footer: {
        product: rect(document.querySelector('[data-testid="auth-product-line"]')),
        legal: [...document.querySelectorAll('[data-testid="auth-legal"] a')].map((link) =>
          rect(link),
        ),
      },
    }
  })
}

for (const [device, states] of Object.entries(MATRIX) as Array<[Device, string[]]>) {
  for (const state of states) {
    const name = `${device}-${state}`
    test(`US-M01-01 ${name}`, async ({ page }) => {
      await page.clock.setFixedTime(NOW)
      await page.setViewportSize(DEVICES[device])
      await STATES[state]!(page)
      await settle(page)
      writeFileSync(`${OUT}/${name}.geometry.json`, JSON.stringify(await measure(page), null, 2))
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true, animations: 'disabled' })
    })
  }
}
