/**
 * Кадры переноса оболочки C в Radar (ТЗ `docs/frontend-v2/RADAR-LAYOUT-CLAUDE-TASK.md`).
 * Данные — общий синтетический набор `radar-fixture.ts` (как F02); условия съёмки те же:
 * Chromium, DPR 1, ru-RU, Europe/Moscow, reduced-motion, «сейчас» 23.10.2026 15:40 МСК.
 * Каждый кадр записан в `captures.json` с узлом Figma, viewport и состоянием фикстуры;
 * геометрия оболочки (шапки, меню, рабочее пространство, переполнение) — в `*.geometry.json`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { RISK_ID, TENANT_ID, mockOwner } from '../../tests/e2e/fixtures/api'
import { owner, waitRealtimeSettled } from './radar-fixture'
import { fullShot, settle, settleInPlace } from './shot'

const OUT = resolve(process.env.VISUAL_OUT ?? 'artifacts/frontend-v2/radar-layout/current')
mkdirSync(`${OUT}/actual`, { recursive: true })

const NOW = new Date('2026-10-23T12:40:00Z')
const USER_ID = '01990000-0000-7000-8000-000000000101'
const SECOND_TENANT_ID = '01990000-0000-7000-8000-000000000002'

test.use({
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  reducedMotion: 'reduce',
  deviceScaleFactor: 1,
})
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW)
})

type Capture = { file: string; node: string; viewport: string; state: string }
const captures: Capture[] = []
test.afterAll(() => {
  writeFileSync(`${OUT}/captures.json`, JSON.stringify(captures, null, 2))
})

const sizes = {
  desktop: [1440, 1000],
  tablet: [834, 1194],
  phone: [390, 844],
} as const
type Device = keyof typeof sizes

const nodes = {
  tiles: { desktop: '21:1982 (viewport 27:2765)', tablet: '630:6182', phone: '630:7204' },
  list: { desktop: '21:1753 (viewport 21:1825)', tablet: '630:6708', phone: '630:7726' },
  normal: { desktop: '199:11280 (viewport 220:2548)', tablet: '220:2755', phone: '220:2970' },
  error: { desktop: '226:8826', tablet: '226:10670', phone: '226:10126' },
  saving: { desktop: '226:9036', tablet: '226:10838', phone: '226:10293' },
  loading: { desktop: '226:9242', tablet: '226:11002', phone: '226:10456' },
  menu: { desktop: '—', tablet: '630:8277', phone: '630:8361' },
} as const

/** Замеры оболочки в координатах документа: сверка с геометрией Figma из ТЗ. */
async function measure(page: Page, file: string): Promise<void> {
  const geometry = await page.evaluate(() => {
    const box = (element: Element | null | undefined) => {
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return {
        x: Math.round(rect.left),
        y: Math.round(rect.top + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }
    }
    const visible = (element: Element) => (element as HTMLElement).offsetParent !== null
    const main = document.querySelector('main#main')
    const dialog = document.querySelector('[role="dialog"]')
    const aside = document.querySelector('aside')
    // Шапка приложения — вне содержимого: заголовок страницы внутри `main` не считается.
    const appBar = [...document.querySelectorAll('header')].find(
      (element) => visible(element) && !element.closest('main'),
    )
    const named = (root: ParentNode | null, label: string) =>
      [...(root?.querySelectorAll(`[aria-label="${label}"], a, button`) ?? [])].find(
        (element) =>
          visible(element) &&
          (element.getAttribute('aria-label') === label ||
            element.textContent?.trim().replace(/\s+/g, ' ') === label),
      )
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      appBar: appBar ? box(appBar) : null,
      context: box(main?.firstElementChild),
      firstContent: box(main?.children[1]),
      sidebar: aside && visible(aside) ? box(aside) : null,
      sidebarNav: aside && visible(aside) ? box(aside.querySelector('nav')) : null,
      sidebarNavRows:
        aside && visible(aside)
          ? [...aside.querySelectorAll('nav a')].map((element) => box(element)?.height)
          : [],
      sidebarWorkspace: aside && visible(aside) ? box(aside.lastElementChild) : null,
      account: box(named(document, 'Аккаунт →') ?? named(document, 'Аккаунт →')),
      accountCircle: box(
        [...document.querySelectorAll('a[aria-label^="Аккаунт"]')].find(visible) ?? null,
      ),
      settings: box(named(document, 'Настройки')),
      logout: box(named(document, 'Выйти')),
      viewSwitch: box(
        [...document.querySelectorAll('[aria-label="Представление"]')].find(visible) ?? null,
      ),
      drawer: box(dialog),
      drawerRows: dialog
        ? [...dialog.querySelectorAll('nav a')].map((element) => box(element)?.height)
        : [],
      drawerWorkspace: box(dialog?.querySelector('nav')?.nextElementSibling),
      drawerScroll: dialog
        ? (() => {
            const scroller = dialog.querySelector('.overflow-y-auto')
            return scroller
              ? { scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight }
              : null
          })()
        : null,
    }
  })
  writeFileSync(`${OUT}/actual/${file}.geometry.json`, JSON.stringify(geometry, null, 2))
}

