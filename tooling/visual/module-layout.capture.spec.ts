/**
 * Shell-only evidence for the four modules; body remains the existing mockOwner UI.
 * Run via tooling/visual/playwright.config.ts after integration, with a unique VISUAL_OUT.
 * No baselines, application styles, endpoints or external writes are changed here.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { CONVERSATION_ID, TENANT_ID, mockOwner } from '../../tests/e2e/fixtures/api'
import { settle, settleInPlace } from './shot'

const OUT = resolve(process.env.VISUAL_OUT ?? 'artifacts/frontend-v2/module-layout/current')
const NOW = '2026-10-25T11:30:00.000Z'
const sizes = {
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 834, height: 1194 },
  phone: { width: 390, height: 844 },
} as const
type Device = keyof typeof sizes
type Module = 'dialogs' | 'analytics' | 'integrations' | 'settings'
const modules: Record<Module, { path: string; nav: string; node: string; content: string }> = {
  dialogs: {
    path: '/conversations',
    nav: 'Диалоги',
    node: '342:8909',
    content: '/api/v1/conversations',
  },
  analytics: {
    path: '/analytics',
    nav: 'Аналитика',
    node: '306:2918',
    content: '/api/v1/analytics/payments',
  },
  integrations: {
    path: '/integrations',
    nav: 'Интеграции',
    node: '387:2858',
    content: '/api/v1/integrations',
  },
  settings: {
    path: '/settings/company',
    nav: 'Настройки',
    node: '529:4216',
    content: '/api/v1/services',
  },
}
const tabs = ['company', 'services', 'notifications', 'team', 'privacy', 'account'] as const
const drawerNodes = {
  dialogs: { tablet: '1115:23636', phone: '1115:23675' },
  analytics: { tablet: '1115:23558', phone: '1115:23597' },
  integrations: { tablet: '1115:23048', phone: '1115:23087' },
  settings: { tablet: '599:12748', phone: '599:15847' },
} as const

test.use({
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  reducedMotion: 'reduce',
  deviceScaleFactor: 1,
})

type Capture = {
  file: string
  frame: string
  referenceKind: 'exact-drawer' | 'approved-shell-pattern'
  referenceScope: string
  module: Module
  state: string
  viewport: { width: number; height: number }
  fixture: string
  browserVersion: string
  dpr: number
  locale: string
  timezone: string
  fixedClock: string
  url: string
  geometry: unknown
}
const captures: Capture[] = []
const writes = new WeakMap<Page, string[]>()
const bodies = new WeakMap<Page, Map<string, unknown>>()
const responseJobs = new WeakMap<Page, Set<Promise<void>>>()

test.beforeEach(async ({ page }) => {
  mkdirSync(`${OUT}/actual`, { recursive: true })
  await page.clock.setFixedTime(new Date(NOW))
  await mockOwner(page, { events: 'silent' })
  // Healthy SSE fixture: route.fulfill closes an event stream immediately and produces
  // backoff. Keep the mocked response open for normal reference frames; fault transport
  // states are tested by stock browser tests using the actual unavailable/offline paths.
  await page.addInitScript(() => {
    const fetchNetwork = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : null
      const url = new URL(request?.url ?? String(input), window.location.origin)
      if (url.pathname !== '/api/v1/events') return fetchNetwork(input, init)
      const signal = init?.signal ?? request?.signal
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(': connected\n\n'))
            signal?.addEventListener(
              'abort',
              () => controller.error(new DOMException('Aborted', 'AbortError')),
              { once: true },
            )
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } },
      )
    }
  })
  writes.set(page, [])
  bodies.set(page, new Map())
  responseJobs.set(page, new Set())
  page.on('response', (response) => {
    if (!response.url().includes('/api/v1/') || response.request().method() !== 'GET') return
    const job = response
      .json()
      .then((body: unknown) => {
        bodies.get(page)!.set(new URL(response.url()).pathname, body)
      })
      .catch(() => undefined)
    responseJobs.get(page)!.add(job)
    void job.finally(() => responseJobs.get(page)!.delete(job))
  })
  // Registered last: every mutation is blocked before mockOwner can consume it.
  await page.route('**/api/v1/**', async (route) => {
    const method = route.request().method()
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      writes.get(page)!.push(`${method} ${new URL(route.request().url()).pathname}`)
      await route.abort('blockedbyclient')
      return
    }
    await route.fallback()
  })
})
test.afterEach(async ({ page }) => {
  expect(writes.get(page), 'Capture must not trigger API writes').toEqual([])
})
test.afterAll(() => {
  mkdirSync(OUT, { recursive: true })
  writeFileSync(
    `${OUT}/captures.json`,
    JSON.stringify(
      {
        scope: 'Shell only; module bodies use existing runtime and may differ from Figma',
        references: [
          'artifacts/frontend-v2/module-shell-rollout-2026-10-30/target-map.json',
          'artifacts/frontend-v2/settings-admin-shell-rollout-2026-10-30/target-map.json',
        ],
        captures,
      },
      null,
      2,
    ),
  )
})

async function ready(page: Page): Promise<void> {
  await expect(page.locator('main#main')).toBeVisible()
  await expect(page.locator('main#main [role="status"][aria-label^="Загрузка"]')).toHaveCount(0)
  await expect.poll(() => responseJobs.get(page)!.size).toBe(0)
  await settle(page)
}
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await ready(page)
}

async function shoot(
  page: Page,
  module: Module,
  name: string,
  state: string,
  drawer?: 'tablet' | 'phone',
): Promise<void> {
  await settleInPlace(page)
  const geometry = await page.evaluate(() => {
    const visible = (element: Element) => element.getClientRects().length > 0
    const rect = (element: Element) => {
      const box = element.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    }
    const active = document.activeElement
    return {
      scroll: { x: scrollX, y: scrollY },
      scrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      documentHeight: document.documentElement.scrollHeight,
      headers: [...document.querySelectorAll('header')].filter(visible).map(rect),
      sidebar: [...document.querySelectorAll('aside')].filter(visible).map(rect),
      context: document.querySelector('main#main')?.firstElementChild?.textContent?.trim(),
      dialogs: [...document.querySelectorAll('[role="dialog"]')].filter(visible).map(rect),
      selected: [...document.querySelectorAll('[aria-current="page"]')]
        .filter(visible)
        .map((element) => ({ text: element.textContent?.trim(), rect: rect(element) })),
      controls: [...document.querySelectorAll('a[aria-label], button[aria-label]')]
        .filter(visible)
        .map((element) => ({ label: element.getAttribute('aria-label'), rect: rect(element) })),
      focus:
        active instanceof HTMLElement
          ? {
              tag: active.tagName,
              label: active.getAttribute('aria-label'),
              text: active.textContent?.trim(),
              visible: active.matches(':focus-visible'),
              rect: rect(active),
            }
          : null,
    }
  })
  const file = `actual/${name}.png`
  // Raw viewport PNG: do not resize images or stretch sticky shell for screenshots.
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: false, animations: 'disabled' })
  writeFileSync(`${OUT}/actual/${name}.geometry.json`, JSON.stringify(geometry, null, 2))
  captures.push({
    file,
    frame: drawer ? drawerNodes[module][drawer] : modules[module].node,
    referenceKind: drawer ? 'exact-drawer' : 'approved-shell-pattern',
    referenceScope: drawer
      ? 'Approved module drawer'
      : 'Approved desktop module shell adapted using canonical C tablet/phone headers; body, other tabs, states and arbitrary widths are pattern comparisons',
    module,
    state,
    viewport: page.viewportSize()!,
    fixture: `mockOwner; tenant=${TENANT_ID}; ${state}`,
    browserVersion: page.context().browser()!.version(),
    dpr: await page.evaluate(() => devicePixelRatio),
    locale: 'ru-RU',
    timezone: 'Europe/Moscow',
    fixedClock: NOW,
    url: new URL(page.url()).pathname,
    geometry,
  })
}

/** Keyboard traversal proves focus-visible; a scripted .focus() alone is insufficient. */
async function keyboardFocus(page: Page, target: Locator): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => element === document.activeElement)) {
      await expect(target).toBeFocused()
      expect(await target.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
      return
    }
  }
  throw new Error(
    `Keyboard could not reach ${(await target.getAttribute('aria-label')) ?? (await target.textContent())}`,
  )
}

