/**
 * Кадры реализации для визуальной сверки. Данные синтетические: мок API
 * (`tests/e2e/fixtures/api.ts`) и единый набор из 12 рисков по составу кадров
 * Figma; список, деталь, точки, переписка и деньги согласованы между собой.
 * Условия: Chromium, DPR 1, ru-RU, Europe/Moscow, reduced-motion, замороженное
 * «сейчас» (23.10.2026 15:40 МСК, как в Figma), ожидание шрифтов и конечного
 * состояния запросов без произвольных пауз, без фокуса на полях.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, type Page, type Route } from '@playwright/test'
import {
  CONVERSATION_ID,
  OPPORTUNITY_ID,
  RISK_ID,
  mockGuest,
  mockOwner,
} from '../../tests/e2e/fixtures/api'

const OUT = resolve(process.env.VISUAL_OUT ?? 'artifacts/frontend-v2')
mkdirSync(`${OUT}/F01/actual`, { recursive: true })
mkdirSync(`${OUT}/F02/actual`, { recursive: true })

/** Момент съёмки: в Figma «23 октября 2026 · 15:40 МСК». */
const NOW = new Date('2026-10-23T12:40:00Z')

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

/** Шрифты загружены, фокуса и наведения нет; состояния запросов к этому моменту уже конечные. */
async function settle(page: Page): Promise<void> {
  await page.mouse.move(0, 0)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.evaluate(() => document.fonts.ready)
  // Переходы (например, после переключения «Список/Плитки») должны закончиться: кадр — только в конечном состоянии.
  // Бесконечные анимации (спиннер состояния «отправка») не ждём: только конечные переходы.
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

/**
 * Полный кадр по высоте документа, измеренной в этот же момент. Боковая панель — `sticky` высотой
 * окна (`h-dvh`): при прокрутке пользователь видит её залитой до низа (проверено e2e «боковая
 * панель залита на всю высоту»), но в одном кадре на всю страницу она оборвалась бы на высоте окна.
 * Только для съёмки панели задаётся высота документа; на остальную раскладку это не влияет.
 */
async function fullShot(page: Page, file: string): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  const width = page.viewportSize()!.width
  await page.addStyleTag({
    content: `aside[class*="lg:sticky"] { height: ${height}px !important; }`,
  })
  const after = await page.evaluate(() => document.documentElement.scrollHeight)
  if (after !== height) {
    throw new Error(`Высота документа изменилась при растяжении панели: ${height} → ${after}`)
  }
  await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: 0, width, height } })
}

/* ---------- F01: Доступ ---------- */

const access = [
  ['login-desktop', 1440, 1000],
  ['login-tablet', 834, 1194],
  ['login-phone', 390, 844],
] as const

