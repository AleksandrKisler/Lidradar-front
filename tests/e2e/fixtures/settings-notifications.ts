/** Synthetic personal notifications. No backend, Telegram delivery or real tokens. */
import { expect, type Page, type Route } from '@playwright/test'
import type { components } from '../../../src/shared/api/generated/schema'
import { mockOwner, TENANT_ID } from './api'
import { deferred } from './settings-company'

export type Preference = components['schemas']['NotificationPreference']
export type PreferenceRequest = components['schemas']['NotificationPreferenceRequest']
export const NOTIFICATIONS_NOW = '2026-11-01T08:45:00Z'
export const NOTIFICATIONS_OTHER_TENANT = '01990000-0000-7000-8000-000000000099'
export const NOTIFICATIONS_USER = '01990000-0000-7000-8000-000000000101'
export const NOTIFICATION_RULES = [
  ['NO_RESPONSE', 'Нет ответа клиенту'],
  ['BOOKING_NOT_CONFIRMED', 'Запись не подтверждена'],
  ['UNFINISHED_AGREEMENT', 'Договорённость требует внимания'],
  ['PROMISE_NOT_FULFILLED', 'Обещание не выполнено'],
  ['CUSTOMER_SILENT_AFTER_PRICE', 'Клиент молчит после цены'],
  ['FOLLOW_UP_CANDIDATE', 'Стоит напомнить о себе'],
] as const
export type Endpoint = 'preferences' | 'save' | 'reset' | 'status' | 'issue' | 'disconnect'
export type NotificationCall = {
  endpoint: Endpoint
  method: string
  path: string
  body: unknown
  tenant: string | undefined
}
export function notificationDefault(riskType: Preference['riskType']): Preference {
  return {
    riskType,
    minimumSeverity: 'LOW',
    deliveryMode: 'IMMEDIATE',
    inAppEnabled: true,
    telegramEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    digestTime: '09:00',
    timezone: 'Europe/Moscow',
    isDefault: true,
  }
}
/** Matches all six rows in approved1393:15150, including origin and quiet hours. */
export function approvedNotificationPreferences(): Preference[] {
  return NOTIFICATION_RULES.map(([riskType], index) => ({
    ...notificationDefault(riskType),
    isDefault: index === 1,
    minimumSeverity: index === 0 || index === 2 ? 'HIGH' : index === 3 ? 'CRITICAL' : 'LOW',
    deliveryMode: index === 2 || index === 5 ? 'DIGEST' : index === 4 ? 'DISABLED' : 'IMMEDIATE',
    inAppEnabled: index !== 5,
    telegramEnabled: index !== 3,
    quietHoursEnabled: index === 2,
    quietHoursStart: index === 2 ? '22:00' : null,
    quietHoursEnd: index === 2 ? '08:00' : null,
  }))
}
export async function settingsNotificationsFixture(
  page: Page,
  options: { linked?: boolean; manager?: boolean; multiTenant?: boolean } = {},
) {
  await mockOwner(page, { events: 'silent', role: options.manager ? 'MANAGER' : 'OWNER' })
  if (options.multiTenant)
    await page.addInitScript(
      ({ user, tenant }) => {
        const key = `lidradar.tenant.${user}`
        if (!localStorage.getItem(key)) localStorage.setItem(key, tenant)
      },
      { user: NOTIFICATIONS_USER, tenant: TENANT_ID },
    )
  await page.clock.setFixedTime(new Date(NOTIFICATIONS_NOW))
  const rows = approvedNotificationPreferences()
  const otherRows = approvedNotificationPreferences().map((row) => ({
    ...row,
    minimumSeverity: 'MEDIUM' as const,
    isDefault: true,
  }))
  const company = {
    id: TENANT_ID,
    name: 'Студия «Блик»',
    defaultTimezone: 'Europe/Moscow',
    defaultCurrency: 'RUB',
    status: 'ACTIVE',
    createdAt: NOTIFICATIONS_NOW,
    updatedAt: NOTIFICATIONS_NOW,
  }
  // The public Settings entry opens Company before Notifications. Its schedule editor
  // consumes the complete Location contract even when this fixture targets another tab.
  const locations: components['schemas']['Location'][] = [
    {
      id: '01990000-0000-7000-8000-000000000201',
      name: 'Студия',
      timezone: 'Europe/Moscow',
      responseThresholdMinutes: 45,
      agreementThresholdMinutes: 120,
      active: true,
      businessHours: Array.from({ length: 7 }, (_, index) =>
        index < 5
          ? { weekday: index + 1, closed: false, opensAt: '09:00', closesAt: '20:00' }
          : { weekday: index + 1, closed: true },
      ),
      createdAt: NOTIFICATIONS_NOW,
      updatedAt: NOTIFICATIONS_NOW,
    },
  ]
  const calls: NotificationCall[] = []
  const failures = new Map<Endpoint, { status: number; code: string }>()
  const holds = new Map<Endpoint, ReturnType<typeof deferred>>()
  const telegram = {
    linked: options.linked ?? true,
    startUrl: 'https://t.me/lidradar_fixture_bot?start=synthetic-notification-link',
    expiresAt: '2026-11-01T09:00:00Z',
  }
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      json: {
        user: {
          id: NOTIFICATIONS_USER,
          email: 'maria.owner@example.test',
          displayName: 'Мария Владелец',
          status: 'ACTIVE',
          createdAt: NOTIFICATIONS_NOW,
          updatedAt: NOTIFICATIONS_NOW,
          emailVerifiedAt: NOTIFICATIONS_NOW,
          deletionDueAt: null,
        },
        memberships: [
          {
            tenantId: TENANT_ID,
            organizationName: company.name,
            role: options.manager ? 'MANAGER' : 'OWNER',
          },
          ...(options.multiTenant
            ? [
                {
                  tenantId: NOTIFICATIONS_OTHER_TENANT,
                  organizationName: 'Другая студия',
                  role: 'OWNER',
                },
              ]
            : []),
        ],
        canCreateOrganization: false,
      },
    }),
  )
  await page.route('**/api/v1/organization', (route) =>
    route.fulfill({
      json:
        route.request().headers()['x-tenant-id'] === NOTIFICATIONS_OTHER_TENANT
          ? { ...company, id: NOTIFICATIONS_OTHER_TENANT, name: 'Другая студия' }
          : company,
    }),
  )
  await page.route('**/api/v1/locations', (route) => route.fulfill({ json: { items: locations } }))
  const handler = async (route: Route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    const tenant = request.headers()['x-tenant-id']
    const endpoint: Endpoint = path.endsWith('telegram-link-token')
      ? 'issue'
      : path.endsWith('telegram-link')
        ? method === 'DELETE'
          ? 'disconnect'
          : 'status'
        : method === 'PUT'
          ? 'save'
          : method === 'DELETE'
            ? 'reset'
            : 'preferences'
    const body = method === 'PUT' ? (request.postDataJSON() as PreferenceRequest) : null
    calls.push({ endpoint, method, path, body, tenant })
    // Capture the gate and request context before awaiting: a released old request remains old.
    const gate = holds.get(endpoint)
    if (gate) await gate.promise
    const failure = failures.get(endpoint)
    if (failure)
      return route.fulfill({
        status: failure.status,
        json: { error: { code: failure.code, message: '', traceId: '' } },
      })
    if (endpoint === 'issue')
      return route.fulfill({
        status: 201,
        json: { startUrl: telegram.startUrl, expiresAt: telegram.expiresAt },
      })
    if (endpoint === 'status')
      return route.fulfill({
        json: {
          linked: tenant === NOTIFICATIONS_OTHER_TENANT ? false : telegram.linked,
          ...(telegram.linked ? { linkedAt: NOTIFICATIONS_NOW } : {}),
        },
      })
    if (endpoint === 'disconnect') {
      telegram.linked = false
      return route.fulfill({ status: 204 })
    }
    const targetRows = tenant === NOTIFICATIONS_OTHER_TENANT ? otherRows : rows
    if (endpoint === 'preferences') return route.fulfill({ json: { items: targetRows } })
    const riskType = path.split('/').at(-1) as Preference['riskType']
    const index = targetRows.findIndex((row) => row.riskType === riskType)
    if (index < 0) return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } })
    if (endpoint === 'reset') {
      targetRows[index] = notificationDefault(riskType)
      return route.fulfill({ status: 204 })
    }
    targetRows[index] = {
      ...targetRows[index]!,
      ...body,
      quietHoursStart: body?.quietHoursEnabled ? (body.quietHoursStart ?? null) : null,
      quietHoursEnd: body?.quietHoursEnabled ? (body.quietHoursEnd ?? null) : null,
      isDefault: false,
      updatedAt: NOTIFICATIONS_NOW,
    }
    return route.fulfill({ json: targetRows[index] })
  }
  await page.route('**/api/v1/notifications/**', handler)
  // A local stream prevents a visual fixture from displaying a network outage banner.
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
                try {
                  controller.close()
                } catch {
                  /* already closed */
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
  return {
    rows,
    otherRows,
    company,
    locations,
    telegram,
    calls,
    failures,
    hold(endpoint: Endpoint) {
      holds.set(endpoint, deferred())
    },
    release(endpoint: Endpoint) {
      holds.get(endpoint)?.release()
      holds.delete(endpoint)
    },
    writes(endpoint?: Endpoint) {
      return calls.filter(
        (call) => call.method !== 'GET' && (!endpoint || call.endpoint === endpoint),
      )
    },
    dispose() {
      holds.forEach((gate) => gate.release())
      holds.clear()
    },
  }
}
export type SettingsNotificationsFixture = Awaited<ReturnType<typeof settingsNotificationsFixture>>
export const notificationEditor = (page: Page) =>
  page
    .getByRole('dialog', { name: 'Настроить уведомления', exact: true })
    .filter({ visible: true })
    .first()
export async function openNotificationEditor(page: Page, index = 0) {
  await page
    .getByRole('button', { name: `Изменить: ${NOTIFICATION_RULES[index]![1]}`, exact: true })
    .click()
  await expect(notificationEditor(page)).toBeVisible()
  return notificationEditor(page)
}
/** Expire query cache and use the real visibility refresh path, without app internals. */
export async function refreshNotifications(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-01T08:46:00Z'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
}
