/**
 * Мок песочницы стейджа (ADR 0066) поверх `mockOwner`: `/auth/me` с признаком `sandbox`, каталог шаблонов и
 * переписки в памяти. Собранная переписка сначала «обрабатывается», после первого опроса — «совпала».
 */
import type { Page, Route } from '@playwright/test'

export const SANDBOX_CONVERSATION_ID = '01990000-0000-7000-8066-000000000001'
const LOCATION_ID = '01990000-0000-7000-8000-000000000201'

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

const templates = [
  {
    code: 'customer_silent_after_price',
    name: 'Назвали цену, клиент замолчал',
    expectedRiskType: 'CUSTOMER_SILENT_AFTER_PRICE',
    closedBy: 'INCOMING',
    messages: [
      {
        direction: 'INCOMING',
        text: 'Добрый день! Сколько стоит окрашивание?',
        pauseBeforeMinutes: 0,
      },
      {
        direction: 'OUTGOING',
        text: 'Окрашивание — 8 000 ₽. Когда вам удобно?',
        pauseBeforeMinutes: 10,
      },
    ],
    tailMinutes: 7200,
    version: 1,
    qualified: true,
  },
  {
    code: 'no_response',
    name: 'Спросили цену, бизнес не ответил',
    expectedRiskType: 'NO_RESPONSE',
    closedBy: 'OUTGOING',
    messages: [{ direction: 'INCOMING', text: 'Сколько стоит стрижка?', pauseBeforeMinutes: 0 }],
    tailMinutes: 1440,
    version: 1,
    qualified: false,
  },
  {
    code: 'empty',
    name: 'Пустая переписка',
    expectedRiskType: null,
    closedBy: null,
    messages: [],
    tailMinutes: 0,
    version: 1,
    qualified: true,
  },
]

export interface SandboxMockOptions {
  /** Первая сборка получает этот отказ (например, `SANDBOX_BUSY`). */
  failCreate?: { status: number; code: string }
}

export async function mockSandbox(
  page: Page,
  options: SandboxMockOptions = {},
): Promise<{ created: unknown[] }> {
  const created: unknown[] = []
  let conversation: Record<string, unknown> | null = null
  let reads = 0
  let failure = options.failCreate

  const verdict = (state: string) => ({
    state,
    stage: state === 'PROCESSING' ? 'ANALYZING' : null,
    expectedRiskType: 'CUSTOMER_SILENT_AFTER_PRICE',
    expectedRiskId: state === 'MATCH' ? '01990000-0000-7000-8000-000000000301' : null,
    dueAt: null,
    failureCode: null,
    conversationId: '01990000-0000-7000-8000-000000000601',
    analysisVersion: state === 'MATCH' ? 'lidradar-main-v1/analyze-conversation.v2/v9' : null,
    found:
      state === 'MATCH'
        ? [
            {
              id: '01990000-0000-7000-8000-000000000301',
              type: 'CUSTOMER_SILENT_AFTER_PRICE',
              status: 'OPEN',
              severity: 'MEDIUM',
              detectedAt: '2026-10-25T09:00:00Z',
              resolvedAt: null,
              active: true,
            },
          ]
        : [],
  })
  const current = () => ({ ...conversation!, status: verdict(reads > 0 ? 'MATCH' : 'PROCESSING') })

  await page.route('**/api/v1/auth/me', (route) =>
    json(route, 200, {
      user: {
        id: '01990000-0000-7000-8000-000000000101',
        email: 'owner@example.test',
        displayName: 'Мария Владелец',
        status: 'ACTIVE',
        createdAt: '2026-09-01T09:00:00Z',
        updatedAt: '2026-09-01T09:00:00Z',
      },
      memberships: [
        {
          tenantId: '01990000-0000-7000-8000-000000000001',
          organizationName: 'Студия «Блик»',
          role: 'MANAGER',
        },
      ],
      canCreateOrganization: false,
      sandbox: true,
    }),
  )
  await page.route('**/api/v1/sandbox', (route) =>
    json(route, 200, {
      enabled: true,
      limits: { conversationsPerDay: 20, messagesPerDay: 200, aiQueueLimit: 3 },
      usage: { conversations: created.length, messages: 0 },
      rules: { maxMessagesPerBuild: 30, maxHistoryMinutes: 10080, maxTextLength: 4000 },
    }),
  )
  await page.route('**/api/v1/sandbox/templates', (route) => json(route, 200, { items: templates }))
  await page.route('**/api/v1/sandbox/conversations', async (route) => {
    if (route.request().method() === 'GET')
      return json(route, 200, { items: conversation ? [current()] : [] })
    if (failure) {
      const { status, code } = failure
      failure = undefined
      return json(route, status, { error: { code, message: code, traceId: 'trace-sandbox' } })
    }
    const body = route.request().postDataJSON() as {
      messages: { direction: string; text: string }[]
      contactName?: string
      templateCode: string
    }
    created.push(body)
    conversation = {
      id: SANDBOX_CONVERSATION_ID,
      locationId: LOCATION_ID,
      connectionId: '01990000-0000-7000-8066-000000000301',
      contactName: body.contactName ?? 'Анна Петрова',
      templateCode: body.templateCode,
      templateVersion: 1,
      expectedRiskType: 'CUSTOMER_SILENT_AFTER_PRICE',
      createdAt: new Date().toISOString(),
      lastSentAt: new Date().toISOString(),
      messages: body.messages.map((message, index) => ({
        id: `01990000-0000-7000-8066-0000000004${String(index).padStart(2, '0')}`,
        sequence: index + 1,
        direction: message.direction,
        text: message.text,
        sentAt: new Date(Date.now() - (body.messages.length - index) * 600_000).toISOString(),
      })),
    }
    return json(route, 201, current())
  })
  await page.route('**/api/v1/sandbox/conversations/*', (route) => {
    if (!conversation)
      return json(route, 404, { error: { code: 'NOT_FOUND', message: '', traceId: 't' } })
    reads += 1
    return json(route, 200, current())
  })
  return { created }
}