for (const [name, width, height] of access) {
  test(`F01 ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await mockGuest(page)
    await page.goto('/login')
    await page.getByRole('heading', { level: 1 }).waitFor()
    await page.getByLabel('Электронная почта').fill('owner@example.test')
    await settle(page)
    await page.screenshot({ path: `${OUT}/F01/actual/${name}.png`, fullPage: true })
  })
}

test('F01 login-phone: ошибка', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockGuest(page)
  await page.route('**/api/v1/auth/login', (route) =>
    json(route, { error: { code: 'INVALID_CREDENTIALS', message: '', traceId: 'visual' } }, 401),
  )
  await page.goto('/login')
  await page.getByLabel('Электронная почта').fill('owner@example.test')
  await page.getByLabel('Пароль', { exact: true }).fill('wrong-pass-1')
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.getByText('Не удалось войти').waitFor()
  await settle(page)
  await page.screenshot({ path: `${OUT}/F01/actual/login-phone-error.png`, fullPage: true })
})

test('F01 login-phone: отправка', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockGuest(page)
  await page.route('**/api/v1/auth/login', () => new Promise(() => {}))
  await page.goto('/login')
  await page.getByLabel('Электронная почта').fill('owner@example.test')
  await page.getByLabel('Пароль', { exact: true }).fill('wrong-pass-1')
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.locator('button[aria-busy="true"]').waitFor()
  await settle(page)
  await page.screenshot({ path: `${OUT}/F01/actual/login-phone-busy.png`, fullPage: true })
})

test('F01 login-phone: первичная загрузка', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/v1/auth/me', () => new Promise(() => {}))
  await page.goto('/login')
  await page.getByRole('heading', { level: 1 }).waitFor()
  await settle(page)
  await page.screenshot({ path: `${OUT}/F01/actual/login-phone-loading.png`, fullPage: true })
})

/*
 * Регистрация US-M01-01 (A/B2/B3/C) снимается отдельной спекой `us-m01-01.capture.spec.ts` по
 * согласованным кадрам 461:5460/5475/5490; прежние кадры F03 формы с полем кода устарели.
 */

/** Размеры кадров F03 (используются и остальными экранами доступа ниже). */
const registerDevices = [
  ['desktop', 1440, 1000],
  ['tablet', 834, 1194],
  ['phone', 390, 844],
] as const

/** Код из 43 допустимых символов, как в макете «Отправка» (EXAMPLE_aaa…). */
const EXAMPLE_CODE = `EXAMPLE_${'a'.repeat(35)}`

/* ---------- F03: восстановление пароля, новый пароль, ссылка, подтверждение почты ---------- */

const TOKEN = 'T'.repeat(43)
const failure = (code: string) => ({ error: { code, message: '', traceId: 'visual' } })

type AccessFlow = {
  name: string
  path: string
  /** Состояние → подготовка и ожидание готового кадра. */
  states: Record<string, (page: Page) => Promise<void>>
}

const accessFlows: AccessFlow[] = [
  {
    name: 'forgot',
    path: '/forgot-password',
    states: {
      '': async (page) => {
        await mockGuest(page)
        await page.goto('/forgot-password')
        await page.getByLabel('Электронная почта').fill('owner@example.test')
      },
      error: async (page) => {
        await mockGuest(page)
        await page.route('**/api/v1/auth/password/forgot', (route) => route.abort('failed'))
        await page.goto('/forgot-password')
        await page.getByLabel('Электронная почта').fill('owner@example.test')
        await page.getByRole('button', { name: 'Отправить ссылку' }).click()
        await page.getByText('Не удалось отправить письмо').waitFor()
      },
      busy: async (page) => {
        await mockGuest(page)
        await page.route('**/api/v1/auth/password/forgot', () => new Promise(() => {}))
        await page.goto('/forgot-password')
        await page.getByLabel('Электронная почта').fill('owner@example.test')
        await page.getByRole('button', { name: 'Отправить ссылку' }).click()
        await page.locator('button[aria-busy="true"]').waitFor()
      },
      loading: async (page) => {
        await page.route('**/api/v1/auth/me', () => new Promise(() => {}))
        await page.goto('/forgot-password')
        await page.getByRole('heading', { level: 1 }).waitFor()
      },
    },
  },
  {
    name: 'reset',
    path: `/reset-password#token=${TOKEN}`,
    states: {
      '': async (page) => {
        await mockGuest(page)
        await page.goto(`/reset-password#token=${TOKEN}`)
        await page.getByLabel('Новый пароль').waitFor()
      },
      error: async (page) => {
        await mockGuest(page)
        await page.goto(`/reset-password#token=${TOKEN}`)
        await page.getByLabel('Новый пароль').fill('password-123')
        await page.getByLabel('Повторите пароль').fill('password-1')
        await page.getByRole('button', { name: 'Сменить пароль' }).click()
        await page.getByText('Пароли не совпадают').waitFor()
      },
      busy: async (page) => {
        await mockGuest(page)
        await page.route('**/api/v1/auth/password/reset', () => new Promise(() => {}))
        await page.goto(`/reset-password#token=${TOKEN}`)
        await page.getByLabel('Новый пароль').fill('password-123')
        await page.getByLabel('Повторите пароль').fill('password-123')
        await page.getByRole('button', { name: 'Сменить пароль' }).click()
        await page.locator('button[aria-busy="true"]').waitFor()
      },
      loading: async (page) => {
        await page.route('**/api/v1/auth/me', () => new Promise(() => {}))
        await page.goto(`/reset-password#token=${TOKEN}`)
        await page.getByRole('heading', { level: 1 }).waitFor()
      },
    },
  },
  {
    name: 'invalid',
    path: '/reset-password',
    states: {
      '': async (page) => {
        await mockGuest(page)
        await page.goto('/reset-password')
        await page.getByText('Ссылка недействительна').waitFor()
      },
      error: async (page) => {
        await mockGuest(page)
        await page.route('**/api/v1/auth/password/reset', (route) =>
          json(route, failure('RESET_TOKEN_INVALID'), 400),
        )
        await page.goto(`/reset-password#token=${TOKEN}`)
        await page.getByLabel('Новый пароль').fill('password-123')
        await page.getByLabel('Повторите пароль').fill('password-123')
        await page.getByRole('button', { name: 'Сменить пароль' }).click()
        await page.getByText('Ссылка недействительна').waitFor()
      },
      busy: async (page) => {
        await mockGuest(page)
        // Код страницы запроса подгружается: пока он не пришёл, кнопка занята («Открываем форму…»).
        await page.route('**/assets/forgot-password-*.js', () => new Promise(() => {}))
        await page.goto('/reset-password')
        await page.getByRole('button', { name: 'Запросить новую ссылку' }).click()
        await page.locator('button[aria-busy="true"]').waitFor()
      },
      loading: async (page) => {
        await page.route('**/api/v1/auth/me', () => new Promise(() => {}))
        await page.goto('/reset-password')
        await page.getByRole('heading', { level: 1 }).waitFor()
      },
    },
  },
  {
    name: 'verify',
    path: `/verify-email#token=${TOKEN}`,
    states: {
      '': async (page) => {
        await mockGuest(page)
        await page.route('**/api/v1/auth/email/verify', (route) =>
          json(route, failure('VERIFICATION_TOKEN_INVALID'), 400),
        )
        await page.goto(`/verify-email#token=${TOKEN}`)
        await page.getByText('Ссылка недействительна').waitFor()
      },
      error: async (page) => {
        await mockGuest(page)
        await page.route('**/api/v1/auth/email/verify', (route) => route.abort('failed'))
        await page.goto(`/verify-email#token=${TOKEN}`)
        await page.getByText('Нет соединения').waitFor()
      },
      busy: async (page) => {
        await mockGuest(page)
        await page.route('**/api/v1/auth/email/verify', () => new Promise(() => {}))
        await page.goto(`/verify-email#token=${TOKEN}`)
        await page.getByText('Проверка выполняется…').waitFor()
      },
      loading: async (page) => {
        await page.route('**/api/v1/auth/me', () => new Promise(() => {}))
        await page.goto(`/verify-email#token=${TOKEN}`)
        await page.getByText('Результат появится здесь автоматически.').waitFor()
      },
    },
  },
]

/* ---------- F03 S3: выбор рабочего пространства, приглашение ---------- */

/** Код приглашения из макета «Сохранение и проверка»: 43 символа. */
const INVITE_CODE = `example_invite_${'0'.repeat(28)}`

