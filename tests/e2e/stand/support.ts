/**
 * Общая часть проверок на учебном стенде backend (runbook
 * `docs/runbooks/frontend-development.md`, профиль Playwright `stand`).
 *
 * Вход выполняется API-запросом в контексте Node: пароль читается из файла и
 * не попадает в браузер, вывод, трассы и снимки. Cookie сессии переносится в
 * контекст браузера. Набор только читает данные стенда; их состояние
 * восстанавливается `make frontend-data-down && make frontend-data-up`.
 */
import { readFileSync } from 'node:fs'
import {
  expect,
  request,
  test as base,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'

export type FixtureProfile = 'empty' | 'small' | 'large'

const passwordFile = process.env.LIDRADAR_STAND_PASSWORD_FILE
const baseUrlConfigured = Boolean(process.env.E2E_BASE_URL)

/** Пропускает набор, пока не заданы файл пароля и адрес dev-сервера с прокси `/api`. */
export function requireStand(): void {
  base.skip(
    !passwordFile || !baseUrlConfigured,
    'нужны LIDRADAR_STAND_PASSWORD_FILE и E2E_BASE_URL',
  )
}

export function profileEmail(profile: FixtureProfile): string {
  return process.env[`LIDRADAR_STAND_${profile.toUpperCase()}_EMAIL`] ?? `${profile}@lidradar.test`
}

export interface ApiRequestLog {
  url: string
  method: string
  tenant: string | null
}

export interface StandSession {
  context: BrowserContext
  page: Page
  /** Запросы к API со старта страницы: для проверок N+1 и заголовка организации. */
  requests: ApiRequestLog[]
  tenantId: string
}

/** Входит указанным учебным пользователем и открывает страницу с его сессией. */
export async function openStand(
  browser: Browser,
  baseURL: string,
  profile: FixtureProfile,
): Promise<StandSession> {
  const password = readFileSync(passwordFile!, 'utf8').trim()
  const api = await request.newContext({ baseURL })
  const login = await api.post('/api/v1/auth/login', {
    data: { email: profileEmail(profile), password },
  })
  expect(login.status(), `вход ${profile} по API`).toBe(200)
  const me = (await (await api.get('/api/v1/auth/me')).json()) as {
    memberships: { tenantId: string }[]
  }
  const tenantId = me.memberships[0]?.tenantId ?? ''
  expect(tenantId, 'у учебного пользователя есть организация').not.toBe('')
  const state = await api.storageState()
  await api.dispose()
  expect(state.cookies.some((cookie) => cookie.name === 'lidradar_session')).toBe(true)
  const context = await browser.newContext({ storageState: state })
  const page = await context.newPage()
  const requests: ApiRequestLog[] = []
  page.on('request', (item) => {
    if (!item.url().includes('/api/v1/')) return
    requests.push({
      url: item.url(),
      method: item.method(),
      tenant: item.headers()['x-tenant-id'] ?? null,
    })
  })
  return { context, page, requests, tenantId }
}

/** Снимок API той же сессией: инварианты фикстур вместо чисел из макетов. */
export async function apiSnapshot<T>(session: StandSession, path: string): Promise<T> {
  const response = await session.page.request.get(path, {
    headers: { 'X-Tenant-ID': session.tenantId },
  })
  expect(response.ok(), `GET ${path}`).toBe(true)
  return (await response.json()) as T
}

/** Число запросов карточек рисков: лента не должна читать детали построчно. */
export function riskDetailRequests(requests: ApiRequestLog[]): number {
  return requests.filter((item) =>
    /\/api\/v1\/risks\/[0-9a-f-]{36}$/.test(new URL(item.url).pathname),
  ).length
}

export const test = base
export { expect }