/** `full` — кадр всей страницы; `in-place` — окно как есть: фокус и прокрутка сохраняются. */
async function shoot(
  page: Page,
  file: string,
  node: string,
  state: string,
  full: boolean | 'in-place' = true,
) {
  if (full === 'in-place') await settleInPlace(page)
  else await settle(page)
  if (full === true) await fullShot(page, `${OUT}/actual/${file}.png`)
  else await page.screenshot({ path: `${OUT}/actual/${file}.png` })
  await measure(page, file)
  const { width, height } = page.viewportSize()!
  captures.push({ file, node, viewport: `${width}×${height}`, state })
}

async function openFeed(page: Page): Promise<void> {
  await page.goto('/radar')
  await page.getByRole('list', { name: 'Список активных рисков' }).waitFor()
  await page.getByText('281 000').first().waitFor()
  await page
    .getByText(/Полировка кузова · Тверская/)
    .first()
    .waitFor()
  await waitRealtimeSettled(page)
  await page.getByText('Это все активные риски по выбранным фильтрам.').waitFor()
}

async function openDetail(page: Page, ready = true): Promise<void> {
  await page.goto(`/risks/${RISK_ID}`)
  await waitRealtimeSettled(page)
  if (!ready) return
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.getByText('Сделка создана').waitFor()
  await page
    .getByText(/Полировка кузова · Тверская/)
    .first()
    .waitFor()
}

/** Пользователь и организации для крайних данных: длинные имена, несколько членств. */
async function mockMe(
  page: Page,
  displayName: string,
  memberships: { tenantId: string; organizationName: string; role: string }[],
): Promise<void> {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: USER_ID,
          email: 'owner@example.test',
          displayName,
          status: 'ACTIVE',
          createdAt: '2026-09-01T09:00:00Z',
          updatedAt: '2026-09-01T09:00:00Z',
        },
        memberships,
        canCreateOrganization: false,
      }),
    }),
  )
}