const plainFlows: AccessFlow[] = [
  {
    name: 'workspaces',
    path: '/workspaces',
    states: {
      '': async (page) => {
        await mockOwner(page)
        await page.goto('/workspaces')
        await page.getByRole('button', { name: /Студия «Блик»/ }).waitFor()
      },
      // Страница Radar не загрузилась: выбор остаётся в списке, предлагается повтор.
      error: async (page) => {
        await mockOwner(page)
        await page.route('**/assets/radar-*.js', (route) => route.abort('failed'))
        await page.goto('/workspaces')
        await page.getByRole('button', { name: /Студия «Блик»/ }).click()
        await page.getByText('Не удалось загрузить пространства').waitFor()
      },
      busy: async (page) => {
        await mockOwner(page)
        await page.route('**/assets/radar-*.js', () => new Promise(() => {}))
        await page.goto('/workspaces')
        await page.getByRole('button', { name: /Студия «Блик»/ }).click()
        await page.getByText('Открываем пространство…').waitFor()
      },
      loading: async (page) => {
        await page.route('**/api/v1/auth/me', () => new Promise(() => {}))
        await page.goto('/workspaces')
        await page.getByRole('heading', { level: 1 }).waitFor()
      },
    },
  },
  {
    name: 'invitation',
    path: '/invitations/accept',
    states: {
      '': async (page) => {
        await mockOwner(page)
        await page.goto('/invitations/accept')
        await page.getByLabel('Код приглашения').waitFor()
      },
      error: async (page) => {
        await mockOwner(page)
        await page.route('**/api/v1/invitations/accept', (route) =>
          json(route, failure('INVITATION_NOT_FOUND'), 404),
        )
        await page.goto('/invitations/accept')
        await page.getByLabel('Код приглашения').fill(EXAMPLE_CODE)
        await page.getByRole('button', { name: 'Присоединиться' }).click()
        await page.getByText('Код недействителен или срок его действия истёк').waitFor()
      },
      busy: async (page) => {
        await mockOwner(page)
        await page.route('**/api/v1/invitations/accept', () => new Promise(() => {}))
        await page.goto('/invitations/accept')
        await page.getByLabel('Код приглашения').fill(INVITE_CODE)
        await page.getByRole('button', { name: 'Присоединиться' }).click()
        await page.locator('button[aria-busy="true"]').waitFor()
      },
      loading: async (page) => {
        await page.route('**/api/v1/auth/me', () => new Promise(() => {}))
        await page.goto('/invitations/accept')
        await page.getByRole('heading', { level: 1 }).waitFor()
      },
    },
  },
]

/* ---------- F03 S4: мастер «Начало работы» ---------- */

/** Новый владелец без организации с правом её создать (ADR 0057). */
async function mockNewOwner(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/me', (route) =>
    json(route, {
      canCreateOrganization: true,
      user: {
        id: '01990000-0000-7000-8000-000000000101',
        email: 'owner@example.test',
        displayName: 'Мария Владелец',
        status: 'ACTIVE',
        emailVerifiedAt: '2026-10-13T08:00:00Z',
        deletionDueAt: null,
        createdAt: '2026-10-13T00:00:00Z',
        updatedAt: '2026-10-13T00:00:00Z',
      },
      memberships: [],
    }),
  )
}

const onboardingFlows: AccessFlow[] = [
  {
    name: 'company',
    path: '/onboarding/company',
    states: {
      '': async (page) => {
        await mockNewOwner(page)
        await page.goto('/onboarding/company')
        await page.getByLabel('Название компании').fill('Detail Lab')
      },
      error: async (page) => {
        await mockNewOwner(page)
        await page.goto('/onboarding/company')
        await page.getByRole('button', { name: 'Создать компанию' }).click()
        await page.getByText('Введите название компании').waitFor()
      },
      busy: async (page) => {
        await mockNewOwner(page)
        await page.route('**/api/v1/organizations', () => new Promise(() => {}))
        await page.goto('/onboarding/company')
        await page.getByLabel('Название компании').fill('Detail Lab')
        await page.getByRole('button', { name: 'Создать компанию' }).click()
        await page.locator('button[aria-busy="true"]').waitFor()
      },
      loading: async (page) => {
        await page.route('**/api/v1/auth/me', () => new Promise(() => {}))
        await page.goto('/onboarding/company')
        await page.getByRole('heading', { level: 1 }).waitFor()
      },
    },
  },
]

/** Шаг 2 «Точка и график»: владелец с готовой точкой (как в макете «Студия на Тверской»). */
/** Как в макете: пройден только шаг «Компания». */
async function mockOwnerAtLocationStep(page: Page): Promise<void> {
  await mockOwner(page)
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
        activeLocations: 1,
        locationsWithSchedule: 0,
        activeServices: 0,
        connections: 0,
        liveConnections: 0,
        telegramLinked: false,
      },
      computedAt: '2026-10-23T12:40:00Z',
    }),
  )
}

const locationFlows: AccessFlow[] = [
  {
    name: 'location',
    path: '/onboarding/location',
    states: {
      '': async (page) => {
        await mockOwnerAtLocationStep(page)
        await page.goto('/onboarding/location')
        await page.getByText('График точки').first().waitFor()
      },
      error: async (page) => {
        await mockOwnerAtLocationStep(page)
        await page.goto('/onboarding/location')
        await page.locator('input[name="opens-1"]').fill('20:00')
        await page.locator('input[name="closes-1"]').fill('09:00')
        await page.getByRole('button', { name: 'Сохранить и продолжить' }).click()
        await page.getByText('Время окончания должно быть позже начала.').waitFor()
      },
      busy: async (page) => {
        await mockOwnerAtLocationStep(page)
        await page.route('**/api/v1/locations/*/business-hours', () => new Promise(() => {}))
        await page.goto('/onboarding/location')
        await page.locator('input[name="opens-6"]').fill('10:00')
        await page.locator('input[name="closes-6"]').fill('18:30')
        await page.locator('input[name="closes-6"]').fill('18:00')
        await page.getByRole('button', { name: 'Сохранить и продолжить' }).click()
        await page.locator('button[aria-busy="true"]').waitFor()
      },
      loading: async (page) => {
        await mockOwnerAtLocationStep(page)
        await page.route('**/api/v1/locations', () => new Promise(() => {}))
        await page.goto('/onboarding/location')
        await page.getByRole('status', { name: 'Загрузка точек' }).waitFor()
      },
    },
  },
]

/** Как в макете шага 3: пройдены «Компания» и «Точка и график». */
async function mockOwnerAtServicesStep(page: Page): Promise<void> {
  await mockOwner(page)
  await page.route('**/api/v1/organization/onboarding', (route) =>
    json(route, {
      complete: false,
      nextStep: 'SERVICES',
      steps: [
        { key: 'ORGANIZATION', required: true, done: true },
        { key: 'LOCATION', required: true, done: true },
        { key: 'SERVICES', required: true, done: false },
        { key: 'CHANNEL', required: true, done: false },
        { key: 'TELEGRAM_LINK', required: false, done: false },
      ],
      facts: {
        activeLocations: 1,
        locationsWithSchedule: 1,
        activeServices: 1,
        connections: 0,
        liveConnections: 0,
        telegramLinked: false,
      },
      computedAt: '2026-10-23T12:40:00Z',
    }),
  )
}

