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
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(
    () => document.activeElement instanceof HTMLElement && document.activeElement.blur(),
  )
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

test('F01 register-phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockGuest(page)
  await page.route('**/api/v1/auth/registration', (route) => json(route, { mode: 'invite' }))
  await page.goto('/register')
  await page.getByRole('heading', { level: 1 }).waitFor()
  await settle(page)
  await page.screenshot({ path: `${OUT}/F01/actual/register-phone.png`, fullPage: true })
})

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
      if (view === 'list') await page.getByRole('button', { name: 'Список' }).click()
      await settle(page)
      await page.screenshot({
        path: `${OUT}/F02/actual/radar-${view}-${device}.png`,
        fullPage: true,
      })
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
    await page.screenshot({ path: `${OUT}/F02/actual/risk-detail-${device}.png`, fullPage: true })

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
