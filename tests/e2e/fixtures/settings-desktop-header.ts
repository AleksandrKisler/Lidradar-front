/** N-SHELL-HEADER-01: synthetic API and measured shell geometry, no Privacy redesign. */
import { expect, type Page } from '@playwright/test'
import type { components } from '../../../src/shared/api/generated/schema'
import { TENANT_ID } from './api'
import { deferred } from './settings-company'
import {
  NOTIFICATIONS_NOW,
  NOTIFICATIONS_USER,
  settingsNotificationsFixture,
} from './settings-notifications'
import { settingsTeamFixture } from './settings-team'
export const HEADER_NOW = NOTIFICATIONS_NOW
export const HEADER_ROUTES = [
  { kind: 'notifications', path: '/settings/notifications', title: 'Уведомления' },
  { kind: 'team', path: '/settings/team', title: 'Команда и доступ' },
  { kind: 'privacy', path: '/settings/privacy', title: 'Данные и конфиденциальность' },
] as const
export type HeaderKind = (typeof HEADER_ROUTES)[number]['kind']
type Consent = components['schemas']['MLConsentStatus']
type Endpoint = 'read' | 'grant' | 'revoke' | 'export'
export async function privacyHeaderFixture(
  page: Page,
  options: { manager?: boolean; initial?: 'never' | 'active' | 'revoked' } = {},
) {
  const base = await settingsNotificationsFixture(page, { manager: options.manager })
  const consent: Consent = {
    scope: 'DATASETS',
    active: options.initial === 'active',
    consent:
      options.initial && options.initial !== 'never'
        ? {
            id: '01990000-0000-7000-8000-000000000901',
            scope: 'DATASETS',
            grantedBy: NOTIFICATIONS_USER,
            grantedAt: '2026-10-25T08:45:00Z',
            ...(options.initial === 'revoked'
              ? { revokedBy: NOTIFICATIONS_USER, revokedAt: HEADER_NOW }
              : {}),
          }
        : null,
  }
  const calls: { endpoint: Endpoint; method: string; tenant: string | undefined }[] = []
  const failures = new Map<Endpoint, { status: number; code: string }>()
  const holds = new Map<Endpoint, ReturnType<typeof deferred>>()
  await page.route(/\/api\/v1\/organization\/(ml-consent|export)$/, async (route) => {
    const request = route.request(),
      method = request.method()
    const endpoint: Endpoint = request.url().endsWith('/export')
      ? 'export'
      : method === 'GET'
        ? 'read'
        : method === 'POST'
          ? 'grant'
          : 'revoke'
    calls.push({ endpoint, method, tenant: request.headers()['x-tenant-id'] })
    const gate = holds.get(endpoint)
    if (gate) await gate.promise
    const failure = failures.get(endpoint)
    if (failure)
      return route.fulfill({
        status: failure.status,
        headers: failure.status === 429 ? { 'Retry-After': '3600' } : {},
        json: { error: { code: failure.code, message: '', traceId: '' } },
      })
    if (endpoint === 'read') return route.fulfill({ json: consent })
    if (endpoint === 'grant') {
      consent.active = true
      consent.consent = {
        id: '01990000-0000-7000-8000-000000000902',
        scope: 'DATASETS',
        grantedBy: NOTIFICATIONS_USER,
        grantedAt: HEADER_NOW,
      }
      return route.fulfill({ status: 201, json: consent })
    }
    if (endpoint === 'revoke') {
      consent.active = false
      if (consent.consent)
        Object.assign(consent.consent, { revokedBy: NOTIFICATIONS_USER, revokedAt: HEADER_NOW })
      return route.fulfill({ status: 204 })
    }
    // Empty ZIP end-of-central-directory: synthetic bytes, never organization data.
    const zip = Buffer.alloc(22)
    zip.writeUInt32LE(0x06054b50)
    return route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="header-fixture.zip"',
      },
      body: zip,
    })
  })
  return {
    consent,
    company: base.company,
    calls,
    failures,
    hold(endpoint: Endpoint) {
      holds.set(endpoint, deferred())
    },
    writes() {
      return calls.filter((call) => call.method !== 'GET')
    },
    dispose() {
      holds.forEach((gate) => gate.release())
      holds.clear()
      base.dispose()
    },
  }
}
export async function settingsHeaderFixture(page: Page, kind: HeaderKind) {
  return kind === 'team'
    ? settingsTeamFixture(page)
    : kind === 'privacy'
      ? privacyHeaderFixture(page)
      : settingsNotificationsFixture(page)
}
export async function readySettingsHeader(page: Page) {
  return page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((image) => image.decode()))
    const urls = new Set(
      [...document.querySelectorAll<HTMLElement>('*')].flatMap((element) => {
        const style = getComputedStyle(element)
        return [style.maskImage, style.backgroundImage].flatMap((value) =>
          [...value.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((match) => match[1]!),
        )
      }),
    )
    const assets = await Promise.all(
      [...urls].map(async (url) => {
        const image = new Image()
        image.src = url
        await image.decode()
        return {
          path: new URL(url, location.href).pathname,
          width: image.naturalWidth,
          height: image.naturalHeight,
        }
      }),
    )
    if (!document.fonts.check('16px Inter')) throw new Error('Inter not ready')
    return {
      assets,
      fonts: [...document.fonts].map((font) => ({ family: font.family, status: font.status })),
      images: [...document.images].map((image) => ({
        path: new URL(image.currentSrc).pathname,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })),
    }
  })
}
export const headerAccount = (page: Page, desktop: boolean) =>
  page
    .locator(desktop ? 'main a[href="/account"]' : 'header a[href="/account"]')
    .filter({ visible: true })
    .first()
export async function settingsHeaderGeometry(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main')!
    const shellHeader = main.firstElementChild!
    const appbar = [...document.querySelectorAll('header')].find((element) =>
      element.querySelector('button[aria-label="Меню"]'),
    )!
    const visible = (element: Element) => element.getClientRects().length > 0
    const account = [
      ...(innerWidth >= 1024 ? main : appbar).querySelectorAll<HTMLAnchorElement>(
        'a[href="/account"]',
      ),
    ].find(visible)!
    const h1 = main.querySelector('h1')!
    const tabs = main.querySelector('nav[aria-label="Разделы настроек"]')!
    const titleHeader = h1.closest('header')!
    const firstSection = main.querySelector('section')!
    const rect = (element: Element) => {
      const r = element.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }
    }
    return {
      viewport: { width: innerWidth, height: innerHeight },
      dpr: devicePixelRatio,
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      shellHeader: { ...rect(shellHeader), visible: visible(shellHeader) },
      appbar: { ...rect(appbar), visible: visible(appbar) },
      account: {
        ...rect(account),
        color: getComputedStyle(account).color,
        href: account.getAttribute('href'),
        label: account.getAttribute('aria-label') ?? account.textContent?.trim(),
      },
      title: rect(h1),
      titleHeader: rect(titleHeader),
      tabs: { ...rect(tabs), visible: visible(tabs) },
      firstSection: rect(firstSection),
      main: { ...rect(main), paddingBottom: getComputedStyle(main).paddingBottom },
      dialogs: [...document.querySelectorAll('[role=dialog]')].filter(visible).map(rect),
    }
  })
}
export async function openHeaderOverlay(page: Page, kind: HeaderKind) {
  await page
    .getByRole('button', {
      name:
        kind === 'notifications'
          ? 'Изменить: Нет ответа клиенту'
          : kind === 'team'
            ? 'Пригласить участника'
            : 'Дать согласие',
      exact: true,
    })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
}
export const headerTenant = TENANT_ID