const servicesFlows: AccessFlow[] = [
  {
    name: 'services',
    path: '/onboarding/services',
    states: {
      '': async (page) => {
        await mockOwnerAtServicesStep(page)
        await page.goto('/onboarding/services')
        await page.getByLabel('Название услуги').waitFor()
      },
      error: async (page) => {
        await mockOwnerAtServicesStep(page)
        await page.goto('/onboarding/services')
        await page.getByLabel('Название услуги').fill('Полировка кузова')
        await page.getByLabel('Цена от').fill('90 000')
        await page.getByLabel('Цена до').fill('50 000')
        await page.getByRole('button', { name: 'Добавить услугу' }).click()
        await page.getByText('Цена «до» не может быть меньше цены «от».').waitFor()
      },
      busy: async (page) => {
        await mockOwnerAtServicesStep(page)
        await page.route('**/api/v1/services', (route) =>
          route.request().method() === 'POST' ? new Promise(() => {}) : route.fallback(),
        )
        await page.goto('/onboarding/services')
        await page.getByLabel('Название услуги').fill('Полировка кузова')
        await page.getByLabel('Цена от').fill('50 000')
        await page.getByLabel('Цена до').fill('90 000')
        await page.getByRole('button', { name: 'Добавить услугу' }).click()
        await page.locator('button[aria-busy="true"]').waitFor()
      },
      loading: async (page) => {
        await mockOwnerAtServicesStep(page)
        await page.route('**/api/v1/services**', () => new Promise(() => {}))
        await page.goto('/onboarding/services')
        await page.getByRole('status', { name: 'Загрузка услуг' }).waitFor()
      },
    },
  },
]

/** Шаг 4: пройдены три шага; источник и личные уведомления — по параметрам кадра. */
async function mockOwnerAtChannelStep(
  page: Page,
  options: { channel: boolean; linked: boolean },
): Promise<void> {
  await mockOwner(page)
  const status = () => ({
    complete: options.channel,
    nextStep: options.channel ? 'TELEGRAM_LINK' : 'CHANNEL',
    steps: [
      { key: 'ORGANIZATION', required: true, done: true },
      { key: 'LOCATION', required: true, done: true },
      { key: 'SERVICES', required: true, done: true },
      { key: 'CHANNEL', required: true, done: options.channel },
      { key: 'TELEGRAM_LINK', required: false, done: options.linked },
    ],
    facts: {
      activeLocations: 1,
      locationsWithSchedule: 1,
      activeServices: 1,
      connections: options.channel ? 1 : 0,
      liveConnections: options.channel ? 1 : 0,
      telegramLinked: options.linked,
    },
    computedAt: '2026-10-23T12:40:00Z',
  })
  await page.route('**/api/v1/organization/onboarding', (route) => json(route, status()))
  const connection = {
    id: '01990000-0000-7000-8000-000000000701',
    locationId: null,
    provider: 'CONNECTED_BUSINESS_BOT',
    name: '@LidradarExample_bot',
    status: 'ACTIVE',
    capabilities: ['CAN_RECEIVE_MESSAGES'],
    lastEventAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorCode: null,
    createdAt: '2026-10-23T12:00:00Z',
    updatedAt: '2026-10-23T12:00:00Z',
  }
  await page.route('**/api/v1/integrations', (route) =>
    json(route, { items: options.channel ? [connection] : [] }),
  )
}

const channelFlows: AccessFlow[] = [
  {
    name: 'channel',
    path: '/onboarding/channel',
    states: {
      '': async (page) => {
        await mockOwnerAtChannelStep(page, { channel: false, linked: false })
        await page.goto('/onboarding/channel')
        await page.getByRole('button', { name: 'Подключить Telegram' }).waitFor()
      },
      error: async (page) => {
        await mockOwnerAtChannelStep(page, { channel: false, linked: false })
        await page.route('**/api/v1/integrations', (route) => route.abort('failed'))
        await page.goto('/onboarding/channel')
        await page.getByText('Не удалось проверить подключение').waitFor()
      },
      // «Проверяем…» — явный повтор после сбоя чтения: второй запрос подключений не отвечает.
      busy: async (page) => {
        await mockOwnerAtChannelStep(page, { channel: false, linked: false })
        let hang = false
        await page.route('**/api/v1/integrations', (route) =>
          hang ? new Promise(() => {}) : route.abort('failed'),
        )
        await page.goto('/onboarding/channel')
        await page.getByRole('button', { name: 'Повторить проверку' }).waitFor()
        hang = true
        await page.getByRole('button', { name: 'Повторить проверку' }).click()
        await page.locator('button[aria-busy="true"]').waitFor()
      },
      loading: async (page) => {
        await mockOwnerAtChannelStep(page, { channel: false, linked: false })
        await page.route('**/api/v1/organization/onboarding', () => new Promise(() => {}))
        await page.goto('/onboarding/channel')
        await page.getByRole('status', { name: 'Загрузка статуса источника' }).waitFor()
      },
      bot: async (page) => {
        await mockOwnerAtChannelStep(page, { channel: true, linked: false })
        await page.goto('/onboarding/channel')
        await page.getByText('Telegram подключён').waitFor()
      },
      done: async (page) => {
        await mockOwnerAtChannelStep(page, { channel: true, linked: true })
        await page.goto('/onboarding/channel')
        await page.getByText('Telegram подключён').waitFor()
      },
    },
  },
]

/** Диалоги шага 4: «Подключить Telegram» и «Уведомления в Telegram» поверх страницы. */
const SYNTHETIC_TOKEN = '123456789:AAHsyntheticTokenForVisualQa0000000'

/** `setup` вешает свои маршруты после общих моков: у Playwright побеждает последний. */
async function openConnectDialog(page: Page, setup?: () => Promise<unknown>): Promise<void> {
  await mockOwnerAtChannelStep(page, { channel: false, linked: false })
  await setup?.()
  await page.goto('/onboarding/channel')
  await page.getByRole('button', { name: 'Подключить Telegram' }).click()
  await page.getByRole('dialog', { name: 'Подключить Telegram' }).waitFor()
}

