/**
 * Мок API для браузерных тестов.
 *
 * Тесты не зависят от backend: ответы перехватываются на уровне Playwright и
 * повторяют контракт `contracts/openapi.yaml`. Так проверяются маршрутизация,
 * доступность и состояния интерфейса без учебного стенда и его пароля.
 */
import type { Page, Route } from '@playwright/test'

export const TENANT_ID = '01990000-0000-7000-8000-000000000001'
export const RISK_ID = '01990000-0000-7000-8000-000000000301'
export const OPPORTUNITY_ID = '01990000-0000-7000-8000-000000000401'
export const CONVERSATION_ID = '01990000-0000-7000-8000-000000000601'

const user = {
  id: '01990000-0000-7000-8000-000000000101',
  email: 'owner@example.test',
  displayName: 'Мария Владелец',
  status: 'ACTIVE',
  createdAt: '2026-09-01T09:00:00Z',
  updatedAt: '2026-09-01T09:00:00Z',
}

const membership = { tenantId: TENANT_ID, organizationName: 'Студия «Блик»', role: 'OWNER' }

const organization = {
  id: TENANT_ID,
  name: 'Студия «Блик»',
  defaultTimezone: 'Europe/Moscow',
  defaultCurrency: 'RUB',
  status: 'ACTIVE',
  createdAt: '2026-09-01T09:00:00Z',
  updatedAt: '2026-09-01T09:00:00Z',
}

const locations = {
  items: [{ id: '01990000-0000-7000-8000-000000000201', name: 'Студия на Тверской' }],
}

const summary = {
  openRisks: 2,
  criticalRisks: 1,
  potentialRevenue: '47000.00',
  confirmedRecoveredRevenue: '12000.00',
}

const riskDetail = {
  risk: {
    id: RISK_ID,
    opportunityId: OPPORTUNITY_ID,
    locationId: '01990000-0000-7000-8000-000000000201',
    type: 'NO_RESPONSE',
    severity: 'CRITICAL',
    status: 'OPEN',
    source: 'MANUAL',
    policyVersion: 'e2e/v1',
    triggerMessageId: null,
    reasonCode: 'NO_RESPONSE_THRESHOLD_EXCEEDED',
    reason: 'Бизнес не ответил клиенту в течение 60 рабочих минут',
    detectedAt: '2026-09-18T10:00:00Z',
    dueAt: '2026-09-18T09:00:00Z',
    updatedAt: '2026-09-18T10:00:00Z',
  },
  opportunity: {
    id: OPPORTUNITY_ID,
    stage: 'NEW',
    locationId: '01990000-0000-7000-8000-000000000201',
    serviceId: '01990000-0000-7000-8000-000000000501',
    potentialRevenue: '31000.00',
    currency: 'RUB',
  },
  conversation: {
    id: CONVERSATION_ID,
    contactId: '01990000-0000-7000-8000-000000000701',
    lastMessage: {
      id: '01990000-0000-7000-8000-000000000801',
      direction: 'INCOMING',
      type: 'TEXT',
      preview: 'Здравствуйте! Сколько стоит полировка кузова?',
      sentAt: '2026-09-18T09:00:00Z',
    },
  },
  contact: { id: '01990000-0000-7000-8000-000000000701', displayName: 'Дмитрий Соколов' },
  service: { id: '01990000-0000-7000-8000-000000000501', name: 'Полировка кузова', active: true },
  channel: {
    connectionId: '01990000-0000-7000-8000-000000000901',
    provider: 'CONNECTED_BUSINESS_BOT',
    name: 'Telegram Business',
    status: 'ACTIVE',
  },
  externalLink: { url: null, kind: null, unavailableReason: 'PROVIDER_UNSUPPORTED' },
  recommendation: null,
  actions: [],
  outcome: null,
  revenue: null,
}

const recommendationText = 'Ответьте клиенту и назовите цену.'

function json(route: Route, status: number, body: unknown, headers: Record<string, string> = {}) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'X-Request-ID': 'e2e-request', ...headers },
    body: JSON.stringify(body),
  })
}

function errorBody(code: string, message = '') {
  return { error: { code, message, traceId: 'e2e-trace' } }
}

/** Гость: `/auth/me` отвечает 401, вход отклоняет любые реквизиты. */
export async function mockGuest(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/me', (route) => json(route, 401, errorBody('UNAUTHENTICATED')))
  await page.route('**/api/v1/auth/login', (route) =>
    json(route, 401, errorBody('INVALID_CREDENTIALS')),
  )
}

interface TelegramLinkState {
  linked: boolean
  linkedAt: string | null
  tokenIssued: boolean
}

const telegramLinks = new WeakMap<Page, TelegramLinkState>()

/**
 * Имитирует подтверждение бота пользователем: следующая проверка статуса
 * вернёт `linked: true`. Требует выпущенной ссылки — как и настоящий сервер.
 */
export function confirmTelegramLink(page: Page): void {
  const state = telegramLinks.get(page)
  if (!state?.tokenIssued) throw new Error('ссылка привязки ещё не выпущена')
  state.linked = true
  state.linkedAt = new Date().toISOString()
}

/** Действующий код приглашения (43 символа base64url) и уже использованный. */
export const INVITATION_CODE = 'e2e-invitation-code-'.padEnd(43, 'x')
export const USED_INVITATION_CODE = 'e2e-used-invitation-'.padEnd(43, 'y')

const opportunityStates = new WeakMap<
  Page,
  { moveStage: (stage: string, source: string) => void }
>()

/** Сервер перевёл сделку без участия интерфейса — так проверяется конфликт `409`. */
export function setOpportunityStage(page: Page, stage: string): void {
  const controls = opportunityStates.get(page)
  if (!controls) throw new Error('моки владельца не установлены')
  controls.moveStage(stage, 'AI')
}

interface TeamControls {
  /** Код ошибки для следующей команды над участником — имитация гонки. */
  failNextMemberCommand: string | null
  /** Следующая admin-команда восстановления ответит `409`: объект уже изменился. */
  failNextAdminCommand: boolean
}

const teamControls = new WeakMap<Page, TeamControls>()

/** Следующая смена роли или отзыв ответит `409` с этим кодом, как при гонке. */
export function failNextMemberCommand(page: Page, code: 'LAST_OWNER' | 'MEMBER_DISABLED'): void {
  const controls = teamControls.get(page)
  if (!controls) throw new Error('моки владельца не установлены')
  controls.failNextMemberCommand = code
}

/** Следующая команда восстановления администратора ответит `409 CONFLICT`. */
export function failNextAdminCommand(page: Page): void {
  const controls = teamControls.get(page)
  if (!controls) throw new Error('моки владельца не установлены')
  controls.failNextAdminCommand = true
}

/** Идентификаторы мёртвых объектов admin-моков. */
export const ADMIN_IDS = {
  deadJob: '01990000-0000-7000-8000-00000000a001',
  liveJob: '01990000-0000-7000-8000-00000000a002',
  deadEvent: '01990000-0000-7000-8000-00000000b001',
  deadAIJob: '01990000-0000-7000-8000-00000000c001',
  deadDelivery: '01990000-0000-7000-8000-00000000d001',
  message: '01990000-0000-7000-8000-000000000801',
  otherAdmin: '01990000-0000-7000-8000-000000000102',
}

/**
 * Владелец одной организации с двумя активными рисками на Radar. Первый риск
 * хранит состояние между запросами: команды меняют статус, добавляют действия
 * и исход, поэтому повторное чтение карточки отражает результат.
 */
export interface OwnerMockOptions {
  /**
   * Поток сигналов: `event` — один сигнал по первому риску и закрытие потока;
   * `unavailable` — `503 UNAVAILABLE`; `silent` — поток без событий.
   */
  events?: 'event' | 'unavailable' | 'silent'
  /** Роль в организации: менеджеру доступны только личные разделы. */
  role?: 'OWNER' | 'MANAGER'
  /**
   * Новый сотрудник: `/auth/me` без членств, пока код приглашения не принят;
   * после `POST /invitations/accept` организация появляется в членствах.
   */
  joinByInvitation?: boolean
  /** Пользователь — администратор платформы: `/admin/me` отвечает `true`, admin API замокан. */
  platformAdmin?: boolean
}