for (const device of Object.keys(sizes) as Device[]) {
  const [width, height] = sizes[device]

  test(`feed-tiles-${device}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await owner(page)
    await openFeed(page)
    await shoot(page, `feed-tiles-${device}`, nodes.tiles[device], 'лента, плитки, 12 рисков')
  })

  test(`feed-list-${device}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await owner(page)
    // На телефоне переключателя нет: сохранённый выбор «Список» задаётся заранее и даёт карточки.
    await page.addInitScript(() => localStorage.setItem('lidradar.radar.view', 'list'))
    await openFeed(page)
    await shoot(page, `feed-list-${device}`, nodes.list[device], 'лента, сохранён «Список»')
  })

  test(`detail-normal-${device}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await owner(page)
    await openDetail(page)
    await shoot(page, `detail-normal-${device}`, nodes.normal[device], 'деталь, исходное')
  })

  test(`detail-error-${device}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await owner(page)
    await page.route(`**/api/v1/risks/${RISK_ID}/actions`, (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'CONFLICT', message: '', traceId: 'visual' } }),
      }),
    )
    await openDetail(page)
    await page.getByLabel('Что вы сделали').selectOption('CALL')
    await page.getByRole('button', { name: 'Записать действие' }).click()
    await page.locator('[role="alert"], .text-danger-ink').first().waitFor()
    await shoot(page, `detail-error-${device}`, nodes.error[device], 'деталь, ошибка записи (409)')
  })

  test(`detail-saving-${device}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await owner(page)
    await page.route(`**/api/v1/risks/${RISK_ID}/actions`, () => new Promise(() => {}))
    await openDetail(page)
    await page.getByLabel('Что вы сделали').selectOption('CALL')
    await page.getByRole('button', { name: 'Записать действие' }).click()
    await page.locator('button[aria-busy="true"]').first().waitFor()
    await shoot(page, `detail-saving-${device}`, nodes.saving[device], 'деталь, запись действия')
  })

  test(`detail-loading-${device}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await owner(page)
    await page.route(`**/api/v1/risks/${RISK_ID}`, () => new Promise(() => {}))
    await openDetail(page, false)
    await page.getByRole('status', { name: 'Загрузка риска' }).waitFor()
    await shoot(page, `detail-loading-${device}`, nodes.loading[device], 'деталь, первая загрузка')
  })

  if (device !== 'desktop') {
    test(`menu-${device}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await owner(page)
      await openFeed(page)
      await page.getByRole('button', { name: 'Меню' }).click()
      await page.getByRole('dialog', { name: 'Меню' }).waitFor()
      await page.getByText('2 точки').filter({ visible: true }).waitFor()
      await shoot(page, `menu-${device}`, nodes.menu[device], 'меню открыто на ленте', false)
    })
  }

  test(`long-names-${device}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await owner(page)
    await mockMe(page, 'Александра Константиновна Преображенская-Длиннофамильная', [
      {
        tenantId: TENANT_ID,
        organizationName: 'Сеть детейлинг-студий «Блик Премиум Сервис» на Тверской и в Хамовниках',
        role: 'OWNER',
      },
    ])
    await openFeed(page)
    await shoot(page, `long-names-${device}`, nodes.tiles[device], 'длинные имя и организация')
    if (device !== 'desktop') {
      await page.getByRole('button', { name: 'Меню' }).click()
      await page.getByRole('dialog', { name: 'Меню' }).waitFor()
      await shoot(
        page,
        `long-names-menu-${device}`,
        nodes.menu[device],
        'меню, длинные имена',
        false,
      )
    }
  })

  test(`workspaces-${device}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await owner(page)
    await mockMe(page, 'Мария Владелец', [
      { tenantId: TENANT_ID, organizationName: 'Студия «Блик»', role: 'OWNER' },
      { tenantId: SECOND_TENANT_ID, organizationName: 'Кофейня «Зерно»', role: 'MANAGER' },
    ])
    await page.addInitScript(
      ([user, tenant]) => localStorage.setItem(`lidradar.tenant.${user}`, tenant!),
      [USER_ID, TENANT_ID],
    )
    await openFeed(page)
    if (device !== 'desktop') {
      await page.getByRole('button', { name: 'Меню' }).click()
      await page.getByRole('dialog', { name: 'Меню' }).waitFor()
    }
    await page.getByRole('combobox', { name: 'Рабочее пространство' }).waitFor()
    await shoot(
      page,
      `workspaces-${device}`,
      nodes.menu[device],
      'два членства: переключатель',
      false,
    )
  })
}

test('phone-320 лента, деталь и меню', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await owner(page)
  await openFeed(page)
  await shoot(page, 'feed-tiles-320', nodes.tiles.phone, '320 px, лента')
  await page.getByRole('button', { name: 'Меню' }).click()
  await page.getByRole('dialog', { name: 'Меню' }).waitFor()
  await shoot(page, 'menu-320', nodes.menu.phone, '320 px, меню', false)
  await page.keyboard.press('Escape')
  await openDetail(page)
  await shoot(page, 'detail-normal-320', nodes.normal.phone, '320 px, деталь')
})

test('zoom-200 desktop 1440 × 1000 при увеличении 200 %', async ({ page }) => {
  // 200 % в окне 1440 × 1000 — CSS-окно 720 × 500 при плотности 2.
  await page.setViewportSize({ width: 720, height: 500 })
  await owner(page)
  await openFeed(page)
  await shoot(page, 'zoom200-feed', nodes.tiles.tablet, 'CSS 720×500 (200 %)', false)
  await openDetail(page)
  await shoot(page, 'zoom200-detail', nodes.normal.tablet, 'CSS 720×500 (200 %), деталь', false)
})

test('desktop-short: низкое окно — рабочее пространство под разделами', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 420 })
  await owner(page)
  await openFeed(page)
  await shoot(page, 'desktop-short', nodes.tiles.desktop, '1440×420', false)
  await page.locator('aside').evaluate((aside) => aside.scrollTo(0, aside.scrollHeight))
  await page.screenshot({ path: `${OUT}/actual/desktop-short-scrolled.png` })
  captures.push({
    file: 'desktop-short-scrolled',
    node: nodes.tiles.desktop,
    viewport: '1440×420',
    state: 'боковая колонка прокручена вниз',
  })
})

for (const device of ['desktop', 'phone'] as const) {
  test(`transitions-${device}: аккаунт и настройки`, async ({ page }) => {
    const [width, height] = sizes[device]
    await page.setViewportSize({ width, height })
    // Штатный мок e2e: у набора F02 нет данных страниц настроек.
    await mockOwner(page)
    await page.goto('/radar')
    await page.getByRole('heading', { name: 'Radar' }).waitFor()
    await page
      .getByRole('link', { name: /^Аккаунт/ })
      .filter({ visible: true })
      .click()
    await page.waitForURL(/\/account$/)
    await page.getByRole('button', { name: 'Выйти' }).waitFor()
    await shoot(page, `account-${device}`, '—', 'переход «Аккаунт» из шапки Radar', false)
    await page.goto('/radar')
    await page.getByRole('heading', { name: 'Radar' }).waitFor()
    await page.getByRole('link', { name: 'Настройки' }).filter({ visible: true }).click()
    await page.waitForURL(/\/settings/)
    await page.getByRole('heading').filter({ visible: true }).first().waitFor()
    await shoot(page, `settings-${device}`, '—', 'переход «Настройки» из шапки Radar', false)
  })
}

/**
 * Видимый фокус (AC-16): кадры окна с фокусом на элементах шапки, колонки и меню.
 * Первое нажатие Tab включает клавиатурный режим, иначе `:focus-visible` не рисуется.
 */
async function focusShot(page: Page, target: Locator, file: string, node: string, state: string) {
  await target.focus()
  await expect(target).toBeFocused()
  expect(await target.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
  await shoot(page, file, node, state, 'in-place')
}

for (const device of Object.keys(sizes) as Device[]) {
  test(`focus-${device}: видимый фокус шапки и меню`, async ({ page }) => {
    const [width, height] = sizes[device]
    await page.setViewportSize({ width, height })
    await owner(page)
    await openFeed(page)
    await page.keyboard.press('Tab')
    const visible = (locator: Locator) => locator.filter({ visible: true }).first()
    const account = visible(page.getByRole('link', { name: /^Аккаунт/ }))
    const settings = visible(page.getByRole('link', { name: 'Настройки' }))
    const node = nodes.tiles[device]
    if (device === 'desktop') {
      const radar = page.locator('aside').getByRole('link', { name: 'Radar' })
      await focusShot(page, radar, 'focus-desktop-nav', node, 'фокус: раздел Radar в колонке')
      await focusShot(page, account, 'focus-desktop-account', node, 'фокус: «Аккаунт →»')
      await focusShot(page, settings, 'focus-desktop-settings', node, 'фокус: настройки')
      const logout = page.getByRole('button', { name: 'Выйти' })
      await focusShot(page, logout, 'focus-desktop-logout', node, 'фокус: «Выйти»')
      return
    }
    const trigger = page.getByRole('button', { name: 'Меню' })
    await focusShot(page, trigger, `focus-${device}-menu-trigger`, node, 'фокус: кнопка меню')
    await focusShot(page, account, `focus-${device}-account`, node, 'фокус: аккаунт')
    await focusShot(page, settings, `focus-${device}-settings`, node, 'фокус: настройки')
    await trigger.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('dialog', { name: 'Меню' })
    await menu.waitFor()
    const close = menu.getByRole('button', { name: 'Закрыть' })
    await focusShot(page, close, `focus-${device}-close`, nodes.menu[device], 'фокус: закрыть меню')
    await page.keyboard.press('Tab')
    await shoot(
      page,
      `focus-${device}-menu-row`,
      nodes.menu[device],
      'фокус: первый раздел',
      'in-place',
    )
  })
}

test('phone-320 окна: карточки внизу ленты и деталь без сжатия', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await owner(page)
  await openFeed(page)
  await page.getByText('Неизвестна').first().scrollIntoViewIfNeeded()
  await shoot(
    page,
    'feed-unknown-320',
    nodes.tiles.phone,
    '320×640, карточка без суммы',
    'in-place',
  )
  await page
    .getByRole('link', { name: /Разобрать риск/ })
    .last()
    .scrollIntoViewIfNeeded()
  await shoot(page, 'feed-bottom-320', nodes.tiles.phone, '320×640, низ ленты', 'in-place')
  await openDetail(page)
  await shoot(page, 'detail-top-320', nodes.normal.phone, '320×640, верх детали', 'in-place')
})

test('phone: сообщение об ошибке и запись действия крупно', async ({ page }) => {
  const [width, height] = sizes.phone
  await page.setViewportSize({ width, height })
  await owner(page)
  let fail = true
  await page.route(`**/api/v1/risks/${RISK_ID}/actions`, (route) =>
    fail
      ? route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'CONFLICT', message: '', traceId: 'visual' } }),
        })
      : new Promise(() => {}),
  )
  await openDetail(page)
  const submit = page.getByRole('button', { name: 'Записать действие' })
  await page.getByLabel('Что вы сделали').selectOption('CALL')
  await submit.scrollIntoViewIfNeeded()
  await shoot(page, 'detail-form-before-phone', nodes.saving.phone, 'форма до записи', 'in-place')
  await submit.click()
  const message = page.locator('[role="alert"], .text-danger-ink').first()
  await message.waitFor()
  await message.scrollIntoViewIfNeeded()
  await shoot(
    page,
    'detail-error-message-phone',
    nodes.error.phone,
    'сообщение 409 в окне',
    'in-place',
  )
  fail = false
  await submit.click()
  const busy = page.locator('button[aria-busy="true"]').first()
  await busy.waitFor()
  await busy.scrollIntoViewIfNeeded()
  await shoot(page, 'detail-busy-phone', nodes.saving.phone, 'кнопка в записи', 'in-place')
})