for (const module of Object.keys(modules) as Module[]) {
  for (const device of Object.keys(sizes) as Device[]) {
    test(`${module} ${device}: normal, focus, bottom${device === 'desktop' ? '' : ', drawer'}`, async ({
      page,
    }) => {
      test.setTimeout(60_000)
      await page.setViewportSize(sizes[device])
      await open(page, modules[module].path)
      await shoot(page, module, `${module}-${device}`, 'normal')
      const settings = page
        .getByRole('link', { name: 'Настройки', exact: true })
        .filter({ visible: true })
      await keyboardFocus(page, settings)
      await shoot(page, module, `${module}-${device}-focus-settings`, 'keyboard-focus-settings')
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await shoot(page, module, `${module}-${device}-bottom`, 'viewport-bottom')
      await settle(page)
      if (device !== 'desktop') {
        const menu = page.getByRole('button', { name: 'Меню', exact: true })
        await keyboardFocus(page, menu)
        await shoot(page, module, `${module}-${device}-focus-menu`, 'keyboard-focus-menu')
        await page.keyboard.press('Enter')
        const drawer = page.getByRole('dialog', { name: 'Меню', exact: true })
        await expect(drawer).toBeVisible()
        await shoot(page, module, `${module}-${device}-menu`, 'navigation-drawer', device)
        // Settings deliberately has no selected appnav row.
        const navLink = drawer
          .getByRole('navigation', { name: 'Разделы', exact: true })
          .getByRole('link', {
            name: module === 'settings' ? 'Radar' : modules[module].nav,
            exact: true,
          })
        await keyboardFocus(page, navLink)
        await shoot(
          page,
          module,
          `${module}-${device}-focus-nav`,
          'keyboard-focus-navigation',
          device,
        )
        await page.keyboard.press('Escape')
        await expect(drawer).not.toBeVisible()
        await expect(menu).toBeFocused()
      } else {
        const nav = page.getByRole('navigation', { name: 'Разделы', exact: true })
        await keyboardFocus(
          page,
          nav.getByRole('link', {
            name: module === 'settings' ? 'Radar' : modules[module].nav,
            exact: true,
          }),
        )
        await shoot(page, module, `${module}-${device}-focus-nav`, 'keyboard-focus-navigation')
      }
    })
  }
  for (const width of [320, 767, 768, 1023, 1024]) {
    test(`${module} boundary ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await open(page, modules[module].path)
      await shoot(page, module, `${module}-${width}`, `breakpoint-${width}`)
    })
  }
  test(`${module} 200-percent-equivalent and long identity`, async ({ page }) => {
    test.setTimeout(60_000)
    // 1440×1000 at 200% browser zoom has a 720×500 CSS viewport. DPR stays 1;
    // this exercises reflow, not OS rasterization or text-only scaling.
    await page.setViewportSize({ width: 720, height: 500 })
    await open(page, modules[module].path)
    await shoot(page, module, `${module}-zoom200-equivalent`, '200-percent-equivalent-css-viewport')
    const me = bodies.get(page)!.get('/api/v1/auth/me') as {
      user: Record<string, unknown>
      memberships: Record<string, unknown>[]
    }
    expect(me?.user).toBeTruthy()
    const organizationName =
      'Студия комплексного ухода за автомобилями «Очень длинное название организации»'
    const displayName = 'Александра Константиновна Оченьдлиннаяфамилия'
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        json: {
          ...me,
          user: { ...me.user, displayName },
          memberships: me.memberships.map((item) => ({ ...item, organizationName })),
        },
      }),
    )
    for (const device of Object.keys(sizes) as Device[]) {
      await page.setViewportSize(sizes[device])
      await open(page, modules[module].path)
      await shoot(
        page,
        module,
        `${module}-${device}-long-identity`,
        'long-organization-and-display-name',
      )
    }
  })
}

for (const device of Object.keys(sizes) as Device[]) {
  test(`dialog detail ${device}`, async ({ page }) => {
    await page.setViewportSize(sizes[device])
    await open(page, `/conversations/${CONVERSATION_ID}`)
    await expect(page.getByRole('region', { name: 'Сообщения', exact: true })).toBeVisible()
    await shoot(page, 'dialogs', `dialogs-detail-${device}`, 'conversation-detail')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await shoot(page, 'dialogs', `dialogs-detail-${device}-bottom`, 'conversation-detail-bottom')
  })
  for (const tab of tabs.filter((tab) => tab !== 'company')) {
    test(`settings ${tab} ${device}`, async ({ page }) => {
      await page.setViewportSize(sizes[device])
      await open(page, `/settings/${tab}`)
      await shoot(page, 'settings', `settings-${tab}-${device}`, `settings-tab-${tab}`)
    })
  }
}

// Empty is a collection empty state, not invented zero financial/business values.
// The canonical mock response is observed first, then only items/nextCursor change.
for (const module of Object.keys(modules) as Module[]) {
  for (const device of Object.keys(sizes) as Device[]) {
    for (const state of ['loading', 'error', 'empty'] as const) {
      test(`${module} ${state} ${device}`, async ({ page }) => {
        test.setTimeout(60_000)
        await page.setViewportSize(sizes[device])
        const path = module === 'settings' ? '/settings/services' : modules[module].path
        const endpoint = modules[module].content
        await open(page, path)
        const original = bodies.get(page)!.get(endpoint) as Record<string, unknown>
        expect(original, `Canonical response for ${endpoint}`).toBeTruthy()
        let release: (() => void) | undefined
        const held = new Promise<void>((resolveHeld) => {
          release = resolveHeld
        })
        let seen = false
        await page.route(`**${endpoint}**`, async (route) => {
          if (
            route.request().method() !== 'GET' ||
            new URL(route.request().url()).pathname !== endpoint
          )
            return route.fallback()
          seen = true
          if (state === 'loading') {
            await held
            await route.abort('aborted').catch(() => undefined)
          } else if (state === 'error') {
            await route.abort('failed')
          } else {
            expect(Array.isArray(original.items), `Collection response ${endpoint}`).toBe(true)
            await route.fulfill({
              json: {
                ...original,
                items: [],
                ...('nextCursor' in original ? { nextCursor: null } : {}),
              },
            })
          }
        })
        try {
          await page.reload()
          await expect.poll(() => seen).toBe(true)
          if (state === 'loading')
            await expect(
              page.locator('main#main [role="status"][aria-label^="Загрузка"]').first(),
            ).toBeVisible()
          else if (state === 'error')
            await expect(page.locator('main#main [role="alert"]').first()).toBeVisible()
          else {
            await ready(page)
            const emptyText = {
              dialogs: 'Переписок пока нет',
              analytics: 'Подтверждённых оплат за период нет.',
              integrations: 'Источников пока нет',
              settings: /Услуг пока нет\./,
            }[module]
            await expect(page.getByText(emptyText, { exact: module !== 'settings' })).toBeAttached()
          }
          await shoot(
            page,
            module,
            `${module}-${state}-${device}`,
            `${state}: ${endpoint}; organization/locations preserved`,
          )
        } finally {
          release?.()
        }
      })
    }
  }
}
