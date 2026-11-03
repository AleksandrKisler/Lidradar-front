import { expect, test, type Page, type Route } from '@playwright/test'
import {
  mockOwner,
  keepEventStreamOpen,
  RISK_ID,
  CONVERSATION_ID,
  OPPORTUNITY_ID,
  TENANT_ID,
} from './fixtures/api'
import type { components } from '../../src/shared/api/generated/schema'
type AnalyticsSummary = components['schemas']['AnalyticsSummary']
type Payment = components['schemas']['Payment']
type RiskPrecisionReport = components['schemas']['RiskPrecisionReport']

test.use({ locale: 'ru-RU' })

const path = '/analytics?from=2026-10-19&to=2026-10-25'
const artifact = 'artifacts/frontend-v2/analytics-implementation-2026-11-03/browser-r7'
const kinds = [
  'NO_RESPONSE',
  'CUSTOMER_SILENT_AFTER_PRICE',
  'BOOKING_NOT_CONFIRMED',
  'PROMISE_NOT_FULFILLED',
  'FOLLOW_UP_CANDIDATE',
  'UNFINISHED_AGREEMENT',
] as const
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const failure = (route: Route, code = 'TEST_FAILURE', status = 422) =>
  json(route, { error: { code, traceId: 'analytics-test' } }, status)