export async function mockOwner(page: Page, options: OwnerMockOptions = {}): Promise<void> {
  const state = {
    status: 'OPEN',
    acknowledgedAt: null as string | null,
    actedAt: null as string | null,
    resolvedAt: null as string | null,
    actions: [] as { id: string; type: string; createdAt: string }[],
    outcome: null as { id: string; type: string; createdAt: string } | null,
    recommendation: null as { id: string; text: string } | null,
    revenue: null as { currency: string; potential: string; confirmedRecovered: string } | null,
    recoveredAttributed: false,
    stage: riskDetail.opportunity.stage as string,
    stageHistory: [
      {
        id: '01990000-0000-7000-8000-000000001101',
        opportunityId: OPPORTUNITY_ID,
        fromStage: null as string | null,
        toStage: riskDetail.opportunity.stage as string,
        source: 'RULE',
        confidence: null as number | null,
        aiRunId: null as string | null,
        actorUserId: null as string | null,
        createdAt: '2026-09-18T09:00:00Z',
      },
    ],
  }
  const moveStage = (stage: string, source: string) => {
    state.stageHistory.push({
      id: nextId(),
      opportunityId: OPPORTUNITY_ID,
      fromStage: state.stage,
      toStage: stage,
      source,
      confidence: null,
      aiRunId: null,
      actorUserId: source === 'USER' ? user.id : null,
      createdAt: new Date().toISOString(),
    })
    state.stage = stage
  }
  opportunityStates.set(page, { moveStage })
  let sequence = 0
  const nextId = () => `01990000-0000-7000-8000-0000000009${String(++sequence).padStart(2, '0')}`

  const currentRisk = () => ({
    ...riskDetail.risk,
    status: state.status,
    ...(state.acknowledgedAt ? { acknowledgedAt: state.acknowledgedAt } : {}),
    ...(state.actedAt ? { actedAt: state.actedAt } : {}),
    ...(state.resolvedAt ? { resolvedAt: state.resolvedAt } : {}),
  })
  const currentDetail = () => ({
    ...riskDetail,
    risk: currentRisk(),
    opportunity: {
      ...riskDetail.opportunity,
      stage: state.stage,
    },
    actions: state.actions,
    outcome: state.outcome,
    recommendation: state.recommendation,
    revenue: state.revenue,
  })
  const second = () => ({
    ...riskDetail,
    risk: { ...riskDetail.risk, id: '01990000-0000-7000-8000-000000000302', severity: 'HIGH' },
  })

  const join = { required: options.joinByInvitation === true, accepted: false }
  await page.route('**/api/v1/auth/me', (route) =>
    json(route, 200, {
      user,
      memberships:
        join.required && !join.accepted ? [] : [{ ...membership, role: options.role ?? 'OWNER' }],
    }),
  )
  await page.route('**/api/v1/auth/logout', (route) => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/organization', (route) => json(route, 200, organization))
  await page.route('**/api/v1/locations', (route) => json(route, 200, locations))
  await page.route('**/api/v1/radar**', (route) => json(route, 200, summary))
  await page.route('**/api/v1/risks**', (route) => {
    const url = new URL(route.request().url())
    const items =
      url.searchParams.get('severity') === 'CRITICAL'
        ? [currentDetail()]
        : [currentDetail(), second()]
    return json(route, 200, { items, nextCursor: null })
  })

  // Маршруты карточки регистрируются позже общего: Playwright проверяет их первыми.
  await page.route(`**/api/v1/risks/${RISK_ID}`, (route) => json(route, 200, currentDetail()))
  await page.route(`**/api/v1/risks/${RISK_ID}/acknowledge`, (route) => {
    if (state.status === 'OPEN') {
      state.status = 'ACKNOWLEDGED'
      state.acknowledgedAt = new Date().toISOString()
    }
    return json(route, 200, currentRisk())
  })
  await page.route(`**/api/v1/risks/${RISK_ID}/resolve`, (route) => {
    state.status = 'RESOLVED'
    state.resolvedAt = new Date().toISOString()
    return json(route, 200, currentRisk())
  })
  await page.route(`**/api/v1/risks/${RISK_ID}/recommendation`, (route) => {
    state.recommendation ??= { id: nextId(), text: recommendationText }
    return json(route, 200, {
      ...state.recommendation,
      riskId: RISK_ID,
      source: 'TEMPLATE',
      createdAt: new Date().toISOString(),
    })
  })
  await page.route(`**/api/v1/risks/${RISK_ID}/actions`, (route) => {
    const key = route.request().headers()['idempotency-key']
    if (!key) return json(route, 400, errorBody('INVALID_ARGUMENT', 'Idempotency-Key required'))
    const body = route.request().postDataJSON() as { type: string; note?: string }
    const action = { id: nextId(), type: body.type, createdAt: new Date().toISOString() }
    state.actions.push(action)
    state.status = 'ACTED'
    state.actedAt ??= action.createdAt
    state.acknowledgedAt ??= action.createdAt
    return json(route, 201, {
      ...action,
      riskId: RISK_ID,
      actorId: user.id,
      ...(body.note ? { note: body.note } : {}),
    })
  })
  const ACTIVE = [
    'NEW',
    'ENGAGED',
    'QUALIFYING',
    'PRICE_SENT',
    'WAITING_CUSTOMER',
    'WAITING_BUSINESS',
    'BOOKING_INTENT',
    'BOOKED',
  ]
  const allowedStages = (from: string): string[] => {
    if (from === 'BOOKED') return ['WON', 'LOST']
    if (from === 'WON' || from === 'LOST') return ['ARCHIVED']
    const index = ACTIVE.indexOf(from)
    return index === -1 ? [] : [...ACTIVE.slice(index + 1), 'LOST']
  }
  const opportunityBody = () => ({
    id: OPPORTUNITY_ID,
    conversationId: CONVERSATION_ID,
    serviceId: riskDetail.opportunity.serviceId,
    stage: state.stage,
    estimatedAmount: riskDetail.opportunity.potentialRevenue,
    estimatedAmountConfidence: 0.8,
    currency: riskDetail.opportunity.currency,
    openedAt: '2026-09-18T09:00:00Z',
    closedAt: ['WON', 'LOST', 'ARCHIVED'].includes(state.stage) ? new Date().toISOString() : null,
    createdAt: '2026-09-18T09:00:00Z',
    updatedAt: new Date().toISOString(),
  })
  await page.route(`**/api/v1/opportunities/${OPPORTUNITY_ID}`, (route) => {
    if (route.request().method() === 'PATCH') {
      const { stage } = route.request().postDataJSON() as { stage: string }
      if (stage === state.stage) return json(route, 200, opportunityBody())
      if (!allowedStages(state.stage).includes(stage)) {
        return json(route, 409, errorBody('INVALID_STAGE_TRANSITION'))
      }
      moveStage(stage, 'USER')
      return json(route, 200, opportunityBody())
    }
    return json(route, 200, { opportunity: opportunityBody(), stageHistory: state.stageHistory })
  })
  await page.route(`**/api/v1/opportunities/${OPPORTUNITY_ID}/outcomes`, (route) => {
    const key = route.request().headers()['idempotency-key']
    if (!key) return json(route, 400, errorBody('INVALID_ARGUMENT', 'Idempotency-Key required'))
    const body = route.request().postDataJSON() as { status: string; note?: string }
    const outcome = { id: nextId(), type: body.status, createdAt: new Date().toISOString() }
    state.outcome = outcome
    return json(route, 201, {
      id: outcome.id,
      opportunityId: OPPORTUNITY_ID,
      actorId: user.id,
      status: body.status,
      createdAt: outcome.createdAt,
      ...(body.note ? { note: body.note } : {}),
    })
  })
  await page.route(`**/api/v1/opportunities/${OPPORTUNITY_ID}/revenue`, (route) => {
    const key = route.request().headers()['idempotency-key']
    if (!key) return json(route, 400, errorBody('INVALID_ARGUMENT', 'Idempotency-Key required'))
    const body = route.request().postDataJSON() as {
      amount: string
      currency: string
      attributionType: string
      riskId?: string
      actionId?: string
      outcomeId?: string
    }
    if (body.attributionType === 'RECOVERED') {
      if (state.recoveredAttributed)
        return json(route, 409, errorBody('RECOVERED_ALREADY_ATTRIBUTED'))
      if (!body.riskId || !body.actionId || !body.outcomeId) {
        return json(route, 400, errorBody('INVALID_ARGUMENT', 'evidence chain required'))
      }
      state.recoveredAttributed = true
    }
    const previous = state.revenue?.confirmedRecovered ?? '0.00'
    const recovered =
      body.attributionType === 'RECOVERED'
        ? (Number(previous) + Number(body.amount)).toFixed(2)
        : previous
    state.revenue = {
      currency: body.currency,
      potential: riskDetail.opportunity.potentialRevenue,
      confirmedRecovered: recovered,
    }
    const now = new Date().toISOString()
    const revenueId = nextId()
    return json(route, 201, {
      revenue: {
        id: revenueId,
        opportunityId: OPPORTUNITY_ID,
        amount: body.amount,
        currency: body.currency,
        status: 'CONFIRMED',
        source: 'USER_CONFIRMED',
        confirmedBy: user.id,
        confirmedAt: now,
      },
      attribution: {
        id: nextId(),
        revenueEventId: revenueId,
        opportunityId: OPPORTUNITY_ID,
        type: body.attributionType,
        ...(body.riskId ? { riskId: body.riskId } : {}),
        ...(body.actionId ? { actionId: body.actionId } : {}),
        ...(body.outcomeId ? { outcomeId: body.outcomeId } : {}),
        createdAt: now,
      },
    })
  })
  await page.route(`**/api/v1/risks/${RISK_ID}/feedback`, (route) => {
    const body = route.request().postDataJSON() as {
      verdict: string
      reason?: string
      note?: string
    }
    if (body.verdict === 'FALSE_POSITIVE' && !body.reason) {
      return json(route, 400, errorBody('INVALID_ARGUMENT', 'reason required'))
    }
    const now = new Date().toISOString()
    const active = ['OPEN', 'ACKNOWLEDGED', 'ACTED'].includes(state.status)
    if (body.verdict === 'FALSE_POSITIVE' && active) {
      state.status = 'FALSE_POSITIVE'
      state.resolvedAt = now
    }
    if (body.reason === 'NOT_A_LEAD' && state.stage !== 'LOST') moveStage('LOST', 'RULE')
    return json(route, 201, {
      id: nextId(),
      riskId: RISK_ID,
      opportunityId: OPPORTUNITY_ID,
      actorId: user.id,
      verdict: body.verdict,
      ...(body.reason ? { reason: body.reason } : {}),
      note: body.note ?? '',
      context: {
        type: riskDetail.risk.type,
        severity: riskDetail.risk.severity,
        status: state.status,
        source: riskDetail.risk.source,
        policyVersion: riskDetail.risk.policyVersion,
        triggerMessageId: riskDetail.risk.triggerMessageId,
        opportunityStage: state.stage,
        detectedAt: riskDetail.risk.detectedAt,
      },
      datasetEligible: false,
      createdAt: now,
    })
  })
  // Поток сигналов. Playwright не держит соединение открытым: тело отдаётся
  // целиком и поток завершается, клиент переподключается с backoff.
  let eventStreams = 0
  await page.route('**/api/v1/events', (route) => {
    eventStreams += 1
    const mode = options.events ?? 'silent'
    if (mode === 'unavailable') return json(route, 503, errorBody('UNAVAILABLE'))
    const body =
      mode === 'event' && eventStreams === 1
        ? `: connected\n\nevent: risk.acknowledged\ndata: {"resourceId":"${RISK_ID}"}\n\n`
        : ': connected\n\n'
    return route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body,
    })
  })
  // Диалоги: три переписки, поиск и «с риском» фильтруются как на сервере.
  const conversations = [
    {
      conversation: {
        id: CONVERSATION_ID,
        locationId: '01990000-0000-7000-8000-000000000201',
        connectionId: riskDetail.channel.connectionId,
        contactId: riskDetail.contact.id,
        externalId: 'tg-1',
        status: 'ACTIVE',
        firstMessageAt: '2026-09-18T08:00:00Z',
        lastMessageAt: '2026-09-18T10:02:00Z',
        lastMessageDirection: 'INCOMING',
        revision: 3,
        createdAt: '2026-09-18T08:00:00Z',
        updatedAt: '2026-09-18T10:02:00Z',
      },
      contact: riskDetail.contact,
      channel: riskDetail.channel,
      lastMessage: {
        id: '01990000-0000-7000-8000-000000000803',
        direction: 'INCOMING',
        type: 'TEXT',
        preview: 'А на какое время можно завтра?',
        sentAt: '2026-09-18T10:02:00Z',
      },
      activeRisks: { count: 1, maxSeverity: 'CRITICAL' },
      externalLink: { url: 'tg://user?id=123', kind: 'TELEGRAM_USER', unavailableReason: null },
    },
    {
      conversation: {
        id: '01990000-0000-7000-8000-000000000602',
        locationId: '01990000-0000-7000-8000-000000000201',
        connectionId: riskDetail.channel.connectionId,
        contactId: '01990000-0000-7000-8000-000000000702',
        externalId: 'tg-2',
        status: 'ACTIVE',
        firstMessageAt: '2026-09-17T08:00:00Z',
        lastMessageAt: '2026-09-17T12:44:00Z',
        lastMessageDirection: 'OUTGOING',
        revision: 1,
        createdAt: '2026-09-17T08:00:00Z',
        updatedAt: '2026-09-17T12:44:00Z',
      },
      contact: { id: '01990000-0000-7000-8000-000000000702', displayName: 'Елена Волкова' },
      channel: riskDetail.channel,
      lastMessage: {
        id: '01990000-0000-7000-8000-000000000813',
        direction: 'OUTGOING',
        type: 'TEXT',
        preview: 'Спасибо, ждём вас завтра',
        sentAt: '2026-09-17T12:44:00Z',
      },
      activeRisks: { count: 0, maxSeverity: null },
      externalLink: { url: null, kind: null, unavailableReason: 'IDENTITY_UNKNOWN' },
    },
    {
      conversation: {
        id: '01990000-0000-7000-8000-000000000603',
        locationId: null,
        connectionId: riskDetail.channel.connectionId,
        contactId: '01990000-0000-7000-8000-000000000703',
        externalId: 'tg-3',
        status: 'ACTIVE',
        firstMessageAt: '2026-09-16T08:00:00Z',
        lastMessageAt: '2026-09-16T10:32:00Z',
        lastMessageDirection: 'INCOMING',
        revision: 1,
        createdAt: '2026-09-16T08:00:00Z',
        updatedAt: '2026-09-16T10:32:00Z',
      },
      contact: { id: '01990000-0000-7000-8000-000000000703', displayName: null },
      channel: riskDetail.channel,
      lastMessage: {
        id: '01990000-0000-7000-8000-000000000823',
        direction: 'INCOMING',
        type: 'VOICE',
        preview: null,
        sentAt: '2026-09-16T10:32:00Z',
      },
      activeRisks: { count: 0, maxSeverity: null },
      externalLink: { url: null, kind: null, unavailableReason: 'PROVIDER_UNSUPPORTED' },
    },
  ]
  const messageBase = {
    conversationId: CONVERSATION_ID,
    connectionId: riskDetail.channel.connectionId,
    senderExternalId: null,
    replyToMessageId: null,
    metadata: {},
  }
  const newestMessages = [
    {
      message: {
        ...messageBase,
        id: '01990000-0000-7000-8000-000000000803',
        externalId: 'e-3',
        direction: 'INCOMING',
        type: 'TEXT',
        text: 'А на какое время можно завтра?',
        sentAt: '2026-09-18T10:02:00Z',
        receivedAt: '2026-09-18T10:02:00Z',
        providerDeletedAt: null,
        createdAt: '2026-09-18T10:02:00Z',
      },
      attachments: [],
    },
    {
      message: {
        ...messageBase,
        id: '01990000-0000-7000-8000-000000000802',
        externalId: 'e-2',
        direction: 'OUTGOING',
        type: 'TEXT',
        text: 'Полный комплекс — 31 000 ₽. На завтра есть несколько окон.',
        sentAt: '2026-09-18T10:00:00Z',
        receivedAt: '2026-09-18T10:00:00Z',
        providerDeletedAt: null,
        createdAt: '2026-09-18T10:00:00Z',
      },
      attachments: [],
    },
    {
      message: {
        ...messageBase,
        id: '01990000-0000-7000-8000-000000000801',
        externalId: 'e-1',
        direction: 'INCOMING',
        type: 'IMAGE',
        text: null,
        sentAt: '2026-09-18T09:56:00Z',
        receivedAt: '2026-09-18T09:56:00Z',
        providerDeletedAt: null,
        createdAt: '2026-09-18T09:56:00Z',
      },
      attachments: [
        {
          id: '01990000-0000-7000-8000-000000000a11',
          messageId: '01990000-0000-7000-8000-000000000801',
          objectKey: 'missing/object',
          mimeType: 'image/jpeg',
          sizeBytes: 245760,
          sha256: null,
          providerFileId: null,
          createdAt: '2026-09-18T09:56:00Z',
        },
      ],
    },
  ]
  const olderMessages = [
    {
      message: {
        ...messageBase,
        id: '01990000-0000-7000-8000-000000000800',
        externalId: 'e-0',
        direction: 'OUTGOING',
        type: 'TEXT',
        text: 'Удалённый текст',
        sentAt: '2026-09-17T15:00:00Z',
        receivedAt: '2026-09-17T15:00:00Z',
        providerDeletedAt: '2026-09-17T15:30:00Z',
        createdAt: '2026-09-17T15:00:00Z',
      },
      attachments: [],
    },
  ]
  await page.route('**/api/v1/conversations**', (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path.endsWith('/messages')) {
      const older = url.searchParams.get('cursor') === 'older'
      return json(route, 200, {
        items: older ? olderMessages : newestMessages,
        nextCursor: older ? null : 'older',
      })
    }
    const match = /\/api\/v1\/conversations\/([0-9a-f-]{36})$/.exec(path)
    if (match) {
      const found = conversations.find((item) => item.conversation.id === match[1])
      if (!found) return json(route, 404, errorBody('NOT_FOUND'))
      return json(route, 200, {
        conversation: found.conversation,
        contact: {
          ...found.contact,
          phoneNormalized: '+79991234567',
          emailNormalized: null,
          createdAt: found.conversation.createdAt,
          updatedAt: found.conversation.updatedAt,
        },
        channel: found.channel,
        externalLink: found.externalLink,
      })
    }
    const search = (url.searchParams.get('search') ?? '').toLowerCase()
    const withRisk = url.searchParams.get('withRisk') === 'true'
    const items = conversations.filter((item) => {
      if (withRisk && item.activeRisks.count === 0) return false
      if (search && !(item.contact.displayName ?? '').toLowerCase().includes(search)) return false
      return true
    })
    return json(route, 200, { items, nextCursor: null })
  })
  // Настройки и онбординг: организация, точки, график и услуги с состоянием.
  const setup = {
    organization: { ...organization },
    locations: [
      {
        id: '01990000-0000-7000-8000-000000000201',
        name: 'Студия на Тверской',
        timezone: 'Europe/Moscow',
        responseThresholdMinutes: 45,
        active: true,
        businessHours: [] as {
          weekday: number
          closed: boolean
          opensAt?: string
          closesAt?: string
        }[],
        createdAt: '2026-09-01T09:00:00Z',
        updatedAt: '2026-09-01T09:00:00Z',
      },
    ],
    services: [
      {
        id: '01990000-0000-7000-8000-000000000501',
        locationId: null as string | null,
        name: 'Полировка кузова',
        normalizedName: 'полировка кузова',
        priceFrom: '31000.00' as string | null,
        priceTo: '31000.00' as string | null,
        currency: 'RUB',
        active: true,
        createdAt: '2026-09-01T09:00:00Z',
        updatedAt: '2026-09-01T09:00:00Z',
      },
    ],
  }
  const connections: {
    id: string
    locationId: string | null
    provider: string
    name: string
    status: string
    capabilities: string[]
    lastEventAt: string | null
    lastSuccessAt: string | null
    lastErrorAt: string | null
    lastErrorCode: string | null
    createdAt: string
    updatedAt: string
  }[] = []
  /**
   * Личная привязка Telegram. Статус меняется только по явному сигналу теста
   * (`confirmTelegramLink`): фоновые перечитывания и автопроверка не должны
   * «подтверждать» бота сами по себе.
   */
  const telegramLink: TelegramLinkState = { linked: false, linkedAt: null, tokenIssued: false }
  telegramLinks.set(page, telegramLink)
  const onboardingStatus = () => {
    const withSchedule = setup.locations.filter(
      (item) => item.active && item.businessHours.length === 7,
    ).length
    const activeServices = setup.services.filter((item) => item.active).length
    const locationDone = setup.locations.some((item) => item.active)
    const live = connections.filter((item) => item.status !== 'DISCONNECTED').length
    const nextStep = !locationDone
      ? 'LOCATION'
      : activeServices === 0
        ? 'SERVICES'
        : live === 0
          ? 'CHANNEL'
          : 'TELEGRAM_LINK'
    return {
      complete: live > 0 && locationDone && activeServices > 0,
      nextStep,
      steps: [
        { key: 'ORGANIZATION', required: true, done: true },
        { key: 'LOCATION', required: true, done: locationDone },
        { key: 'SERVICES', required: true, done: activeServices > 0 },
        { key: 'CHANNEL', required: true, done: live > 0 },
        { key: 'TELEGRAM_LINK', required: false, done: telegramLink.linked },
      ],
      facts: {
        activeLocations: setup.locations.filter((item) => item.active).length,
        locationsWithSchedule: withSchedule,
        activeServices,
        connections: connections.length,
        liveConnections: live,
        telegramLinked: telegramLink.linked,
      },
      computedAt: new Date().toISOString(),
    }
  }
  await page.route('**/api/v1/organization/onboarding', (route) =>
    json(route, 200, onboardingStatus()),
  )
  await page.route('**/api/v1/organization', (route) => {
    if (route.request().method() === 'PATCH') {
      const patch = route.request().postDataJSON() as Partial<typeof organization>
      setup.organization = { ...setup.organization, ...patch, updatedAt: new Date().toISOString() }
    }
    return json(route, 200, setup.organization)
  })
  await page.route('**/api/v1/locations', (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as {
        name: string
        timezone: string
        responseThresholdMinutes?: number
      }
      const created = {
        id: nextId(),
        name: body.name,
        timezone: body.timezone,
        responseThresholdMinutes: body.responseThresholdMinutes ?? 45,
        active: true,
        businessHours: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setup.locations.push(created)
      return json(route, 201, created)
    }
    return json(route, 200, { items: setup.locations })
  })
  await page.route(/\/api\/v1\/locations\/([0-9a-f-]{36})(\/business-hours)?$/, (route) => {
    const url = new URL(route.request().url())
    const match = /\/locations\/([0-9a-f-]{36})/.exec(url.pathname)
    const target = setup.locations.find((item) => item.id === match?.[1])
    if (!target) return json(route, 404, errorBody('NOT_FOUND'))
    const method = route.request().method()
    if (method === 'PUT') {
      const body = route.request().postDataJSON() as { days: typeof target.businessHours }
      target.businessHours = body.days
    } else if (method === 'PATCH') {
      Object.assign(target, route.request().postDataJSON() as object)
    }
    target.updatedAt = new Date().toISOString()
    return json(route, 200, target)
  })
  await page.route('**/api/v1/services**', (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const match = /\/api\/v1\/services\/([0-9a-f-]{36})$/.exec(url.pathname)
    if (match) {
      const target = setup.services.find((item) => item.id === match[1])
      if (!target) return json(route, 404, errorBody('NOT_FOUND'))
      if (method === 'DELETE') {
        target.active = false
        return route.fulfill({ status: 204 })
      }
      Object.assign(target, route.request().postDataJSON() as object)
      target.updatedAt = new Date().toISOString()
      return json(route, 200, target)
    }
    if (method === 'POST') {
      const body = route.request().postDataJSON() as {
        name: string
        locationId?: string | null
        priceFrom?: string | null
        priceTo?: string | null
        currency?: string
      }
      const created = {
        id: nextId(),
        locationId: body.locationId ?? null,
        name: body.name,
        normalizedName: body.name.toLowerCase(),
        priceFrom: body.priceFrom ?? null,
        priceTo: body.priceTo ?? null,
        currency: body.currency ?? 'RUB',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setup.services.push(created)
      return json(route, 201, created)
    }
    return json(route, 200, { items: setup.services })
  })
  // Интеграции: список, подключение (Telegram — ACTIVE, webhook — секрет один раз),
  // отключение, здоровье и живая проверка.
  const healthOf = (item: (typeof connections)[number]) => ({
    status: item.status,
    lastEventAt: item.lastEventAt,
    lastSuccessAt: item.lastSuccessAt,
    lastErrorAt: item.lastErrorAt,
    lastErrorCode: item.lastErrorCode,
    checkedAt: new Date().toISOString(),
  })
  await page.route('**/api/v1/integrations**', (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const method = route.request().method()
    const connect = /\/api\/v1\/integrations\/([A-Z_]+)\/connect$/.exec(path)
    if (connect && method === 'POST') {
      const body = route.request().postDataJSON() as {
        name: string
        locationId?: string | null
        webhookSecret?: string
      }
      const provider = connect[1]!
      const now = new Date().toISOString()
      const created = {
        id: nextId(),
        locationId: body.locationId ?? null,
        provider,
        name: body.name,
        status: 'ACTIVE',
        capabilities: ['CAN_RECEIVE_MESSAGES', 'CAN_IDENTIFY_CONTACT'],
        lastEventAt: null,
        lastSuccessAt: now,
        lastErrorAt: null,
        lastErrorCode: null,
        createdAt: now,
        updatedAt: now,
      }
      connections.push(created)
      const webhookSecret =
        provider === 'GENERIC_WEBHOOK' && !body.webhookSecret
          ? 'e2e-issued-secret-0123456789abcdef'
          : null
      return json(route, 201, { ...created, webhookSecret })
    }
    const single = /\/api\/v1\/integrations\/([0-9a-f-]{36})(\/health(\/check)?)?$/.exec(path)
    if (single) {
      const target = connections.find((item) => item.id === single[1])
      if (!target) return json(route, 404, errorBody('NOT_FOUND'))
      if (single[3]) {
        target.lastSuccessAt = new Date().toISOString()
        return json(route, 200, {
          health: healthOf(target),
          verification: target.provider === 'CONNECTED_BUSINESS_BOT' ? 'REMOTE' : 'LOCAL',
        })
      }
      if (single[2]) return json(route, 200, healthOf(target))
      if (method === 'DELETE') {
        target.status = 'DISCONNECTED'
        target.updatedAt = new Date().toISOString()
        return route.fulfill({ status: 204 })
      }
    }
    return json(route, 200, { items: connections })
  })

  const defaultPreference = (riskType: string) => ({
    riskType,
    minimumSeverity: 'MEDIUM',
    deliveryMode: 'IMMEDIATE',
    inAppEnabled: true,
    telegramEnabled: false,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    digestTime: '09:00',
    timezone: 'Europe/Moscow',
    isDefault: true,
  })
  const preferences = new Map(
    [
      'NO_RESPONSE',
      'BOOKING_NOT_CONFIRMED',
      'PROMISE_NOT_FULFILLED',
      'CUSTOMER_SILENT_AFTER_PRICE',
      'FOLLOW_UP_CANDIDATE',
    ].map((riskType) => [riskType, defaultPreference(riskType)] as const),
  )
  await page.route('**/api/v1/notifications/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (path.endsWith('/telegram-link-token') && method === 'POST') {
      telegramLink.tokenIssued = true
      return json(route, 201, {
        startUrl: 'https://t.me/lidradar_e2e_bot?start=e2e-one-time-token',
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      })
    }
    if (path.endsWith('/telegram-link')) {
      if (method === 'DELETE') {
        telegramLink.linked = false
        telegramLink.linkedAt = null
        telegramLink.tokenIssued = false
        return route.fulfill({ status: 204 })
      }
      return json(route, 200, {
        linked: telegramLink.linked,
        ...(telegramLink.linkedAt ? { linkedAt: telegramLink.linkedAt } : {}),
      })
    }
    const single = /\/api\/v1\/notifications\/preferences\/([A-Z_]+)$/.exec(path)
    if (single) {
      const riskType = single[1]!
      const current = preferences.get(riskType)
      if (!current) return json(route, 404, errorBody('NOT_FOUND'))
      if (method === 'PUT') {
        const body = route.request().postDataJSON() as Record<string, unknown>
        const required = [
          'minimumSeverity',
          'deliveryMode',
          'inAppEnabled',
          'telegramEnabled',
          'quietHoursEnabled',
          'digestTime',
        ]
        if (required.some((key) => !(key in body))) {
          return json(route, 400, errorBody('VALIDATION_FAILED'))
        }
        const saved = {
          ...defaultPreference(riskType),
          ...body,
          quietHoursStart: (body.quietHoursStart as string | null | undefined) ?? null,
          quietHoursEnd: (body.quietHoursEnd as string | null | undefined) ?? null,
          isDefault: false,
          updatedAt: new Date().toISOString(),
        }
        preferences.set(riskType, saved as ReturnType<typeof defaultPreference>)
        return json(route, 200, saved)
      }
      if (method === 'DELETE') {
        preferences.set(riskType, defaultPreference(riskType))
        return route.fulfill({ status: 204 })
      }
    }
    return json(route, 200, { items: [...preferences.values()] })
  })

  const controls: TeamControls = { failNextMemberCommand: null, failNextAdminCommand: false }
  teamControls.set(page, controls)
  const team = {
    members: [
      {
        membershipId: '01990000-0000-7000-8000-000000001001',
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        role: options.role ?? 'OWNER',
        status: 'ACTIVE',
        revokedAt: null as string | null,
        createdAt: '2026-09-01T09:00:00Z',
        updatedAt: '2026-09-01T09:00:00Z',
      },
      {
        membershipId: '01990000-0000-7000-8000-000000001002',
        userId: '01990000-0000-7000-8000-000000000102',
        email: 'manager@example.test',
        displayName: 'Анна Смирнова',
        role: 'MANAGER',
        status: 'ACTIVE',
        revokedAt: null as string | null,
        createdAt: '2026-09-05T09:00:00Z',
        updatedAt: '2026-09-05T09:00:00Z',
      },
      {
        membershipId: '01990000-0000-7000-8000-000000001003',
        userId: '01990000-0000-7000-8000-000000000103',
        // Длинные значения проверяют устойчивость раскладки на узких экранах.
        email:
          'very.long.address.for.narrow.layout.checks@example-organization-with-long-name.test',
        displayName: 'Пётр Бывший-Длиннофамильный',
        role: 'MANAGER',
        status: 'DISABLED',
        revokedAt: '2026-09-10T12:00:00Z' as string | null,
        createdAt: '2026-09-02T09:00:00Z',
        updatedAt: '2026-09-10T12:00:00Z',
      },
    ],
    invitations: [] as {
      id: string
      role: string
      note: string | null
      status: string
      createdBy: string
      createdAt: string
      expiresAt: string
      acceptedAt: string | null
      acceptedBy: string | null
      revokedAt: string | null
      revokedBy: string | null
    }[],
  }
  const activeOwners = () =>
    team.members.filter((item) => item.status === 'ACTIVE' && item.role === 'OWNER').length
  await page.route('**/api/v1/organization/members**', (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    const single = /\/api\/v1\/organization\/members\/([0-9a-f-]{36})$/.exec(path)
    if (single) {
      const target = team.members.find((item) => item.userId === single[1])
      if (!target) return json(route, 404, errorBody('NOT_FOUND'))
      if (controls.failNextMemberCommand) {
        const code = controls.failNextMemberCommand
        controls.failNextMemberCommand = null
        return json(route, 409, errorBody(code))
      }
      const lastOwner =
        target.status === 'ACTIVE' && target.role === 'OWNER' && activeOwners() === 1
      if (method === 'PATCH') {
        if (target.status !== 'ACTIVE') return json(route, 409, errorBody('MEMBER_DISABLED'))
        const { role } = route.request().postDataJSON() as { role: string }
        if (lastOwner && role !== 'OWNER') return json(route, 409, errorBody('LAST_OWNER'))
        target.role = role
        target.updatedAt = new Date().toISOString()
        return json(route, 200, {
          id: target.membershipId,
          tenantId: TENANT_ID,
          userId: target.userId,
          role: target.role,
          status: target.status,
          createdAt: target.createdAt,
          updatedAt: target.updatedAt,
        })
      }
      if (method === 'DELETE') {
        if (target.status === 'DISABLED') return route.fulfill({ status: 204 })
        if (lastOwner) return json(route, 409, errorBody('LAST_OWNER'))
        target.status = 'DISABLED'
        target.revokedAt = new Date().toISOString()
        target.updatedAt = target.revokedAt
        return route.fulfill({ status: 204 })
      }
    }
    return json(route, 200, { items: team.members })
  })
  await page.route('**/api/v1/organization/invitations**', (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    const single = /\/api\/v1\/organization\/invitations\/([0-9a-f-]{36})$/.exec(path)
    if (single && method === 'DELETE') {
      const target = team.invitations.find((item) => item.id === single[1])
      if (!target) return json(route, 404, errorBody('NOT_FOUND'))
      if (target.status === 'ACCEPTED') return json(route, 409, errorBody('INVITATION_USED'))
      if (target.status === 'PENDING') {
        target.status = 'REVOKED'
        target.revokedAt = new Date().toISOString()
        target.revokedBy = user.id
      }
      return route.fulfill({ status: 204 })
    }
    if (method === 'POST') {
      const body = route.request().postDataJSON() as { role: string; note?: string | null }
      const now = Date.now()
      const created = {
        id: nextId(),
        role: body.role,
        note: body.note ?? null,
        status: 'PENDING',
        createdBy: user.id,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 7 * 24 * 60 * 60_000).toISOString(),
        acceptedAt: null,
        acceptedBy: null,
        revokedAt: null,
        revokedBy: null,
      }
      team.invitations.push(created)
      return json(route, 201, { invitation: created, code: INVITATION_CODE })
    }
    return json(route, 200, { items: team.invitations })
  })
  await page.route('**/api/v1/invitations/accept', (route) => {
    const { code } = route.request().postDataJSON() as { code: string }
    if (code === USED_INVITATION_CODE) return json(route, 409, errorBody('INVITATION_USED'))
    if (code !== INVITATION_CODE) return json(route, 404, errorBody('NOT_FOUND'))
    if (join.accepted || !join.required) return json(route, 409, errorBody('ALREADY_MEMBER'))
    join.accepted = true
    return json(route, 200, {
      membership: { ...membership, role: options.role ?? 'OWNER' },
    })
  })

  // Аналитика: ряд строится по каждой дате запрошенного окна, нули на месте.
  const calendarDays = (from: string, to: string): string[] => {
    const days: string[] = []
    const start = Date.UTC(
      Number(from.slice(0, 4)),
      Number(from.slice(5, 7)) - 1,
      Number(from.slice(8, 10)),
    )
    const end = Date.UTC(
      Number(to.slice(0, 4)),
      Number(to.slice(5, 7)) - 1,
      Number(to.slice(8, 10)),
    )
    for (let time = start; time <= end; time += 86_400_000) {
      days.push(new Date(time).toISOString().slice(0, 10))
    }
    return days
  }
  const analyticsPeriod = (from: string, to: string) => {
    const nextDay = new Date(
      Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)) + 1),
    )
      .toISOString()
      .slice(0, 10)
    return {
      fromDate: from,
      toDate: to,
      timezone: 'Europe/Moscow',
      from: `${from}T00:00:00+03:00`,
      to: `${nextDay}T00:00:00+03:00`,
    }
  }
  const analyticsWindow = (route: Route): { from: string; to: string } | null => {
    const url = new URL(route.request().url())
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    if (!from || !to || from > to) return null
    if (calendarDays(from, to).length > 366) return null
    return { from, to }
  }
  await page.route('**/api/v1/analytics/summary**', (route) => {
    const window = analyticsWindow(route)
    if (!window) return json(route, 400, errorBody('VALIDATION_FAILED'))
    const days = calendarDays(window.from, window.to)
    const last = days.length - 1
    const series = days.map((date, index) => {
      const recovered = index === last - 1 ? '31000.00' : index === last - 4 ? '12000.00' : '0.00'
      const organic = index === last ? '16000.00' : '0.00'
      const confirmed = (Number(recovered) + Number(organic)).toFixed(2)
      return {
        date,
        incoming: (index % 3) + 1,
        outgoing: index % 2,
        risksDetected: index % 4 === 0 ? 1 : 0,
        confirmed,
        confirmedRecovered: recovered,
        payments: (recovered !== '0.00' ? 1 : 0) + (organic !== '0.00' ? 1 : 0),
      }
    })
    return json(route, 200, {
      period: analyticsPeriod(window.from, window.to),
      messages: { total: 40, incoming: 25, outgoing: 15, conversations: 6 },
      opportunities: { created: 8, booked: 3, won: 2, lost: 1 },
      risks: {
        detected: 24,
        acted: 18,
        resolved: 11,
        falsePositive: 2,
        byType: [
          { riskType: 'NO_RESPONSE', detected: 10, acted: 8, resolved: 5, falsePositive: 1 },
          {
            riskType: 'BOOKING_NOT_CONFIRMED',
            detected: 6,
            acted: 4,
            resolved: 3,
            falsePositive: 0,
          },
          {
            riskType: 'PROMISE_NOT_FULFILLED',
            detected: 4,
            acted: 3,
            resolved: 2,
            falsePositive: 1,
          },
          {
            riskType: 'CUSTOMER_SILENT_AFTER_PRICE',
            detected: 3,
            acted: 2,
            resolved: 1,
            falsePositive: 0,
          },
          { riskType: 'FOLLOW_UP_CANDIDATE', detected: 1, acted: 1, resolved: 0, falsePositive: 0 },
        ],
      },
      outcomes: { booked: 3, paid: 2, lost: 1 },
      revenue: {
        currency: 'RUB',
        potential: '47000.00',
        confirmed: '59000.00',
        confirmedRecovered: '43000.00',
        confirmedPayments: 3,
      },
      series,
      attribution: [
        { type: 'RECOVERED', amount: '43000.00', count: 2 },
        { type: 'ORGANIC', amount: '16000.00', count: 1 },
        { type: 'UNKNOWN', amount: '0.00', count: 0 },
      ],
    })
  })
  const paymentRows = [
    {
      eventId: '01990000-0000-7000-8000-000000002001',
      opportunityId: OPPORTUNITY_ID,
      conversationId: CONVERSATION_ID,
      contactId: '01990000-0000-7000-8000-000000000701',
      contactDisplayName: 'Дмитрий Соколов',
      serviceName: 'Полировка кузова',
      amount: '31000.00',
      currency: 'RUB',
      attribution: 'RECOVERED',
      riskId: RISK_ID,
      confirmedBy: user.id,
      confirmedAt: '2026-09-23T12:00:00Z',
    },
    {
      eventId: '01990000-0000-7000-8000-000000002002',
      opportunityId: '01990000-0000-7000-8000-000000000402',
      conversationId: '01990000-0000-7000-8000-000000000602',
      contactId: '01990000-0000-7000-8000-000000000702',
      contactDisplayName: 'Ольга Кузнецова',
      serviceName: 'Химчистка салона',
      amount: '16000.00',
      currency: 'RUB',
      attribution: 'ORGANIC',
      riskId: null,
      confirmedBy: user.id,
      confirmedAt: '2026-09-22T09:30:00Z',
    },
  ]
  await page.route('**/api/v1/analytics/payments**', (route) => {
    const window = analyticsWindow(route)
    if (!window) return json(route, 400, errorBody('VALIDATION_FAILED'))
    const cursor = new URL(route.request().url()).searchParams.get('cursor')
    const period = analyticsPeriod(window.from, window.to)
    if (cursor === 'page-2')
      return json(route, 200, { period, items: [paymentRows[1]], nextCursor: null })
    return json(route, 200, { period, items: [paymentRows[0]], nextCursor: 'page-2' })
  })
  await page.route('**/api/v1/risks/precision**', (route) => {
    const url = new URL(route.request().url())
    const from = url.searchParams.get('from') ?? '2026-08-25T21:00:00Z'
    const to = url.searchParams.get('to') ?? '2026-09-24T21:00:00Z'
    const item = (
      riskType: string,
      totalRisks: number,
      withFeedback: number,
      tp: number,
      fp: number,
    ) => ({
      riskType,
      totalRisks,
      withFeedback,
      truePositives: tp,
      falsePositives: fp,
      precision: withFeedback > 0 ? tp / withFeedback : null,
      falsePositiveRate: withFeedback > 0 ? fp / withFeedback : null,
      coverageRate: totalRisks > 0 ? withFeedback / totalRisks : 0,
      reliable: totalRisks > 0 && withFeedback / totalRisks >= 0.3,
    })
    return json(route, 200, {
      from,
      to,
      minimumCoverage: 0.3,
      items: [
        item('NO_RESPONSE', 10, 5, 4, 1),
        item('BOOKING_NOT_CONFIRMED', 6, 0, 0, 0),
        item('PROMISE_NOT_FULFILLED', 4, 1, 1, 0),
        item('CUSTOMER_SILENT_AFTER_PRICE', 3, 2, 1, 1),
        item('FOLLOW_UP_CANDIDATE', 0, 0, 0, 0),
      ],
    })
  })

  // ML-согласие: читает любой участник, меняет владелец; команды идемпотентны.
  const consent = {
    active: false,
    record: null as null | {
      id: string
      scope: 'DATASETS'
      grantedBy: string
      grantedAt: string
      revokedBy?: string
      revokedAt?: string
    },
  }
  const consentStatus = () => ({
    scope: 'DATASETS',
    active: consent.active,
    consent: consent.record,
  })
  await page.route('**/api/v1/organization/ml-consent', (route) => {
    const method = route.request().method()
    if (method === 'GET') return json(route, 200, consentStatus())
    if ((options.role ?? 'OWNER') !== 'OWNER') return json(route, 403, errorBody('FORBIDDEN'))
    if (method === 'POST') {
      if (consent.active) return json(route, 200, consentStatus())
      consent.active = true
      consent.record = {
        id: nextId(),
        scope: 'DATASETS',
        grantedBy: user.id,
        grantedAt: new Date().toISOString(),
      }
      return json(route, 201, consentStatus())
    }
    if (method === 'DELETE') {
      if (consent.active && consent.record) {
        consent.active = false
        consent.record = {
          ...consent.record,
          revokedBy: user.id,
          revokedAt: new Date().toISOString(),
        }
      }
      return route.fulfill({ status: 204 })
    }
    return json(route, 405, errorBody('METHOD_NOT_ALLOWED'))
  })

  // Администрирование платформы. Playwright проверяет маршруты в обратном
  // порядке регистрации, поэтому общий обработчик `/admin/**` регистрируется
  // первым, а точный `/admin/me` — последним и побеждает.
  const isAdmin = options.platformAdmin === true
  const registerAdminMe = () =>
    page.route('**/api/v1/admin/me', (route) =>
      json(route, 200, { userId: user.id, platformAdmin: isAdmin }),
    )
  if (!isAdmin) {
    await page.route('**/api/v1/admin/**', (route) => json(route, 403, errorBody('FORBIDDEN')))
    await registerAdminMe()
    return
  }
  const admin = {
    admins: [
      {
        id: '01990000-0000-7000-8000-00000000e001',
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        grantedBy: null as string | null,
        grantedAt: '2026-09-01T09:00:00Z',
        note: 'первый администратор из CLI',
      } as Record<string, unknown>,
      {
        id: '01990000-0000-7000-8000-00000000e002',
        userId: ADMIN_IDS.otherAdmin,
        email: 'ops@example.test',
        displayName: 'Дежурный инженер',
        grantedBy: user.id,
        grantedAt: '2026-09-10T09:00:00Z',
        note: 'дежурство',
      } as Record<string, unknown>,
    ],
    jobs: [
      {
        id: ADMIN_IDS.deadJob,
        tenantId: TENANT_ID,
        type: 'risk.detect',
        dedupKey: 'risk.detect:1',
        status: 'DEAD',
        priority: 5,
        availableAt: '2026-09-23T10:00:00Z',
        attemptCount: 5,
        maxAttempts: 5,
        leasedBy: null,
        leaseUntil: null,
        lastErrorCode: 'DB_TIMEOUT',
        completedAt: null,
        discardedAt: null as string | null,
        createdAt: '2026-09-23T09:00:00Z',
        updatedAt: '2026-09-23T10:00:00Z',
        payload: { riskId: RISK_ID },
      },
      {
        id: ADMIN_IDS.liveJob,
        tenantId: TENANT_ID,
        type: 'notification.dispatch',
        dedupKey: 'notification.dispatch:2',
        status: 'PENDING',
        priority: 3,
        availableAt: '2026-09-24T10:00:00Z',
        attemptCount: 0,
        maxAttempts: 5,
        leasedBy: null,
        leaseUntil: null,
        lastErrorCode: null,
        completedAt: null,
        discardedAt: null as string | null,
        createdAt: '2026-09-24T09:00:00Z',
        updatedAt: '2026-09-24T09:00:00Z',
        payload: {},
      },
    ],
    outbox: [
      {
        id: ADMIN_IDS.deadEvent,
        tenantId: TENANT_ID,
        eventType: 'risk.detected',
        aggregateType: 'risk',
        aggregateId: RISK_ID,
        status: 'DEAD',
        attemptCount: 5,
        maxAttempts: 5,
        lastErrorCode: 'BROKER_DOWN',
        occurredAt: '2026-09-23T10:05:00Z',
        completedAt: null,
        discardedAt: null as string | null,
      },
    ],
    aiJobs: [
      {
        id: ADMIN_IDS.deadAIJob,
        tenantId: TENANT_ID,
        conversationId: CONVERSATION_ID,
        analysisThroughMessageId: ADMIN_IDS.message,
        status: 'DEAD',
        modelRequirement: 'qwen3-8b',
        attempts: 3,
        maxAttempts: 3,
        lastErrorCode: 'NODE_TIMEOUT',
        leasedBy: null,
        leasedAt: null,
        leaseUntil: null,
        completedAt: null,
        discardedAt: null as string | null,
        createdAt: '2026-09-23T10:10:00Z',
      },
    ],
    deliveries: [
      {
        id: ADMIN_IDS.deadDelivery,
        tenantId: TENANT_ID,
        notificationId: '01990000-0000-7000-8000-00000000f001',
        kind: 'RISK_DETECTED',
        channel: 'TELEGRAM',
        status: 'DEAD',
        attempt: 3,
        failureCode: 'TELEGRAM_FORBIDDEN',
        attemptedAt: '2026-09-23T10:20:00Z',
        discardedAt: null as string | null,
        createdAt: '2026-09-23T10:15:00Z',
      },
    ],
  }
  const deadCount = () =>
    [...admin.jobs, ...admin.outbox, ...admin.aiJobs, ...admin.deliveries].filter(
      (item) => item.status === 'DEAD' && !item.discardedAt,
    ).length
  const queueStats = () => ({
    checkedAt: new Date().toISOString(),
    jobs: {
      pending: admin.jobs.filter((j) => j.status === 'PENDING').length,
      processing: 0,
      retry: 0,
      dead: admin.jobs.filter((j) => j.status === 'DEAD' && !j.discardedAt).length,
      expiredLeases: 0,
    },
    outbox: {
      pending: 0,
      processing: 0,
      retry: 1,
      dead: admin.outbox.filter((e) => e.status === 'DEAD' && !e.discardedAt).length,
      expiredLeases: 0,
    },
    aiJobs: {
      pending: 1,
      leased: 0,
      running: 0,
      retry: 0,
      dead: admin.aiJobs.filter((j) => j.status === 'DEAD' && !j.discardedAt).length,
      nodesReady: 1,
    },
    deliveries: {
      pending: 2,
      processing: 0,
      retry: 0,
      dead: admin.deliveries.filter((d) => d.status === 'DEAD' && !d.discardedAt).length,
    },
    scheduledOverdue: 0,
    deadUnhandled: deadCount(),
  })
  const conflictOrNull = (route: Route) => {
    if (!controls.failNextAdminCommand) return null
    controls.failNextAdminCommand = false
    return json(route, 409, errorBody('CONFLICT'))
  }
  const conversationSummary = {
    tenantId: TENANT_ID,
    conversationId: CONVERSATION_ID,
    revision: 3,
    analysisThroughMessageId: ADMIN_IDS.message,
    modelVersion: 'qwen3-8b-2026-08',
    promptVersion: 'p12',
    schemaVersion: 's4',
    aiRunId: '01990000-0000-7000-8000-00000000aa01',
    updatedAt: '2026-09-23T10:30:00Z',
    facts: [
      {
        type: 'service_interest',
        value: { service: 'полировка', price: 31000 },
        confidence: 0.92,
        trusted: true,
        evidenceMessageIds: [ADMIN_IDS.message],
      },
      {
        type: 'promise',
        value: '<script>alert(1)</script>',
        confidence: 0.41,
        trusted: false,
        evidenceMessageIds: [],
      },
    ],
    trustedFacts: 1,
    weakFacts: 1,
  }
  await page.route('**/api/v1/admin/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    const url = new URL(route.request().url())
    if (path.endsWith('/admin/admins') && method === 'GET')
      return json(route, 200, { items: admin.admins })
    if (path.endsWith('/admin/admins') && method === 'POST') {
      const body = route.request().postDataJSON() as { email: string; note?: string }
      const existing = admin.admins.find((item) => item.email === body.email && !item.revokedAt)
      if (existing) return json(route, 200, existing)
      if (!body.email.endsWith('@example.test')) return json(route, 404, errorBody('NOT_FOUND'))
      const created = {
        id: nextId(),
        userId: nextId(),
        email: body.email,
        displayName: body.email.split('@')[0],
        grantedBy: user.id,
        grantedAt: new Date().toISOString(),
        note: body.note ?? '',
      }
      admin.admins.push(created)
      return json(route, 201, created)
    }
    const revokeMatch = /\/admin\/admins\/([0-9a-f-]{36})$/.exec(path)
    if (revokeMatch && method === 'DELETE') {
      const target = admin.admins.find((item) => item.userId === revokeMatch[1])
      if (target && !target.revokedAt) {
        target.revokedAt = new Date().toISOString()
        target.revokedBy = user.id
      }
      return route.fulfill({ status: 204 })
    }
    if (path.endsWith('/admin/organizations')) {
      return json(route, 200, {
        items: [
          {
            id: TENANT_ID,
            name: 'Студия «Блик»',
            timezone: 'Europe/Moscow',
            currency: 'RUB',
            status: 'ACTIVE',
            createdAt: '2026-09-01T09:00:00Z',
            members: 3,
            locations: 1,
            connections: 1,
            openRisks: 2,
            messagesLast24h: 14,
          },
          {
            id: '01990000-0000-7000-8000-000000000002',
            name: 'Сеть «Лак»',
            timezone: 'Asia/Yekaterinburg',
            currency: 'RUB',
            status: 'SUSPENDED',
            createdAt: '2026-08-15T09:00:00Z',
            members: 6,
            locations: 3,
            connections: 3,
            openRisks: 0,
            messagesLast24h: 0,
          },
        ],
      })
    }
    if (path.endsWith('/admin/connections')) {
      return json(route, 200, {
        items: [
          {
            id: '01990000-0000-7000-8000-000000000901',
            tenantId: TENANT_ID,
            tenantName: 'Студия «Блик»',
            provider: 'CONNECTED_BUSINESS_BOT',
            name: 'Telegram Business',
            status: 'ACTIVE',
            locationId: null,
            lastEventAt: '2026-09-24T08:00:00Z',
            lastSuccessAt: '2026-09-24T08:00:00Z',
            lastErrorAt: null,
            lastErrorCode: null,
            rawEventsPending: 0,
            rawEventsFailed: 0,
          },
          {
            id: '01990000-0000-7000-8000-000000000902',
            tenantId: '01990000-0000-7000-8000-000000000002',
            tenantName: 'Сеть «Лак»',
            provider: 'GENERIC_WEBHOOK',
            name: 'CRM',
            status: 'ERROR',
            locationId: null,
            lastEventAt: '2026-09-20T08:00:00Z',
            lastSuccessAt: '2026-09-19T08:00:00Z',
            lastErrorAt: '2026-09-20T08:00:00Z',
            lastErrorCode: 'INVALID_PAYLOAD',
            rawEventsPending: 4,
            rawEventsFailed: 2,
          },
        ],
      })
    }
    if (path.endsWith('/admin/queue')) return json(route, 200, queueStats())
    if (path.endsWith('/admin/jobs')) {
      const status = url.searchParams.get('status')
      const items = admin.jobs.filter((job) => !status || job.status === status)
      return json(route, 200, { items })
    }
    if (path.endsWith('/admin/dead-letters')) {
      const dead = <T extends { status: string; discardedAt: string | null }>(items: T[]) =>
        items.filter((item) => item.status === 'DEAD' && !item.discardedAt)
      return json(route, 200, {
        jobs: dead(admin.jobs),
        outbox: dead(admin.outbox),
        aiJobs: dead(admin.aiJobs),
        deliveries: dead(admin.deliveries),
      })
    }
    const jobCommand = /\/admin\/jobs\/([0-9a-f-]{36})\/(retry|discard)$/.exec(path)
    if (jobCommand && method === 'POST') {
      const target = admin.jobs.find((job) => job.id === jobCommand[1])
      if (!target) return json(route, 404, errorBody('NOT_FOUND'))
      const conflict = conflictOrNull(route)
      if (conflict) return conflict
      if (target.status !== 'DEAD' || target.discardedAt)
        return json(route, 409, errorBody('CONFLICT'))
      if (jobCommand[2] === 'retry') {
        target.status = 'PENDING'
        target.attemptCount = 0
      } else {
        target.discardedAt = new Date().toISOString()
      }
      target.updatedAt = new Date().toISOString()
      return json(route, 200, target)
    }
    const outboxCommand = /\/admin\/outbox\/([0-9a-f-]{36})\/(replay|discard)$/.exec(path)
    if (outboxCommand && method === 'POST') {
      const target = admin.outbox.find((event) => event.id === outboxCommand[1])
      if (!target) return json(route, 404, errorBody('NOT_FOUND'))
      const conflict = conflictOrNull(route)
      if (conflict) return conflict
      if (target.status !== 'DEAD' || target.discardedAt)
        return json(route, 409, errorBody('CONFLICT'))
      if (outboxCommand[2] === 'replay') {
        target.status = 'PENDING'
        target.attemptCount = 0
      } else {
        target.discardedAt = new Date().toISOString()
      }
      return json(route, 200, target)
    }
    const aiCommand = /\/admin\/ai\/jobs\/([0-9a-f-]{36})\/(retry|discard)$/.exec(path)
    if (aiCommand && method === 'POST') {
      const target = admin.aiJobs.find((job) => job.id === aiCommand[1])
      if (!target) return json(route, 404, errorBody('NOT_FOUND'))
      const conflict = conflictOrNull(route)
      if (conflict) return conflict
      if (target.status !== 'DEAD' || target.discardedAt)
        return json(route, 409, errorBody('CONFLICT'))
      if (aiCommand[2] === 'retry') {
        target.status = 'PENDING'
        target.attempts = 0
      } else {
        target.discardedAt = new Date().toISOString()
      }
      return json(route, 200, target)
    }
    const deliveryCommand = /\/admin\/notifications\/deliveries\/([0-9a-f-]{36})\/discard$/.exec(
      path,
    )
    if (deliveryCommand && method === 'POST') {
      const target = admin.deliveries.find((item) => item.id === deliveryCommand[1])
      if (!target) return json(route, 404, errorBody('NOT_FOUND'))
      const conflict = conflictOrNull(route)
      if (conflict) return conflict
      if (target.status !== 'DEAD' || target.discardedAt)
        return json(route, 409, errorBody('CONFLICT'))
      target.discardedAt = new Date().toISOString()
      return json(route, 200, target)
    }
    if (path.endsWith('/admin/ai/nodes')) {
      return json(route, 200, {
        items: [
          {
            id: '01990000-0000-7000-8000-00000000ab01',
            name: 'home-gpu-1',
            status: 'READY',
            modelVersion: 'qwen3-8b-2026-08',
            availableSlots: 2,
            inflight: 0,
            lastHeartbeatAt: new Date().toISOString(),
            revokedAt: null,
            tenants: [TENANT_ID],
            createdAt: '2026-08-01T09:00:00Z',
          },
          {
            id: '01990000-0000-7000-8000-00000000ab02',
            name: 'lab-node',
            status: 'REVOKED',
            modelVersion: null,
            availableSlots: 0,
            inflight: 0,
            lastHeartbeatAt: null,
            revokedAt: '2026-09-01T09:00:00Z',
            tenants: [],
            createdAt: '2026-07-01T09:00:00Z',
          },
        ],
      })
    }
    if (path.endsWith('/admin/ai/runs')) {
      const status = url.searchParams.get('status')
      const items = [
        {
          id: conversationSummary.aiRunId,
          tenantId: TENANT_ID,
          jobId: ADMIN_IDS.deadAIJob,
          nodeId: '01990000-0000-7000-8000-00000000ab01',
          conversationId: CONVERSATION_ID,
          status: 'SUCCEEDED',
          applicationStatus: 'APPLIED',
          modelVersion: 'qwen3-8b-2026-08',
          promptVersion: 'p12',
          schemaVersion: 's4',
          errorCode: null,
          validationError: null,
          startedAt: '2026-09-23T10:25:00Z',
          completedAt: '2026-09-23T10:30:00Z',
          durationMs: 300000,
        },
        {
          id: '01990000-0000-7000-8000-00000000aa02',
          tenantId: TENANT_ID,
          jobId: ADMIN_IDS.deadAIJob,
          nodeId: '01990000-0000-7000-8000-00000000ab01',
          conversationId: CONVERSATION_ID,
          status: 'FAILED',
          applicationStatus: 'REJECTED',
          modelVersion: 'qwen3-8b-2026-08',
          promptVersion: 'p12',
          schemaVersion: 's4',
          errorCode: 'SCHEMA_INVALID',
          validationError: 'facts[1].value: expected object',
          startedAt: '2026-09-23T09:25:00Z',
          completedAt: '2026-09-23T09:26:00Z',
          durationMs: 60000,
        },
      ].filter((run) => !status || run.status === status)
      return json(route, 200, { items })
    }
    if (/\/admin\/ai\/tenants\/[0-9a-f-]{36}\/conversations\/[0-9a-f-]{36}\/summary$/.test(path)) {
      return path.includes(CONVERSATION_ID)
        ? json(route, 200, conversationSummary)
        : json(route, 404, errorBody('NOT_FOUND'))
    }
    if (path.endsWith('/admin/usage')) {
      const from = url.searchParams.get('from') ?? '2026-08-25T00:00:00.000Z'
      const to = url.searchParams.get('to') ?? '2026-09-25T00:00:00.000Z'
      return json(route, 200, {
        from,
        to,
        tenants: [
          {
            tenantId: TENANT_ID,
            name: 'Студия «Блик»',
            messages: 144,
            rawEvents: 150,
            jobs: 320,
            aiJobs: 40,
            aiRuns: 38,
            aiRunsApplied: 30,
            aiRunsRejected: 5,
            aiRunsStale: 3,
            aiRunSeconds: 5400,
            risks: 20,
            notifications: 18,
            deliveries: 36,
          },
        ],
      })
    }
    const traceMatch = /\/admin\/trace\/tenants\/([0-9a-f-]{36})\/messages\/([0-9a-f-]{36})$/.exec(
      path,
    )
    if (traceMatch) {
      if (traceMatch[2] !== ADMIN_IDS.message) return json(route, 404, errorBody('NOT_FOUND'))
      return json(route, 200, {
        message: {
          id: ADMIN_IDS.message,
          tenantId: TENANT_ID,
          conversationId: CONVERSATION_ID,
          connectionId: '01990000-0000-7000-8000-000000000901',
          direction: 'INCOMING',
          type: 'TEXT',
          externalId: 'tg-1',
          sentAt: '2026-09-18T09:00:00Z',
          receivedAt: '2026-09-18T09:00:01Z',
        },
        jobs: [admin.jobs[0]],
        aiJobs: admin.aiJobs,
        aiRuns: [],
        semanticResult: conversationSummary,
        risks: [
          {
            id: RISK_ID,
            opportunityId: OPPORTUNITY_ID,
            type: 'NO_RESPONSE',
            severity: 'CRITICAL',
            status: 'OPEN',
            source: 'MANUAL',
            policyVersion: 'e2e/v1',
            aiRunId: null,
            detectedAt: '2026-09-18T10:00:00Z',
            resolvedAt: null,
          },
        ],
        notifications: [
          {
            id: '01990000-0000-7000-8000-00000000f001',
            userId: user.id,
            kind: 'RISK_DETECTED',
            riskId: RISK_ID,
            dedupKey: 'risk:1',
            createdAt: '2026-09-18T10:01:00Z',
            deliveries: admin.deliveries,
          },
        ],
        actions: [],
        outcomes: [],
        revenue: [
          {
            eventId: '01990000-0000-7000-8000-000000002001',
            opportunityId: OPPORTUNITY_ID,
            amount: '31000.00',
            currency: 'RUB',
            status: 'CONFIRMED',
            attribution: 'RECOVERED',
            riskId: RISK_ID,
            confirmedAt: '2026-09-23T12:00:00Z',
          },
        ],
      })
    }
    return json(route, 404, errorBody('NOT_FOUND'))
  })
  await registerAdminMe()
}
