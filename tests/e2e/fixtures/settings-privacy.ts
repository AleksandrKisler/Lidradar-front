/** US-M14 synthetic fixtures. ZIP bytes are an empty archive, never organization data. */
import { expect, type Page } from '@playwright/test'
import type { components } from '../../../src/shared/api/generated/schema'
import { TENANT_ID } from './api'
import { deferred } from './settings-company'
import {
  NOTIFICATIONS_OTHER_TENANT,
  NOTIFICATIONS_USER,
  settingsNotificationsFixture,
} from './settings-notifications'

export const PRIVACY_NOW = '2026-11-01T07:24:00Z'
export const PRIVACY_OTHER_TENANT = NOTIFICATIONS_OTHER_TENANT
export const PRIVACY_OTHER_USER = '01990000-0000-7000-8000-000000000102'
export const PRIVACY_LONG_NAME = 'Александра Константиновна Волкова-Соколовская'
export type Consent = components['schemas']['MLConsentStatus']
export type PrivacyEndpoint = 'read' | 'grant' | 'revoke' | 'export'
export type PrivacyFailure = { status: number; code: string; retryAfter?: string; traceId?: string }
export type PrivacyCall = {
  endpoint: PrivacyEndpoint
  method: string
  tenant: string | undefined
  body: string | null
}
export function privacyConsent(initial: 'never' | 'active' | 'revoked' = 'never'): Consent {
  return {
    scope: 'DATASETS',
    active: initial === 'active',
    consent:
      initial === 'never'
        ? null
        : {
            id: '01990000-0000-7000-8000-000000000901',
            scope: 'DATASETS',
            grantedBy: NOTIFICATIONS_USER,
            grantedAt: initial === 'revoked' ? '2026-10-30T06:10:00Z' : PRIVACY_NOW,
            ...(initial === 'revoked'
              ? { revokedBy: PRIVACY_OTHER_USER, revokedAt: '2026-11-01T08:45:00Z' }
              : {}),
          },
  }
}
export async function settingsPrivacyFixture(
  page: Page,
  options: {
    initial?: 'never' | 'active' | 'revoked'
    manager?: boolean
    multiTenant?: boolean
    longNames?: boolean
  } = {},
) {
  const base = await settingsNotificationsFixture(page, {
    manager: options.manager,
    multiTenant: options.multiTenant,
  })
  await page.clock.setFixedTime(new Date(PRIVACY_NOW))
  const identity = {
    role: options.manager ? ('MANAGER' as const) : ('OWNER' as 'OWNER' | 'MANAGER'),
    userId: options.manager ? PRIVACY_OTHER_USER : NOTIFICATIONS_USER,
  }
  const company = base.company
  company.createdAt = PRIVACY_NOW
  company.updatedAt = PRIVACY_NOW
  if (options.longNames)
    company.name =
      'Студия красоты и профессионального ухода «Блик на Патриарших прудах» — Центральный офис'
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      json: {
        user: {
          id: identity.userId,
          email: 'privacy-fixture@example.test',
          displayName: identity.role === 'MANAGER' ? 'Анна Менеджер' : 'Мария Владелец',
          status: 'ACTIVE',
          createdAt: PRIVACY_NOW,
          updatedAt: PRIVACY_NOW,
          emailVerifiedAt: PRIVACY_NOW,
          deletionDueAt: null,
        },
        memberships: [
          { tenantId: TENANT_ID, organizationName: company.name, role: identity.role },
          ...(options.multiTenant
            ? [
                {
                  tenantId: PRIVACY_OTHER_TENANT,
                  organizationName: 'Другая студия',
                  role: identity.role,
                },
              ]
            : []),
        ],
        canCreateOrganization: false,
      },
    }),
  )
  await page.route('**/api/v1/organization/members**', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            membershipId: '01990000-0000-7000-8000-000000001001',
            userId: NOTIFICATIONS_USER,
            displayName: 'Мария Владелец',
            email: 'owner@example.test',
            role: 'OWNER',
            status: 'ACTIVE',
            createdAt: PRIVACY_NOW,
          },
          {
            membershipId: '01990000-0000-7000-8000-000000001002',
            userId: PRIVACY_OTHER_USER,
            displayName: PRIVACY_LONG_NAME,
            email: 'member@example.test',
            role: 'MANAGER',
            status: 'ACTIVE',
            createdAt: PRIVACY_NOW,
          },
        ],
      },
    }),
  )
  const consent = privacyConsent(options.initial)
  const otherConsent = privacyConsent('never')
  const calls: PrivacyCall[] = []
  const failures = new Map<PrivacyEndpoint, PrivacyFailure>()
  const holds = new Map<PrivacyEndpoint, ReturnType<typeof deferred>>()
  const archive = { filename: 'lidradar-organization-2026-11-01.zip', bytes: Buffer.alloc(22) }
  archive.bytes.writeUInt32LE(0x06054b50)
  const responses = { grantStatus: 201 as 200 | 201 }
  await page.route(/\/api\/v1\/organization\/(ml-consent|export)$/, async (route) => {
    const request = route.request()
    const method = request.method()
    const tenant = request.headers()['x-tenant-id']
    const endpoint: PrivacyEndpoint = request.url().endsWith('/export')
      ? 'export'
      : method === 'GET'
        ? 'read'
        : method === 'POST'
          ? 'grant'
          : 'revoke'
    calls.push({ endpoint, method, tenant, body: request.postData() })
    const target = tenant === PRIVACY_OTHER_TENANT ? otherConsent : consent
    const gate = holds.get(endpoint)
    const failure = failures.get(endpoint)
    // Capture the read now: releasing a held GET must not manufacture a newer server snapshot.
    const readSnapshot = structuredClone(target)
    if (gate) await gate.promise
    if (failure)
      return route.fulfill({
        status: failure.status,
        headers: failure.retryAfter ? { 'Retry-After': failure.retryAfter } : {},
        json: {
          error: {
            code: failure.code,
            message: 'raw-private-error',
            traceId: failure.traceId ?? 'privacy-fixture-trace',
          },
        },
      })
    if (endpoint === 'read') return route.fulfill({ json: readSnapshot })
    if (endpoint === 'grant') {
      Object.assign(target, privacyConsent('active'))
      return route.fulfill({ status: responses.grantStatus, json: target })
    }
    if (endpoint === 'revoke') {
      target.active = false
      if (target.consent)
        Object.assign(target.consent, { revokedBy: identity.userId, revokedAt: PRIVACY_NOW })
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="${archive.filename}"`,
      },
      body: archive.bytes,
    })
  })
  return {
    consent,
    otherConsent,
    company,
    identity,
    archive,
    responses,
    calls,
    failures,
    hold(endpoint: PrivacyEndpoint) {
      holds.set(endpoint, deferred())
    },
    release(endpoint: PrivacyEndpoint) {
      holds.get(endpoint)?.release()
      holds.delete(endpoint)
    },
    writes(endpoint?: PrivacyEndpoint) {
      return calls.filter(
        (call) => call.method !== 'GET' && (!endpoint || call.endpoint === endpoint),
      )
    },
    dispose() {
      holds.forEach((gate) => gate.release())
      holds.clear()
      base.dispose()
    },
  }
}
export type SettingsPrivacyFixture = Awaited<ReturnType<typeof settingsPrivacyFixture>>
export const privacyDialog = (page: Page) => page.getByRole('dialog').filter({ visible: true })
export async function openPrivacyDialog(page: Page, kind: 'grant' | 'revoke' = 'grant') {
  await page
    .getByRole('button', {
      name: kind === 'grant' ? 'Дать согласие' : 'Отозвать согласие',
      exact: true,
    })
    .click()
  const dialog = privacyDialog(page)
  await expect(dialog).toHaveAccessibleName(
    kind === 'grant' ? 'Дать согласие на использование данных?' : 'Отозвать согласие?',
  )
  return dialog
}
export async function refreshPrivacy(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-01T07:25:00Z'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
}