function summary(from = '2026-10-19', to = '2026-10-25'): AnalyticsSummary {
  const dates: string[] = []
  for (
    let date = new Date(`${from}T00:00:00Z`);
    date.toISOString().slice(0, 10) <= to;
    date.setUTCDate(date.getUTCDate() + 1)
  )
    dates.push(date.toISOString().slice(0, 10))
  return {
    period: {
      fromDate: from,
      toDate: to,
      timezone: 'Europe/Moscow',
      from: `${from}T00:00:00+03:00`,
      to: `${new Date(Date.parse(to) + 86400000).toISOString().slice(0, 10)}T00:00:00+03:00`,
    },
    messages: { total: 40, incoming: 25, outgoing: 15, conversations: 6 },
    opportunities: { created: 8, booked: 3, won: 2, lost: 1 },
    risks: {
      detected: 24,
      acted: 18,
      resolved: 11,
      falsePositive: 2,
      byType: kinds.map((riskType, i) => ({
        riskType,
        detected: [8, 6, 4, 3, 2, 1][i]!,
        acted: [6, 5, 3, 2, 1, 1][i]!,
        resolved: [4, 3, 2, 1, 1, 0][i]!,
        falsePositive: i < 2 ? 1 : 0,
      })),
    },
    outcomes: { booked: 3, paid: 3, lost: 1 },
    revenue: {
      currency: 'RUB',
      potential: '47000.00',
      atRiskPotential: '28000.00',
      atRiskOpportunities: 3,
      atRiskUnknownAmountOpportunities: 2,
      confirmed: '59000.00',
      confirmedRecovered: '43000.00',
      confirmedPayments: 3,
    },
    attribution: [
      { type: 'RECOVERED', amount: '43000.00', count: 2 },
      { type: 'ORGANIC', amount: '16000.00', count: 1 },
      { type: 'UNKNOWN', amount: '0.00', count: 0 },
    ],
    series: dates.map((date, i) => ({
      date,
      incoming: i === dates.length - 1 ? 25 : 0,
      outgoing: i === dates.length - 1 ? 15 : 0,
      risksDetected: i === dates.length - 1 ? 24 : 0,
      confirmedRecovered: i === dates.length - 1 ? '43000.00' : '0.00',
      confirmed: i === dates.length - 1 ? '59000.00' : '0.00',
      payments: i === dates.length - 1 ? 3 : 0,
    })),
  }
}
const payments: Payment[] = [
  {
    eventId: '01990000-0000-7000-8000-000000009003',
    opportunityId: OPPORTUNITY_ID,
    conversationId: CONVERSATION_ID,
    contactId: '01990000-0000-7000-8000-000000000701',
    contactDisplayName: 'Дмитрий Соколов',
    serviceName: 'Полировка кузова',
    amount: '31000.00',
    currency: 'RUB',
    attribution: 'RECOVERED',
    riskId: RISK_ID,
    confirmedBy: '01990000-0000-7000-8000-000000000101',
    confirmedAt: '2026-10-25T11:00:00Z',
  },
  {
    eventId: '01990000-0000-7000-8000-000000009002',
    opportunityId: OPPORTUNITY_ID,
    conversationId: CONVERSATION_ID,
    contactId: '01990000-0000-7000-8000-000000000701',
    contactDisplayName: null,
    serviceName: null,
    amount: '12000.00',
    currency: 'RUB',
    attribution: 'RECOVERED',
    riskId: RISK_ID,
    confirmedBy: '01990000-0000-7000-8000-000000000101',
    confirmedAt: '2026-10-25T10:00:00Z',
  },
  {
    eventId: '01990000-0000-7000-8000-000000009001',
    opportunityId: OPPORTUNITY_ID,
    conversationId: CONVERSATION_ID,
    contactId: '01990000-0000-7000-8000-000000000701',
    contactDisplayName: 'Елена',
    serviceName: 'Диагностика',
    amount: '16000.00',
    currency: 'RUB',
    attribution: 'ORGANIC',
    riskId: null,
    confirmedBy: '01990000-0000-7000-8000-000000000101',
    confirmedAt: '2026-10-25T09:00:00Z',
  },
]
async function setup(page: Page) {
  await mockOwner(page)
  await keepEventStreamOpen(page)
  await page.clock.setFixedTime(new Date('2026-10-25T11:30:00Z'))
  await page.route('**/api/v1/analytics/summary**', (route) => {
    const u = new URL(route.request().url())
    return json(route, summary(u.searchParams.get('from')!, u.searchParams.get('to')!))
  })
  await page.route('**/api/v1/analytics/payments**', (route) => {
    const u = new URL(route.request().url())
    const cursor = u.searchParams.get('cursor')
    const period = summary(u.searchParams.get('from')!, u.searchParams.get('to')!).period
    expect(u.searchParams.get('limit')).toBe('20')
    return json(route, {
      period,
      items: (cursor ? payments.slice(1) : payments.slice(0, 1)).map((item) => ({
        ...item,
        confirmedAt: `${period.toDate}${item.confirmedAt.slice(10)}`,
      })),
      nextCursor: cursor ? null : 'next-1',
    })
  })
  await page.route('**/api/v1/risks/precision**', (route) => {
    const u = new URL(route.request().url())
    const report: RiskPrecisionReport = {
      from: u.searchParams.get('from')!,
      to: u.searchParams.get('to')!,
      minimumCoverage: 0.3,
      items: kinds.map((riskType, i) => ({
        riskType,
        totalRisks: [8, 6, 4, 3, 2, 1][i]!,
        withFeedback: i === 0 ? 5 : 0,
        truePositives: i === 0 ? 4 : 0,
        falsePositives: i === 0 ? 1 : 0,
        precision: i === 0 ? 0.8 : null,
        falsePositiveRate: i === 0 ? 0.2 : null,
        coverageRate: i === 0 ? 0.625 : 0,
        reliable: i === 0,
      })),
    }
    return json(route, report)
  })
}
test.beforeEach(async ({ page }) => setup(page))
for (const [device, width, height] of [
  ['Desktop', 1440, 1000],
  ['Tablet', 834, 1194],
  ['Mobile', 390, 844],
] as const) {
  test(`аналитика: три вкладки, общий период и изображения ${device}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(path)
    for (const [tab, label] of [
      ['overview', 'Обзор'],
      ['quality', 'Риски и качество'],
      ['payments', 'Оплаты'],
    ] as const) {
      await page.getByRole('tab', { name: label, exact: true }).click()
      await expect(page.getByRole('tabpanel')).toBeVisible()
      await expect(page.getByRole('tabpanel')).toContainText(
        tab === 'overview' ? '43 000' : tab === 'quality' ? '80 %' : '59 000',
      )
      await page.evaluate(() => document.fonts.ready)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      await page.screenshot({ path: `${artifact}/${tab}-${device}.png`, fullPage: true })
      await page.screenshot({ path: `${artifact}/${tab}-${device}-viewport.png`, fullPage: false })
      if (tab === 'overview') {
        const plot = page.getByRole('group', { name: /Возвращённая выручка по дням/ })
        await plot.focus()
        await page.keyboard.press('Home')
        await expect(page.getByRole('tabpanel')).toContainText('Выбран')
        await page.getByRole('button', { name: 'Данные по дням', exact: true }).click()
        const daily = page.getByRole('dialog', { name: 'Данные по дням', exact: true })
        await expect(daily.locator('tbody tr')).toHaveCount(7)
        const bounds = (await daily.boundingBox())!
        const close = (await daily
          .getByRole('button', { name: 'Закрыть', exact: true })
          .boundingBox())!
        const title = (await daily.getByRole('heading', { name: 'Данные по дням' }).boundingBox())!
        const description = (await daily.locator('p').first().boundingBox())!
        expect(close.width).toBeCloseTo(bounds.width - 48, 0)
        expect(description.x).toBe(title.x)
        await page.screenshot({ path: `${artifact}/daily-${device}.png`, fullPage: true })
        await page.screenshot({ path: `${artifact}/daily-${device}-viewport.png`, fullPage: false })
        await page.keyboard.press('Escape')
        await expect(
          page.getByRole('button', { name: 'Данные по дням', exact: true }),
        ).toBeFocused()
        await page.keyboard.press('Escape')
      }
    }
    await page.getByRole('button', { name: '90 дней', exact: true }).click()
    await expect(page.getByTestId('analytics-period')).toContainText('90 дн.')
    await page.getByRole('tab', { name: 'Обзор', exact: true }).click()
    await expect(page.getByTestId('analytics-period')).toContainText('90 дн.')
    await page
      .getByRole('form', { name: 'Период аналитики' })
      .getByRole('button', { name: /2026/ })
      .click()
    await expect(page.getByRole('dialog', { name: 'Период аналитики', exact: true })).toBeVisible()
    await page.screenshot({ path: `${artifact}/period-${device}-viewport.png`, fullPage: false })
    await page.keyboard.press('Escape')
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Обзор', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByTestId('analytics-period')).toContainText('90 дн.')
  })
}
test('аналитика: custom draft, отмена, Escape, one-day, invalid, future, mobile focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(path + '&tab=payments')
  const open = async () => {
    await page.getByRole('button', { name: /19 — 25 октября 2026|Выбрать период/ }).click()
  }
  await open()
  const dialog = page.getByRole('dialog', { name: 'Период аналитики' })
  await expect(dialog).toBeVisible()
  expect(await dialog.boundingBox()).toMatchObject({ x: 0, y: 0, width: 390, height: 844 })
  await page.screenshot({ path: `${artifact}/period-Mobile.png`, fullPage: false })
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  }
  await dialog.getByLabel('Начало периода').fill('2026-10-24')
  await dialog.getByRole('button', { name: 'Отменить' }).click()
  await expect(page).toHaveURL(path + '&tab=payments')
  await open()
  await dialog.getByLabel('Начало периода').fill('2026-10-23')
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(path + '&tab=payments')
  await expect(page.getByRole('button', { name: /19 — 25 октября 2026/ })).toBeFocused()
  await open()
  await dialog.getByLabel('Начало периода').fill('2026-10-26')
  await dialog.getByRole('button', { name: 'Применить' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Дата начала позже даты окончания')
  await dialog.getByLabel('Начало периода').fill('2025-01-01')
  await dialog.getByRole('button', { name: 'Применить' }).click()
  await expect(dialog.getByRole('alert')).toContainText('366')
  await dialog.getByLabel('Начало периода').fill('')
  await dialog.getByRole('button', { name: 'Применить' }).click()
  await expect(dialog.getByRole('alert')).toContainText('обе даты')
  await dialog.getByLabel('Начало периода').fill('2027-01-02')
  await dialog.getByLabel('Конец периода').fill('2027-01-02')
  await dialog.getByRole('button', { name: 'Применить' }).click()
  await expect(page).toHaveURL(/from=2027-01-02&to=2027-01-02&tab=payments/)
  await expect(page.getByTestId('analytics-period')).toContainText('1 дн.')
})
test('аналитика: независимые ошибки summary/precision и local retry', async ({ page }) => {
  let broken = true
  await page.route('**/api/v1/analytics/summary**', (route) =>
    broken ? failure(route) : json(route, summary()),
  )
  await page.goto(path + '&tab=quality')
  await expect(page.getByRole('heading', { name: 'Не удалось загрузить риски' })).toBeVisible()
  await expect(page.getByRole('tabpanel')).toContainText('80 %')
  broken = false
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Не удалось загрузить риски' })).toHaveCount(0)
  await page.route('**/api/v1/risks/precision**', (route) => failure(route))
  await page.getByRole('button', { name: 'Обновить аналитику' }).click()
  await expect(page.getByRole('heading', { name: 'Не удалось загрузить оценки' })).toBeVisible()
  await expect(page.getByRole('tabpanel')).toContainText('По дате действия')
  await page.screenshot({ path: `${artifact}/quality-error-Desktop.png`, fullPage: true })
})
test('аналитика: cursor append, next-page retry, dedup, invalid cursor reset и возврат', async ({
  page,
}) => {
  let mode = 'fail'
  let requests = 0
  await page.route('**/api/v1/analytics/payments**', (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor')
    requests++
    if (cursor && mode === 'fail') return failure(route)
    if (cursor && mode === 'invalid') return failure(route, 'INVALID_ARGUMENT', 400)
    return json(route, {
      period: summary().period,
      items: cursor ? payments : payments.slice(0, 1),
      nextCursor: cursor ? null : 'next-1',
    })
  })
  await page.goto(path + '&tab=payments')
  await page.getByRole('button', { name: 'Показать ещё' }).click()
  await expect(page.getByRole('tabpanel')).toContainText('Дмитрий Соколов')
  await expect(page.getByRole('alert')).toBeVisible()
  await page.screenshot({ path: `${artifact}/payments-next-error-Desktop.png`, fullPage: true })
  mode = 'invalid'
  await page.getByRole('button', { name: /Повторить/ }).click()
  await expect(page.getByRole('button', { name: 'Обновить список' })).toBeVisible()
  mode = 'ok'
  await page.getByRole('button', { name: 'Обновить список' }).click()
  await page.getByRole('button', { name: 'Показать ещё' }).click()
  await expect(page.getByRole('button', { name: 'Показать ещё' })).toHaveCount(0)
  await expect(page.locator('[data-payment-id]')).toHaveCount(3)
  const count = requests
  await page
    .getByRole('link', { name: /^Открыть риск ·/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/risks\/.+returnTo=/)
  await page.getByRole('link', { name: 'К аналитике', exact: true }).click()
  await expect(page).toHaveURL(path + '&tab=payments')
  await expect(page.locator('[data-payment-id]')).toHaveCount(3)
  expect(requests).toBe(count)
  await expect(page.locator('[data-payment-link]').first()).toBeFocused()
  await page
    .getByRole('link', { name: /Открыть (переписку|диалог)/ })
    .first()
    .click()
  await page.getByRole('link', { name: 'К аналитике', exact: true }).click()
  await expect(page).toHaveURL(path + '&tab=payments')
  await expect(page.locator('.payment-link-conversation').first()).toBeFocused()
})
test('аналитика: поздний ответ старого периода не заменяет новый, cursor сброшен', async ({
  page,
}) => {
  let release!: () => void
  const barrier = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/analytics/summary**', async (route) => {
    const u = new URL(route.request().url())
    const from = u.searchParams.get('from')!,
      to = u.searchParams.get('to')!
    const data = summary(from, to)
    if (from === '2026-10-19') {
      await barrier
      data.revenue.confirmedRecovered = '999999.00'
    }
    return json(route, data)
  })
  await page.goto(path + '&tab=payments')
  await page.getByRole('button', { name: 'Показать ещё' }).click()
  await page.getByRole('button', { name: '90 дней', exact: true }).click()
  await expect(page.getByRole('tabpanel')).toContainText('43 000')
  release()
  await expect(page.getByRole('tabpanel')).not.toContainText('999 999')
  await expect(page.locator('[data-payment-id]')).toHaveCount(1)
})
test('аналитика: manager gate не вызывает аналитические API', async ({ page }) => {
  await mockOwner(page, { role: 'MANAGER' })
  const requests: string[] = []
  page.on('request', (r) => {
    if (/\/api\/v1\/(analytics\/|risks\/precision)/.test(r.url())) requests.push(r.url())
  })
  await page.goto(path)
  await expect(page.getByText('Раздел недоступен')).toBeVisible()
  expect(requests).toEqual([])
})

test('аналитика: summary error не скрывает журнал, ошибка первой страницы не пустота', async ({
  page,
}) => {
  await page.route('**/api/v1/analytics/summary**', (route) => failure(route, 'FORBIDDEN', 403))
  await page.goto(path + '&tab=payments')
  await expect(page.getByRole('heading', { name: 'Не удалось загрузить итоги' })).toBeVisible()
  await expect(page.locator('[data-payment-id]')).toHaveCount(1)
  await page.route('**/api/v1/analytics/payments**', (route) => failure(route, 'NOT_FOUND', 404))
  await page.getByRole('button', { name: 'Обновить аналитику' }).click()
  await expect(page.getByRole('heading', { name: 'Не удалось загрузить журнал' })).toBeVisible()
  await expect(page.getByText('Подтверждённых оплат за период нет.')).toHaveCount(0)
})
test('аналитика: loading, FX-only, длинные значения и промежуточные ширины', async ({ page }) => {
  let release!: () => void
  const barrier = new Promise<void>((resolve) => {
    release = resolve
  })
  const data = summary()
  data.revenue.confirmed = '0.00'
  data.revenue.confirmedRecovered = '0.00'
  data.revenue.confirmedPayments = 0
  data.attribution = data.attribution.map((item) => ({ ...item, count: 0, amount: '0.00' }))
  data.series = data.series.map((item) => ({
    ...item,
    confirmed: '0.00',
    confirmedRecovered: '0.00',
    payments: 0,
  }))
  await page.route('**/api/v1/analytics/summary**', async (route) => {
    await barrier
    return json(route, data)
  })
  await page.route('**/api/v1/analytics/payments**', (route) =>
    json(route, {
      period: data.period,
      items: [
        {
          ...payments[0],
          amount: '9007199254740993123.47',
          currency: 'USD',
          attribution: 'UNKNOWN',
          riskId: null,
          contactDisplayName: 'Очень длинное имя клиента '.repeat(8),
          serviceName: 'Длинное название услуги '.repeat(8),
        },
      ],
      nextCursor: null,
    }),
  )
  await page.goto(path + '&tab=payments')
  await expect(page.getByRole('status', { name: 'Загрузка итогов' })).toBeVisible()
  await expect(page.locator('[data-payment-id]')).toHaveCount(1)
  await page.screenshot({ path: `${artifact}/payments-loading-Desktop.png`, fullPage: true })
  release()
  await expect(page.getByRole('status', { name: 'Загрузка итогов' })).toHaveCount(0)
  await expect(page.getByRole('tabpanel')).toContainText('9 007 199 254 740 993 123,47 USD')
  for (const width of [320, 600, 768, 1024, 1200]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    expect(
      await page.locator('.amount-group').evaluateAll((groups) =>
        groups.every((group) => {
          const range = document.createRange()
          range.selectNodeContents(group)
          return range.getClientRects().length === 1
        }),
      ),
    ).toBe(true)
    await page.screenshot({ path: `${artifact}/payments-long-${width}.png`, fullPage: true })
    for (const tab of ['Обзор', 'Риски и качество', 'Оплаты']) {
      await page.getByRole('tab', { name: tab, exact: true }).click()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
    }
  }
})
test('аналитика: смена организации игнорирует поздний ответ и сбрасывает страницы', async ({
  page,
}) => {
  const second = '01990000-0000-7000-8000-000000000002'
  const userId = '01990000-0000-7000-8000-000000000101'
  await page.addInitScript(
    ({ userId, tenant }) => {
      if (!localStorage.getItem(`lidradar.tenant.${userId}`))
        localStorage.setItem(`lidradar.tenant.${userId}`, tenant)
    },
    { userId, tenant: TENANT_ID },
  )
  await page.route('**/api/v1/auth/me', (route) =>
    json(route, {
      user: {
        id: userId,
        email: 'owner@example.test',
        displayName: 'Мария Владелец',
        status: 'ACTIVE',
        createdAt: '2026-09-01T09:00:00Z',
        updatedAt: '2026-09-01T09:00:00Z',
      },
      memberships: [
        { tenantId: TENANT_ID, organizationName: 'Блик', role: 'OWNER' },
        { tenantId: second, organizationName: 'Вторая организация', role: 'OWNER' },
      ],
    }),
  )
  await page.route('**/api/v1/organization', (route) =>
    json(route, {
      id: route.request().headers()['x-tenant-id'],
      name: 'Организация',
      defaultTimezone: 'Europe/Moscow',
      defaultCurrency: 'RUB',
      status: 'ACTIVE',
      createdAt: '2026-09-01T09:00:00Z',
      updatedAt: '2026-09-01T09:00:00Z',
    }),
  )
  let release!: () => void
  const barrier = new Promise<void>((resolve) => {
    release = resolve
  })
  let oldStarted!: () => void
  const started = new Promise<void>((resolve) => {
    oldStarted = resolve
  })
  await page.route('**/api/v1/analytics/summary**', async (route) => {
    const data = summary()
    if (route.request().headers()['x-tenant-id'] === TENANT_ID) {
      oldStarted()
      await barrier
      data.revenue.confirmedRecovered = '999999.00'
    } else {
      data.revenue.confirmedRecovered = '123.45'
      data.revenue.confirmed = '16123.45'
      data.revenue.confirmedPayments = 2
      data.attribution[0] = { ...data.attribution[0]!, amount: '123.45', count: 1 }
      data.series[data.series.length - 1] = {
        ...data.series.at(-1)!,
        confirmedRecovered: '123.45',
        confirmed: '16123.45',
        payments: 2,
      }
    }
    return json(route, data)
  })
  await page.route('**/api/v1/analytics/payments**', (route) => {
    if (route.request().headers()['x-tenant-id'] === TENANT_ID) return route.fallback()
    const period = summary().period
    const cursor = new URL(route.request().url()).searchParams.get('cursor')
    return json(route, {
      period,
      items: cursor ? [payments[2]] : [{ ...payments[0], amount: '123.45' }],
      nextCursor: cursor ? null : 'second-next',
    })
  })
  await page.goto(path + '&tab=payments')
  await started
  await page.getByRole('button', { name: 'Показать ещё' }).click()
  await expect(page.locator('[data-payment-id]')).toHaveCount(3)
  await page.getByLabel('Рабочее пространство', { exact: true }).selectOption(second)
  await expect(page).toHaveURL(/\/radar$/)
  await page.goto(path + '&tab=payments')
  await expect(page.getByRole('tabpanel')).toContainText('123,45')
  release()
  await expect(page.getByRole('tabpanel')).not.toContainText('999 999')
  await expect(page.locator('[data-payment-id]')).toHaveCount(1)
})
test('аналитика: HTTP400 другого кода повторяет страницу и не сбрасывает журнал', async ({
  page,
}) => {
  let mode = 'fail'
  const cursors: (string | null)[] = []
  await page.route('**/api/v1/analytics/payments**', (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor')
    cursors.push(cursor)
    if (cursor && mode === 'fail') return failure(route, 'VALIDATION_FAILED', 400)
    return json(route, {
      period: summary().period,
      items: cursor ? payments.slice(1) : payments.slice(0, 1),
      nextCursor: cursor ? null : 'next-1',
    })
  })
  await page.goto(path + '&tab=payments')
  await page.getByRole('button', { name: 'Показать ещё' }).click()
  await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Обновить список' })).toHaveCount(0)
  await expect(page.locator('[data-payment-id]')).toHaveCount(1)
  mode = 'ok'
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect(page.locator('[data-payment-id]')).toHaveCount(3)
  expect(cursors).toEqual([null, 'next-1', 'next-1'])
})
test('аналитика: 401 при refresh закрывает данные и ведёт на вход с return URL', async ({
  page,
}) => {
  await page.goto('/radar')
  await page.getByRole('link', { name: 'Аналитика', exact: true }).click()
  await page.getByRole('tab', { name: 'Оплаты', exact: true }).click()
  await expect(page.getByRole('tabpanel')).toContainText('59 000')
  await page.route('**/api/v1/analytics/summary**', (route) =>
    failure(route, 'UNAUTHENTICATED', 401),
  )
  await page.getByRole('button', { name: 'Обновить аналитику' }).click()
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page.getByRole('heading', { name: 'Вход в LidRadar' })).toBeVisible()
  await expect(page.getByRole('tabpanel')).toHaveCount(0)
  await page.goBack()
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText('59 000 ₽', { exact: true })).toHaveCount(0)
})
test('аналитика: owner стал manager перед возвратом, старый журнал недоступен', async ({
  page,
}) => {
  await page.goto(path + '&tab=payments')
  await page
    .getByRole('link', { name: /^Открыть риск ·/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/risks\//)
  await mockOwner(page, { role: 'MANAGER' })
  const analyticsRequests: string[] = []
  page.on('request', (request) => {
    if (/\/api\/v1\/(analytics\/|risks\/precision)/.test(request.url()))
      analyticsRequests.push(request.url())
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Нет ответа клиенту', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'К аналитике', exact: true })).toHaveCount(0)
  await page.goBack()
  await expect(page.getByText('Раздел недоступен')).toBeVisible()
  await expect(page.locator('[data-payment-id]')).toHaveCount(0)
  expect(analyticsRequests).toEqual([])
})
test('аналитика: недоступный риск и диалог404 сохраняют возврат в журнал', async ({ page }) => {
  await page.route(`**/api/v1/risks/${RISK_ID}`, (route) => failure(route, 'NOT_FOUND', 404))
  await page.route(`**/api/v1/conversations/${CONVERSATION_ID}`, (route) =>
    failure(route, 'NOT_FOUND', 404),
  )
  await page.goto(path + '&tab=payments')
  await page.getByRole('button', { name: 'Показать ещё' }).click()
  await expect(page.locator('[data-payment-id]')).toHaveCount(3)
  for (const selector of ['.payment-link-risk', '.payment-link-conversation']) {
    await page.locator(selector).first().click()
    if (selector.includes('conversation'))
      await expect(page.getByRole('heading', { name: 'Переписка не найдена' })).toBeVisible()
    else await expect(page.getByRole('alert')).toBeVisible()
    await page.getByRole('link', { name: 'К аналитике', exact: true }).click()
    await expect(page).toHaveURL(path + '&tab=payments')
    await expect(page.locator('[data-payment-id]')).toHaveCount(3)
    await expect(page.locator(selector).first()).toBeFocused()
  }
})
test.describe('аналитика: touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
  test('выбор дня касанием и доступ к последнему дню90 без hover', async ({ page }) => {
    await page.goto(path)
    const plot = page.getByRole('group', { name: /Возвращённая выручка по дням/ })
    await plot.scrollIntoViewIfNeeded()
    const box = (await plot.boundingBox())!
    await page.touchscreen.tap(box.x + box.width - 20, box.y + 60)
    await expect(page.getByRole('tabpanel')).toContainText('Выбран')
    await page.getByRole('button', { name: '90 дней', exact: true }).click()
    await page.getByRole('button', { name: 'Данные по дням', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Данные по дням', exact: true })
    await expect(dialog.locator('tbody tr')).toHaveCount(90)
    await dialog.getByRole('button', { name: 'К последнему дню', exact: true }).click()
    await expect(dialog.locator('tbody tr').last()).toBeInViewport()
    await page.screenshot({ path: `${artifact}/daily-touch-Mobile.png`, fullPage: false })
  })
})
for (const [device, width, height] of [
  ['Desktop', 1440, 1000],
  ['Tablet', 834, 1194],
  ['Mobile', 390, 844],
] as const) {
  test(`аналитика: визуальные loading/error/busy/focus ${device}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    let mode: 'loading' | 'success' | 'busy' | 'error' = 'loading'
    let releaseInitial!: () => void, releaseBusy!: () => void
    const initial = new Promise<void>((resolve) => {
      releaseInitial = resolve
    })
    const busy = new Promise<void>((resolve) => {
      releaseBusy = resolve
    })
    const gate = async (route: Route) => {
      if (mode === 'loading') await initial
      else if (mode === 'busy') await busy
      if (mode === 'error') {
        await failure(route)
        return false
      }
      return true
    }
    for (const endpoint of ['analytics/summary', 'analytics/payments', 'risks/precision']) {
      await page.route(`**/api/v1/${endpoint}**`, async (route) => {
        if (await gate(route)) return route.fallback()
      })
    }
    const capture = async (name: string) => {
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: `${artifact}/${name}-${device}.png`, fullPage: true })
      await page.screenshot({ path: `${artifact}/${name}-${device}-viewport.png`, fullPage: false })
    }
    await page.goto(path)
    for (const [id, label] of [
      ['overview', 'Обзор'],
      ['quality', 'Риски и качество'],
      ['payments', 'Оплаты'],
    ]) {
      await page.getByRole('tab', { name: label, exact: true }).click()
      await expect(page.getByRole('tabpanel').getByRole('status').first()).toBeVisible()
      await capture(`${id}-loading`)
    }
    mode = 'success'
    releaseInitial()
    await expect(page.locator('[data-payment-id]')).toHaveCount(1)
    mode = 'busy'
    await page.getByRole('button', { name: 'Показать ещё', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Загружаем…', exact: true })).toHaveAttribute(
      'aria-busy',
      'true',
    )
    await page.getByRole('button', { name: 'Загружаем…', exact: true }).scrollIntoViewIfNeeded()
    await capture('payments-busy')
    mode = 'success'
    releaseBusy()
    await expect(page.locator('[data-payment-id]')).toHaveCount(3)
    mode = 'error'
    await page.getByRole('button', { name: 'Обновить аналитику', exact: true }).click()
    for (const [id, label] of [
      ['overview', 'Обзор'],
      ['quality', 'Риски и качество'],
      ['payments', 'Оплаты'],
    ]) {
      await page.getByRole('tab', { name: label, exact: true }).click()
      const retry = page.getByRole('button', { name: 'Повторить', exact: true }).first()
      await expect(retry).toBeVisible()
      await retry.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await capture(`${id}-error-focus`)
    }
  })
}