const telegramFlows: AccessFlow[] = [
  {
    name: 'telegram',
    path: '/onboarding/channel',
    states: {
      '': openConnectDialog,
      error: async (page) => {
        await openConnectDialog(page, () =>
          page.route('**/api/v1/integrations/*/connect', (route) =>
            json(
              route,
              {
                error: {
                  code: 'CHANNEL_CREDENTIALS_REJECTED',
                  message: 'rejected',
                  traceId: 't-1',
                },
              },
              400,
            ),
          ),
        )
        await page.getByLabel('Название подключения').fill('Telegram · переписка клиентов')
        await page.getByLabel('Токен бота').fill(SYNTHETIC_TOKEN)
        await page.getByRole('button', { name: 'Подключить', exact: true }).click()
        await page.getByText('Токен не принят.').waitFor()
      },
      busy: async (page) => {
        await openConnectDialog(page, () =>
          page.route('**/api/v1/integrations/*/connect', () => new Promise(() => {})),
        )
        await page.getByLabel('Название подключения').fill('Telegram · переписка клиентов')
        await page.getByLabel('Токен бота').fill(SYNTHETIC_TOKEN)
        await page.getByRole('button', { name: 'Подключить', exact: true }).click()
        await page.getByRole('button', { name: 'Подключаем…' }).waitFor()
      },
      loading: async (page) => {
        await openConnectDialog(page, () =>
          page.route('**/api/v1/locations', () => new Promise(() => {})),
        )
        await page.getByRole('status', { name: 'Загружаем точки' }).waitFor()
      },
    },
  },
]

const instructionFlows: AccessFlow[] = [
  {
    name: 'instruction',
    path: '/onboarding/channel',
    states: {
      '': async (page) => {
        await openConnectDialog(page)
        await page.getByRole('button', { name: 'Подробная инструкция со скриншотами' }).click()
        await page.getByRole('dialog', { name: 'Подключение бота' }).waitFor()
        await page.locator('img[src*="step-01"]').waitFor()
        await page.waitForFunction(() =>
          [...document.images].every((image) => image.complete || image.loading === 'lazy'),
        )
      },
    },
  },
]

async function mockTelegramLink(
  page: Page,
  options: {
    linked?: boolean
    ttlMs?: number
    hangStatusAfterFirst?: boolean
    hangFirst?: boolean
  },
): Promise<void> {
  let reads = 0
  await page.route('**/api/v1/notifications/telegram-link', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    reads += 1
    if (options.hangFirst || (options.hangStatusAfterFirst && reads > 1))
      return new Promise(() => {})
    return json(
      route,
      options.linked ? { linked: true, linkedAt: '2026-10-23T12:00:00Z' } : { linked: false },
    )
  })
  await page.route('**/api/v1/notifications/telegram-link-token', (route) =>
    json(route, {
      startUrl: 'https://t.me/LidradarExample_bot?start=synthetic',
      expiresAt: new Date(
        new Date(NOW).getTime() + (options.ttlMs ?? 15 * 60_000) - 5_000,
      ).toISOString(),
    }),
  )
}

async function openNotifyDialog(page: Page, setup?: () => Promise<unknown>): Promise<void> {
  await mockOwnerAtChannelStep(page, { channel: true, linked: false })
  await setup?.()
  await page.goto('/onboarding/channel')
  await page.getByRole('button', { name: 'Уведомления в Telegram' }).click()
  await page.getByRole('dialog', { name: 'Уведомления в Telegram' }).waitFor()
}

const notifyFlows: AccessFlow[] = [
  {
    name: 'notify',
    path: '/onboarding/channel',
    states: {
      '': async (page) => {
        await openNotifyDialog(page, () => mockTelegramLink(page, {}))
        await page.getByText('Ссылка действует ещё').waitFor()
      },
      error: async (page) => {
        await openNotifyDialog(page, () => mockTelegramLink(page, { ttlMs: 6_500 }))
        await page.getByText('Ссылка больше не действует').waitFor({ timeout: 10_000 })
      },
      busy: async (page) => {
        await openNotifyDialog(page, () => mockTelegramLink(page, { hangStatusAfterFirst: true }))
        await page.getByRole('button', { name: 'Проверить привязку' }).click()
        await page.getByRole('button', { name: 'Проверяем…' }).waitFor()
      },
      loading: async (page) => {
        await openNotifyDialog(page, () => mockTelegramLink(page, { hangFirst: true }))
        await page.getByRole('status', { name: 'Загружаем статус' }).waitFor()
      },
      linked: async (page) => {
        await openNotifyDialog(page, () => mockTelegramLink(page, { linked: true }))
        await page.getByText('Уведомления успешно подключены').waitFor()
      },
    },
  },
]

/** «Настройки → Компания и график»: точка из макета без сохранённого графика. */
const settingsLocation = {
  id: '01990000-0000-7000-8000-000000000201',
  name: 'Студия на Тверской',
  timezone: 'Europe/Moscow',
  responseThresholdMinutes: 45,
  agreementThresholdMinutes: 120,
  active: true,
  businessHours: [],
  createdAt: '2026-10-23T12:00:00Z',
  updatedAt: '2026-10-23T12:00:00Z',
}

/** Режим ответов на повторное чтение: `ok` — как обычно, `fail` — сбой сети, `hang` — без ответа. */
interface SettingsControl {
  mode: 'ok' | 'fail' | 'hang'
}

