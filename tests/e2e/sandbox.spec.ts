import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockOwner, TENANT_ID, RISK_ID, CONVERSATION_ID } from './fixtures/api'

const locationId = '01990000-0000-7000-8000-000000000201'
const sandboxId = '01990000-0000-7000-8000-000000000901'
const overview = {
  enabled: true,
  limits: { conversationsPerDay: 20, messagesPerDay: 200, aiQueueLimit: 3 },
  usage: { conversations: 0, messages: 0 },
  rules: { maxMessagesPerBuild: 30, maxHistoryMinutes: 10080, maxTextLength: 4000 },
}
const template = {
  code: 'no_response',
  name: 'Спросили цену, бизнес не ответил',
  qualified: true,
  expectedRiskType: 'NO_RESPONSE',
  closedBy: 'OUTGOING',
  version: 1,
  tailMinutes: 1440,
  messages: [
    {
      direction: 'INCOMING',
      text: 'Здравствуйте! Сколько стоит полировка?',
      pauseBeforeMinutes: 0,
    },
  ],
}
async function setup(
  page: Page,
  options: {
    enabled?: boolean
    failFirst?: boolean
    processing?: boolean
    pending?: boolean
    failFirstSend?: boolean
    limitFirstSend?: boolean
    role?: string
  } = {},
) {
  await mockOwner(page)
  await page.unroute('**/api/v1/auth/me')
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      json: {
        user: {
          id: '01990000-0000-7000-8000-000000000101',
          email: 'sandbox@example.test',
          displayName: 'Мария Владелец',
          status: 'ACTIVE',
        },
        memberships: [
          { tenantId: TENANT_ID, organizationName: 'Студия «Блик»', role: options.role ?? 'OWNER' },
        ],
        ...(options.enabled === false ? {} : { sandbox: true }),
      },
    }),
  )
  await page.route('**/api/v1/locations', (route) =>
    route.fulfill({
      json: { items: [{ id: locationId, name: 'Студия на Тверской', active: true }] },
    }),
  )
  const calls: { key: string | undefined; body: unknown }[] = []
  let items: Record<string, unknown>[] = []
  let detailReads = 0
  let sendRequests = 0
  await page.route('**/api/v1/sandbox**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'POST') {
      const body = request.postDataJSON()
      calls.push({ key: request.headers()['idempotency-key'], body })
      if (options.failFirst && calls.length === 1) {
        await route.abort('failed')
        return
      }
      if (path.endsWith('/messages')) {
        if (options.limitFirstSend && sendRequests++ === 0) {
          await route.fulfill({
            status: 429,
            json: { error: { code: 'SANDBOX_LIMIT', message: 'Daily limit reached' } },
          })
          return
        }
        if (options.failFirstSend && sendRequests++ === 0) {
          await route.abort('failed')
          return
        }
        const item = items[0]!
        item.messages = [
          ...(item.messages as object[]),
          { ...body, id: crypto.randomUUID(), sequence: 2, sentAt: '2026-10-31T10:00:00Z' },
        ]
        if (options.limitFirstSend) item.status = { ...(item.status as object), state: 'CLOSED' }
        await route.fulfill({ json: item })
        return
      }
      const item = {
        id: sandboxId,
        locationId,
        connectionId: locationId,
        contactName: body.contactName || 'Виртуальный клиент',
        templateCode: body.templateCode,
        templateVersion: 1,
        templateModified: false,
        expectedRiskType: 'NO_RESPONSE',
        createdAt: '2026-10-31T10:00:00Z',
        lastSentAt: '2026-10-30T10:00:00Z',
        messages: body.messages.map((m: object, index: number) => ({
          ...m,
          id: crypto.randomUUID(),
          sequence: index,
          sentAt: '2026-10-30T10:00:00Z',
        })),
        status: {
          state: 'MATCH',
          stage: null,
          expectedRiskType: 'NO_RESPONSE',
          expectedRiskId: RISK_ID,
          dueAt: null,
          failureCode: null,
          failureMessageId: null,
          conversationId: CONVERSATION_ID,
          analysisVersion: null,
          found: [
            {
              id: RISK_ID,
              type: 'NO_RESPONSE',
              status: 'OPEN',
              severity: 'HIGH',
              detectedAt: '2026-10-31T10:00:00Z',
              resolvedAt: null,
              active: true,
            },
          ],
        },
      }
      if (options.processing) {
        item.status.state = 'PROCESSING'
        item.status.stage = 'ANALYZING' as never
        item.status.found = []
      }
      if (options.pending) {
        item.status.state = 'PENDING'
        item.status.found = []
      }
      items = [item]
      await route.fulfill({ status: 201, json: item })
      return
    }
    if (path.includes('/conversations/')) {
      const item = items[0]!
      if ((options.processing || options.pending) && ++detailReads > 1)
        item.status = { ...(item.status as object), state: 'MATCH', stage: null }
      await route.fulfill({ json: item })
      return
    }
    await route.fulfill({
      json: path.endsWith('/templates')
        ? {
            items: [
              template,
              {
                ...template,
                code: 'empty',
                name: 'Пустая переписка',
                messages: [],
                expectedRiskType: null,
                tailMinutes: 0,
              },
              {
                ...template,
                code: 'unfinished_agreement',
                qualified: false,
                name: 'Не прошёл квалификацию',
              },
            ],
          }
        : path.endsWith('/conversations')
          ? { items }
          : overview,
    })
  })
  return calls
}
async function draft(page: Page) {
  await page.goto('/sandbox')
  await page.getByRole('combobox', { name: /^Точка/ }).selectOption(locationId)
  await page.getByLabel('Имя клиента', { exact: true }).fill('Анна Петрова')
  await page.getByLabel('Шаблон переписки', { exact: true }).selectOption('no_response')
}
for (const width of [1440, 834, 390, 320]) {
  test(`песочница ${width}: шаблон, черновик, отправка, результат и продолжение`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 834 ? 1194 : 1000 })
    const calls = await setup(page, { role: 'MANAGER' })
    await draft(page)
    await expect(page.getByRole('option', { name: 'Не прошёл квалификацию' })).toHaveCount(0)
    await page.getByLabel('Сообщение', { exact: true }).fill('Добрый день!')
    await page.getByLabel('Сообщение', { exact: true }).press('Enter')
    expect(calls).toHaveLength(0)
    await page.getByRole('button', { name: 'От бизнеса', exact: true }).click()
    await expect(
      page.getByRole('list', { name: 'Сообщения переписки' }).getByRole('listitem'),
    ).toHaveCount(2)
    await page.reload()
    await expect(page.getByLabel('Имя клиента', { exact: true })).toHaveValue('Анна Петрова')
    await expect(
      page.getByRole('list', { name: 'Сообщения переписки' }).getByRole('listitem'),
    ).toHaveCount(2)
    await page.getByRole('button', { name: 'Удалить сообщение 2', exact: true }).click()
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    await page.screenshot({
      path: testInfo.outputPath(`sandbox-draft-${width}.png`),
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Отправить в систему', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Совпало с ожиданием' })).toBeVisible()
    expect(calls).toHaveLength(1)
    expect(calls[0]!.key).toBeTruthy()
    await expect(page.getByRole('link', { name: 'Открыть в «Диалогах»' })).toHaveAttribute(
      'href',
      `/conversations/${CONVERSATION_ID}`,
    )
    await page.getByLabel('Сообщение', { exact: true }).fill('Спасибо!')
    await page.getByRole('button', { name: 'От клиента', exact: true }).click()
    await expect(
      page.getByRole('list', { name: 'Сообщения переписки' }).getByRole('listitem'),
    ).toHaveCount(2)
    expect(calls).toHaveLength(2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    await page.screenshot({
      path: testInfo.outputPath(`sandbox-result-${width}.png`),
      fullPage: true,
    })
  })
}
test('без sandbox capability нет меню и запросов API, прямой адрес недоступен', async ({
  page,
}) => {
  await setup(page, { enabled: false })
  const requests: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/sandbox')) requests.push(r.url())
  })
  await page.goto('/sandbox')
  await expect(page.getByText('Песочница недоступна', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Песочница', exact: true })).toHaveCount(0)
  expect(requests).toEqual([])
})
test('неизвестный результат переживает reload, повтор использует прежние ключ и тело', async ({
  page,
}) => {
  const calls = await setup(page, { failFirst: true })
  await draft(page)
  await page.getByRole('button', { name: 'Отправить в систему', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Повторить отправку', exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Повторить отправку', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Совпало с ожиданием' })).toBeVisible()
  expect(calls).toHaveLength(2)
  expect(calls[1]).toEqual(calls[0])
})

test('PROCESSING опрашивает detail каждые 3 секунды и показывает MATCH', async ({ page }) => {
  // Этот сценарий проверяет polling interval. Завершённый SSE mock вызывает отдельный
  // разрешённый RECONNECTED resync и дополнительный detail GET; reconnect покрыт отдельно.
  await page.addInitScript(() => {
    const networkFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : null
      const url = new URL(request?.url ?? String(input), location.origin)
      if (url.pathname !== '/api/v1/events') return networkFetch(input, init)
      const signal = init?.signal ?? request?.signal
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(': connected\n\n'))
            signal?.addEventListener(
              'abort',
              () => {
                controller.close()
              },
              { once: true },
            )
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } },
      )
    }
  })
  await page.clock.install({ time: new Date('2026-10-31T10:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-31T10:00:01Z'))
  await setup(page, { processing: true })
  const detailTimes: number[] = []
  page.on('request', (request) => {
    if (request.method() === 'GET' && request.url().endsWith(`/sandbox/conversations/${sandboxId}`))
      detailTimes.push(Date.now())
  })
  await draft(page)
  await page.getByRole('button', { name: 'Отправить в систему', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Обработка' })).toBeVisible()
  await expect.poll(() => detailTimes.length).toBe(1)
  await page.clock.runFor(2999)
  expect(detailTimes).toHaveLength(1)
  await page.clock.runFor(1)
  await expect(page.getByRole('status').filter({ hasText: 'Совпало с ожиданием' })).toBeVisible()
  expect(detailTimes).toHaveLength(2)
})

test('потеря ответа сообщения: reload и повтор сохраняют key/body', async ({ page }) => {
  const calls = await setup(page, { failFirstSend: true })
  await draft(page)
  await page.getByRole('button', { name: 'Отправить в систему', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Совпало с ожиданием' })).toBeVisible()
  await page.getByLabel('Сообщение', { exact: true }).fill('Ответ клиента')
  await page.getByRole('button', { name: 'От клиента', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Повторить сообщение', exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /Анна Петрова Совпало с ожиданием/ }).click()
  await page.getByRole('button', { name: 'Повторить сообщение', exact: true }).click()
  await expect(
    page.getByRole('list', { name: 'Сообщения переписки' }).getByRole('listitem'),
  ).toHaveCount(2)
  expect(calls).toHaveLength(3)
  expect(calls[2]).toEqual(calls[1])
})

test('отказ 429 сохраняет сообщение, явный повтор показывает CLOSED', async ({ page }) => {
  const calls = await setup(page, { limitFirstSend: true })
  await draft(page)
  await page.getByRole('button', { name: 'Отправить в систему', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Совпало с ожиданием' })).toBeVisible()
  const field = page.getByLabel('Сообщение', { exact: true })
  await field.fill('Я согласна')
  await page.getByRole('button', { name: 'От клиента', exact: true }).click()
  await expect(page.getByText('Исчерпан суточный лимит песочницы. Повторите позже.')).toBeVisible()
  await expect(field).toHaveValue('Я согласна')
  await expect(
    page.getByRole('list', { name: 'Сообщения переписки' }).getByRole('listitem'),
  ).toHaveCount(1)
  expect(calls).toHaveLength(2)
  await page.getByRole('button', { name: 'От клиента', exact: true }).click()
  await expect(field).toHaveValue('')
  await expect(page.getByRole('status').filter({ hasText: 'Риск закрыт' })).toBeVisible()
  await expect(
    page.getByRole('list', { name: 'Сообщения переписки' }).getByRole('listitem'),
  ).toHaveCount(2)
  expect(calls).toHaveLength(3)
  expect(calls[2]!.body).toEqual(calls[1]!.body)
})

test('PENDING обновляется до MATCH через общий safety refetch без reload', async ({ page }) => {
  // Держим SSE открытым: переход должен произойти по safety timer, без RECONNECTED resync.
  await page.addInitScript(() => {
    const networkFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : null
      const url = new URL(request?.url ?? String(input), location.origin)
      if (url.pathname !== '/api/v1/events') return networkFetch(input, init)
      const signal = init?.signal ?? request?.signal
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(': connected\n\n'))
            signal?.addEventListener('abort', () => controller.close(), { once: true })
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } },
      )
    }
  })
  await page.clock.install({ time: new Date('2026-10-31T10:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-31T10:00:01Z'))
  await setup(page, { pending: true })
  await draft(page)
  await page.getByRole('button', { name: 'Отправить в систему', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Риск ещё не наступил' })).toBeVisible()
  await page.clock.runFor(15_000)
  await expect(page.getByRole('status').filter({ hasText: 'Совпало с ожиданием' })).toBeVisible()
})
