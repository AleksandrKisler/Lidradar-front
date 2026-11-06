/**
 * Синтетический набор Radar для съёмки (F02 и перенос оболочки C): 12 рисков по составу кадров
 * Figma, две точки, сводка и деталь первой карточки. Общий для `capture.spec.ts` и
 * `radar-layout.capture.spec.ts`, чтобы кадры разных пакетов снимались на одних данных.
 */
import type { Page, Route } from '@playwright/test'
import { CONVERSATION_ID, OPPORTUNITY_ID, RISK_ID, mockOwner } from '../../tests/e2e/fixtures/api'

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

export const TVERSKAYA = '01990000-0000-7000-8000-000000000201'
export const KHAMOVNIKI = '01990000-0000-7000-8000-000000000202'
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
export const items = protos.map((proto, index) => risk(index, proto))

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

export async function owner(page: Page): Promise<void> {
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
export async function waitRealtimeSettled(page: Page): Promise<void> {
  await page.locator('button[title^="Автообновление недоступно"]').waitFor()
}