async function mockSettingsCompany(
  page: Page,
  options: { items?: unknown[]; hang?: boolean; saveHang?: boolean } = {},
): Promise<SettingsControl> {
  const control: SettingsControl = { mode: 'ok' }
  await mockOwner(page)
  const serve = (route: Route, body: unknown) => {
    if (control.mode === 'fail') return route.abort('failed')
    if (control.mode === 'hang') return new Promise(() => {})
    return json(route, body)
  }
  await page.route('**/api/v1/locations', (route) => {
    if (options.hang) return new Promise(() => {})
    return serve(route, { items: options.items ?? [settingsLocation] })
  })
  if (options.hang) await page.route('**/api/v1/organization', () => new Promise(() => {}))
  else {
    // Организацию отдаёт общий мок; повторное чтение перехватывается тем же режимом.
    await page.route('**/api/v1/organization', (route) =>
      control.mode === 'ok'
        ? route.fallback()
        : control.mode === 'fail'
          ? route.abort('failed')
          : new Promise(() => {}),
    )
  }
  await page.route('**/api/v1/locations/*/business-hours', (route) => {
    if (options.saveHang) return new Promise(() => {})
    return json(route, { ...settingsLocation, businessHours: [] })
  })
  return control
}

/** Повторное чтение без сохранения: время уходит за срок свежести данных, вкладка «возвращается в фокус». */
async function triggerRefresh(page: Page, control: SettingsControl, mode: 'fail' | 'hang') {
  control.mode = mode
  await page.clock.setFixedTime(new Date(NOW.getTime() + 10 * 60_000))
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true })),
  )
}

async function openSettingsCompany(page: Page): Promise<void> {
  await page.goto('/settings/company')
  await page.getByRole('button', { name: 'Сохранить график' }).waitFor()
}

const settingsFlows: AccessFlow[] = [
  {
    name: 'settings-company',
    path: '/settings/company',
    states: {
      '': async (page) => {
        await mockSettingsCompany(page)
        await openSettingsCompany(page)
      },
      'refresh-error': async (page) => {
        const control = await mockSettingsCompany(page)
        await openSettingsCompany(page)
        await triggerRefresh(page, control, 'fail')
        await page.getByRole('button', { name: 'Повторить обновление' }).waitFor()
      },
      refreshing: async (page) => {
        const control = await mockSettingsCompany(page)
        await openSettingsCompany(page)
        await triggerRefresh(page, control, 'hang')
        await page.getByText('Обновляем данные. Предыдущие значения остаются на экране.').waitFor()
      },
      loading: async (page) => {
        await mockSettingsCompany(page, { hang: true })
        await page.goto('/settings/company')
        await page.getByRole('status', { name: 'Загрузка графика' }).waitFor()
      },
      nolocations: async (page) => {
        await mockSettingsCompany(page, { items: [] })
        await page.goto('/settings/company')
        await page.getByText('График появится после добавления точки').waitFor()
      },
      saving: async (page) => {
        await mockSettingsCompany(page, { saveHang: true })
        await openSettingsCompany(page)
        await page.getByRole('button', { name: 'Сохранить график' }).click()
        await page.locator('button[aria-busy="true"]').waitFor()
      },
      timeerror: async (page) => {
        await mockSettingsCompany(page)
        await openSettingsCompany(page)
        await page.locator('input[name="closes-2"]').fill('08:00')
        await page.getByRole('button', { name: 'Сохранить график' }).click()
        await page.getByText('Вторник: окончание рабочего дня должно быть позже начала.').waitFor()
      },
    },
  },
]

/** Окна настроек: на десктопе сравнивается само окно (эталон — кадр окна 640 px), на планшете и телефоне — экран. */
const settingsDialogs: Record<string, (page: Page) => Promise<void>> = {
  'location-add': async (page) => {
    await mockSettingsCompany(page)
    await openSettingsCompany(page)
    await page.getByRole('button', { name: 'Добавить точку' }).click()
    await page.getByRole('dialog', { name: 'Добавить точку' }).waitFor()
  },
  'location-edit': async (page) => {
    await mockSettingsCompany(page)
    await openSettingsCompany(page)
    await page.getByRole('button', { name: 'Изменить точку' }).click()
    await page.getByRole('dialog', { name: 'Изменить точку' }).waitFor()
  },
  'org-change': async (page) => {
    await mockSettingsCompany(page)
    await openSettingsCompany(page)
    await page.getByLabel('Основная валюта').selectOption('KZT')
    await page.getByRole('button', { name: 'Сохранить компанию' }).click()
    await page.getByRole('dialog', { name: 'Изменить валюту и часовой пояс?' }).waitFor()
  },
  unsaved: async (page) => {
    await mockSettingsCompany(page)
    await openSettingsCompany(page)
    await page.locator('input[name="opens-1"]').fill('08:00')
    const select = page.getByLabel('Раздел настроек')
    if (await select.isVisible()) await select.selectOption({ label: 'Услуги' })
    else await page.getByRole('link', { name: 'Услуги', exact: true }).click()
    await page.getByRole('dialog', { name: 'Сохранить изменения графика?' }).waitFor()
  },
}

for (const [device, width, height] of registerDevices) {
  for (const [key, prepare] of Object.entries(settingsDialogs)) {
    test(`F03 dialog-${key}-${device}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await prepare(page)
      await settle(page)
      const path = `${OUT}/F03/actual/dialog-${key}-${device}.png`
      if (device === 'desktop') await page.getByRole('dialog').screenshot({ path })
      else await page.screenshot({ path })
    })
  }
}

for (const flow of [
  ...accessFlows,
  ...plainFlows,
  ...onboardingFlows,
  ...locationFlows,
  ...servicesFlows,
  ...channelFlows,
  ...telegramFlows,
  ...instructionFlows,
  ...settingsFlows,
  ...notifyFlows,
]) {
  for (const [device, width, height] of registerDevices) {
    for (const [state, prepare] of Object.entries(flow.states)) {
      const file = `${flow.name}-${device}${state ? `-${state}` : ''}`
      test(`F03 ${file}`, async ({ page }) => {
        await page.setViewportSize({ width, height })
        await prepare(page)
        await settle(page)
        await page.screenshot({ path: `${OUT}/F03/actual/${file}.png`, fullPage: true })
      })
    }
  }
}

/* ---------- F02: Radar и деталь риска ---------- */

const TVERSKAYA = '01990000-0000-7000-8000-000000000201'
const KHAMOVNIKI = '01990000-0000-7000-8000-000000000202'
const locationIds = { Тверская: TVERSKAYA, Хамовники: KHAMOVNIKI } as const

type Proto = {
  name: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  status?: 'ACKNOWLEDGED'
  type: string
  reason: string
  amount: string | null
  quote: string
  service: string
  location: keyof typeof locationIds
}

// Состав 12 карточек Figma 21:1982 (тексты причин — как в макете).
const protos: Proto[] = [
  {
    name: 'Дмитрий Соколов',
    severity: 'CRITICAL',
    type: 'NO_RESPONSE',
    reason: 'Клиент спросил о цене и времени визита. Ответа нет больше 60 рабочих минут.',
    amount: '31000.00',
    quote: 'Здравствуйте! Сколько стоит полировка кузова и когда можно приехать?',
    service: 'Полировка кузова',
    location: 'Тверская',
  },
  {
    name: 'Анна Морозова',
    severity: 'CRITICAL',
    status: 'ACKNOWLEDGED',
    type: 'PROMISE_NOT_FULFILLED',
    reason: 'Расчёт обещали вчера',
    amount: '64000.00',
    quote: 'Вы обещали прислать расчёт по оклейке. Получится сегодня?',
    service: 'Оклейка передней части',
    location: 'Хамовники',
  },
  {
    name: 'Михаил Орлов',
    severity: 'CRITICAL',
    type: 'BOOKING_NOT_CONFIRMED',
    reason: 'Визит сегодня в 17:00',
    amount: '18500.00',
    quote: 'Подтвердите, пожалуйста: сегодня к пяти на химчистку?',
    service: 'Химчистка салона',
    location: 'Тверская',
  },
  {
    name: 'Елена Волкова',
    severity: 'HIGH',
    type: 'NO_RESPONSE',
    reason: 'Ждёт 1 ч 24 мин',
    amount: '28000.00',
    quote: 'Можно записаться на субботу? Хочу успеть до поездки.',
    service: 'Керамическое покрытие',
    location: 'Хамовники',
  },
  {
    name: 'Алексей Смирнов',
    severity: 'HIGH',
    status: 'ACKNOWLEDGED',
    type: 'CUSTOMER_SILENT_AFTER_PRICE',
    reason: '2 дня',
    amount: '45000.00',
    quote: 'За полировку и покрытие вместе будет 45 тысяч, верно?',
    service: 'Полировка и керамика',
    location: 'Тверская',
  },
  {
    name: 'Ольга Кузнецова',
    severity: 'HIGH',
    type: 'UNFINISHED_AGREEMENT',
    reason: 'Время не согласовано',
    amount: null,
    quote: 'Давайте на следующей неделе. Напишите, какие дни свободны.',
    service: 'Восстановление кожи',
    location: 'Хамовники',
  },
  {
    name: 'Сергей Петров',
    severity: 'HIGH',
    status: 'ACKNOWLEDGED',
    type: 'PROMISE_NOT_FULFILLED',
    reason: 'Фотографии обещали утром',
    amount: '12000.00',
    quote: 'Жду фото результата, чтобы решить, когда забирать машину.',
    service: 'Локальная полировка',
    location: 'Тверская',
  },
  {
    name: 'Наталья Белова',
    severity: 'HIGH',
    type: 'BOOKING_NOT_CONFIRMED',
    reason: 'Визит завтра в 10:00',
    amount: '36000.00',
    quote: 'Я смогу завтра утром. За мной оставили время?',
    service: 'Защитное покрытие',
    location: 'Хамовники',
  },
  {
    name: 'Игорь Лебедев',
    severity: 'MEDIUM',
    type: 'CUSTOMER_SILENT_AFTER_PRICE',
    reason: '3 дня',
    amount: '8500.00',
    quote: 'Спасибо, понял стоимость. Уточню расписание и вернусь.',
    service: 'Химчистка сидений',
    location: 'Тверская',
  },
  {
    name: 'Марина Соколова',
    severity: 'MEDIUM',
    status: 'ACKNOWLEDGED',
    type: 'UNFINISHED_AGREEMENT',
    reason: 'Ждёт уточнения состава работ',
    amount: null,
    quote: 'Нужен уход за салоном, но пока не знаю, какой пакет выбрать.',
    service: 'Подбор услуги',
    location: 'Хамовники',
  },
  {
    name: 'Павел Новиков',
    severity: 'MEDIUM',
    type: 'FOLLOW_UP_CANDIDATE',
    reason: 'После консультации прошло 5 дней',
    amount: '22000.00',
    quote: 'Вернусь из командировки в пятницу и тогда смогу записаться.',
    service: 'Полировка фар и кузова',
    location: 'Тверская',
  },
  {
    name: 'Виктория Андреева',
    severity: 'LOW',
    type: 'FOLLOW_UP_CANDIDATE',
    reason: 'После консультации прошло 7 дней',
    amount: '16000.00',
    quote: 'Сейчас не получится. Можно вернуться к этому через неделю?',
    service: 'Комплексный уход за салоном',
    location: 'Хамовники',
  },
]

// Первая карточка — риск RISK_ID: деталь открывается из ленты и повторяет её данные.
const DETECTED_AT = '2026-10-23T11:22:00Z' // 14:22 МСК
const DUE_AT = '2026-10-23T10:22:00Z' // 13:22 МСК: срок по правилу ≤ обнаружения
const MESSAGE_AT = '2026-10-23T10:22:00Z'

const risk = (index: number, proto: Proto) => ({
  risk: {
    id: index === 0 ? RISK_ID : `01990000-0000-7000-8000-00000000${1000 + index}`,
    opportunityId: OPPORTUNITY_ID,
    locationId: locationIds[proto.location],
    type: proto.type,
    severity: proto.severity,
    status: proto.status ?? 'OPEN',
    source: 'MANUAL',
    policyVersion: 'v1',
    triggerMessageId: null,
    reasonCode: 'X',
    reason: proto.reason,
    detectedAt: DETECTED_AT,
    dueAt: DUE_AT,
    updatedAt: DETECTED_AT,
  },
  opportunity: {
    id: OPPORTUNITY_ID,
    stage: 'NEW',
    locationId: locationIds[proto.location],
    serviceId: 's',
    potentialRevenue: proto.amount,
    currency: 'RUB',
  },
  conversation: {
    id: CONVERSATION_ID,
    contactId: 'c',
    lastMessage: {
      id: 'm',
      direction: 'INCOMING',
      type: 'TEXT',
      preview: proto.quote,
      sentAt: MESSAGE_AT,
    },
  },
  contact: { id: 'c', displayName: proto.name },
  service: { id: 's', name: proto.service, active: true },
  channel: {
    connectionId: 'x',
    provider: 'CONNECTED_BUSINESS_BOT',
    name: 'Telegram Business',
    status: 'ACTIVE',
  },
  externalLink: { url: null, kind: null, unavailableReason: 'PROVIDER_UNSUPPORTED' },
  recommendation: null,
  actions: [],
  outcome: null,
  revenue: null,
})
const items = protos.map((proto, index) => risk(index, proto))

const onboardingDone = {
  complete: true,
  nextStep: 'TELEGRAM_LINK',
  steps: [],
  facts: {
    activeLocations: 2,
    locationsWithSchedule: 2,
    activeServices: 3,
    connections: 1,
    liveConnections: 1,
    telegramLinked: true,
  },
  computedAt: DETECTED_AT,
}

async function owner(page: Page): Promise<void> {
  await mockOwner(page)
  await page.route('**/api/v1/organization/onboarding', (route) => json(route, onboardingDone))
  await page.route('**/api/v1/locations', (route) =>
    json(route, {
      items: [
        { id: TVERSKAYA, name: 'Тверская' },
        { id: KHAMOVNIKI, name: 'Хамовники' },
      ],
    }),
  )
  await page.route('**/api/v1/radar**', (route) =>
    json(route, {
      openRisks: 12,
      criticalRisks: 3,
      potentialRevenue: '281000.00',
      confirmedRecoveredRevenue: '74000.00',
      opportunitiesAtRisk: 10,
      opportunitiesWithUnknownAmount: 2,
    }),
  )
  await page.route('**/api/v1/risks**', (route) =>
    // Карточка риска запрашивается по id, список — по пути без id.
    new URL(route.request().url()).pathname.endsWith('/risks')
      ? json(route, { items, nextCursor: null })
      : route.fallback(),
  )
  // Деталь первой карточки: те же данные, что в ленте; расхождений с mockOwner нет.
  await page.route(`**/api/v1/risks/${RISK_ID}`, (route) => json(route, items[0]))
  await page.route(`**/api/v1/opportunities/${OPPORTUNITY_ID}`, (route) =>
    json(route, {
      opportunity: { id: OPPORTUNITY_ID, stage: 'NEW', currency: 'RUB' },
      stageHistory: [
        {
          id: 'h-1',
          opportunityId: OPPORTUNITY_ID,
          fromStage: null,
          toStage: 'NEW',
          source: 'RULE',
          confidence: null,
          aiRunId: null,
          actorUserId: null,
          createdAt: DUE_AT,
        },
      ],
    }),
  )
}

/** Конечное состояние потока обновлений: «недоступно» — красная точка у кнопки (Figma 256:2511). */
async function waitRealtimeSettled(page: Page): Promise<void> {
  await page.locator('button[title^="Автообновление недоступно"]').waitFor()
}

const sizes = [
  ['desktop', 1440, 1000],
  ['tablet', 834, 1194],
  ['phone', 390, 844],
] as const

for (const [device, width, height] of sizes) {
  for (const view of ['tiles', 'list'] as const) {
    test(`F02 radar-${view}-${device}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await owner(page)
      await page.goto('/radar')
      await page.getByRole('list', { name: 'Список активных рисков' }).waitFor()
      // Итоговые данные: сводка, подписи точек в карточках и состояние потока.
      await page.getByText('281 000').first().waitFor()
      await page
        .getByText(/Полировка кузова · Тверская/)
        .first()
        .waitFor()
      await waitRealtimeSettled(page)
      // Подвал ленты — признак того, что список дочитан и больше не меняет высоту.
      await page.getByText('Это все активные риски по выбранным фильтрам.').waitFor()
      if (view === 'list') await page.getByRole('button', { name: 'Список' }).click()
      await settle(page)
      await fullShot(page, `${OUT}/F02/actual/radar-${view}-${device}.png`)
    })
  }
  test(`F02 risk-detail-${device}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await owner(page)
    await page.goto(`/risks/${RISK_ID}`)
    await page.getByRole('heading', { level: 1 }).waitFor()
    // История с этапом сделки и имя точки загружаются отдельными запросами.
    await page.getByText('Сделка создана').waitFor()
    await page
      .getByText(/Полировка кузова · Тверская/)
      .first()
      .waitFor()
    await waitRealtimeSettled(page)
    await settle(page)
    await fullShot(page, `${OUT}/F02/actual/risk-detail-${device}.png`)

    // Замеры блоков документа для сверки с позициями Figma (эталон обрезан viewport).
    const blocks: Record<string, string> = {
      Ситуация: '[aria-labelledby="risk-reason-title"]',
      Переписка: '[aria-labelledby="risk-context-title"]',
      Рекомендация: '[aria-labelledby="risk-recommendation-title"]',
      'Работа по риску': '[aria-labelledby="risk-work-title"]',
      Деньги: '[aria-labelledby="risk-money-title"]',
      Сделка: '[aria-labelledby="stages-title"]',
      История: '[aria-labelledby="risk-history-title"]',
      'Оценка сигнала': '[aria-labelledby="risk-feedback-title"]',
    }
    const measured = await page.evaluate((selectors) => {
      const result: Record<string, { y: number; height: number }> = {}
      const rect = (element: Element | null) => {
        if (!element) return
        const box = element.getBoundingClientRect()
        return { y: box.top + window.scrollY, height: box.height }
      }
      for (const [name, selector] of Object.entries(selectors)) {
        const box = rect(document.querySelector(selector))
        if (box) result[name] = box
      }
      const close = [...document.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Закрыть риск…',
      )
      const closeBox = rect(close ?? null)
      if (closeBox) result['Закрыть риск'] = closeBox
      return result
    }, blocks)
    writeFileSync(
      `${OUT}/F02/actual/risk-detail-${device}.geometry.json`,
      JSON.stringify(measured, null, 2),
    )
  })
}
