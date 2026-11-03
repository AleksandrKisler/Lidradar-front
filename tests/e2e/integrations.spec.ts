import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page, type Route } from '@playwright/test'
import type { components } from '../../src/shared/api/generated/schema'
import { keepEventStreamOpen, mockOwner, TENANT_ID } from './fixtures/api'

type Connection = components['schemas']['ChannelConnection']
type Health = components['schemas']['ConnectionHealth']
const artifact =
  process.env.INTEGRATIONS_ARTIFACT_DIR ??
  `artifacts/frontend-v2/integrations-redesign-2026-11-03/browser-run-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
const fixedTime = '2026-10-25T11:30:00Z'
const locationId = '01990000-0000-7000-8000-000000000201'
const connectionId = '01990000-0000-7000-8000-000000000901'
const token = '123456789:AAHf1234567890abcdefghijklmnop'
const viewports = [
  ['Desktop', 1440, 1000],
  ['Tablet', 834, 1194],
  ['Mobile', 390, 844],
] as const

// Ни failure screenshot, ни trace/video не должны сохранить заполненный токен.
test.use({
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  trace: 'off',
  video: 'off',
  screenshot: 'off',
})

function source(overrides: Partial<Connection> = {}): Connection {
  return {
    id: connectionId,
    locationId,
    provider: 'CONNECTED_BUSINESS_BOT',
    name: 'Telegram · переписка клиентов',
    status: 'ACTIVE',
    capabilities: ['CAN_RECEIVE_MESSAGES'],
    lastEventAt: '2026-10-25T11:20:00Z',
    lastSuccessAt: '2026-10-25T11:20:00Z',
    lastErrorAt: null,
    lastErrorCode: null,
    createdAt: '2026-10-20T09:00:00Z',
    updatedAt: fixedTime,
    ...overrides,
  }
}
function health(connection: Connection): Health {
  return {
    status: connection.status,
    lastEventAt: connection.lastEventAt,
    lastSuccessAt: connection.lastSuccessAt,
    lastErrorAt: connection.lastErrorAt,
    lastErrorCode: connection.lastErrorCode,
    checkedAt: '2026-10-25T11:25:00Z',
  }
}
function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const fail = (route: Route, code = 'INTEGRATION_TEST_FAILURE', status = 422) =>
  json(route, { error: { code, traceId: 'integrations-synthetic' } }, status)
interface State {
  items: Connection[]
  listError: boolean
  notificationError: boolean
  notificationGate: ReturnType<typeof gate> | null
  linked: boolean
  listGate: ReturnType<typeof gate> | null
  checkGate: ReturnType<typeof gate> | null
  connectGate: ReturnType<typeof gate> | null
  checkError: boolean
  checkStatus: Connection['status']
  verification: 'REMOTE' | 'LOCAL'
  deleteMode: 'partial' | 'success' | 'network'
  connectError: 'CHANNEL_ALREADY_CONNECTED' | 'CHANNEL_CREDENTIALS_REJECTED' | null
  connectStatus: Connection['status']
  reads: number
  checks: number
  deletes: number
  connects: number
  notificationReads: number
  healthReads: number
}

async function setup(page: Page, role: 'OWNER' | 'MANAGER' = 'OWNER'): Promise<State> {
  await mockOwner(page, { role })
  await keepEventStreamOpen(page)
  await page.clock.setFixedTime(new Date(fixedTime))
  const state: State = {
    items: [source()],
    listError: false,
    notificationError: false,
    notificationGate: null,
    linked: false,
    listGate: null,
    checkGate: null,
    connectGate: null,
    checkError: false,
    checkStatus: 'ACTIVE',
    verification: 'REMOTE',
    deleteMode: 'success',
    connectError: null,
    connectStatus: 'ACTIVE',
    reads: 0,
    checks: 0,
    deletes: 0,
    connects: 0,
    notificationReads: 0,
    healthReads: 0,
  }
  await page.route('**/api/v1/integrations**', async (route) => {
    expect(route.request().headers()['x-tenant-id']).toBe(TENANT_ID)
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (path.endsWith('/connect')) {
      state.connects++
      if (state.connectGate) await state.connectGate.promise
      if (state.connectError)
        return fail(
          route,
          state.connectError,
          state.connectError === 'CHANNEL_ALREADY_CONNECTED' ? 409 : 400,
        )
      const body = route.request().postDataJSON() as { name: string; locationId: string | null }
      const created = source({
        name: body.name,
        locationId: body.locationId,
        status: state.connectStatus,
        lastErrorCode: state.connectStatus === 'ERROR' ? 'TELEGRAM_CONFIGURATION_REQUIRED' : null,
      })
      state.items = [created]
      return json(route, { ...created, webhookSecret: null }, 201)
    }
    if (method === 'DELETE') {
      state.deletes++
      if (state.deleteMode === 'network') return route.abort('failed')
      state.items = state.items.map((item) => ({ ...item, status: 'DISCONNECTED' }))
      if (state.deleteMode === 'partial') return fail(route, 'CONNECTOR_UNAVAILABLE', 503)
      return route.fulfill({ status: 204 })
    }
    if (path.endsWith('/health/check')) {
      state.checks++
      if (state.checkGate) await state.checkGate.promise
      if (state.checkError) return fail(route, 'CONNECTOR_UNAVAILABLE', 503)
      return json(route, {
        verification: state.verification,
        health: {
          ...health(state.items[0]!),
          status: state.checkStatus,
          checkedAt: fixedTime,
          lastErrorCode: state.checkStatus === 'ERROR' ? 'TELEGRAM_WEBHOOK_MISMATCH' : null,
        },
      })
    }
    if (path.endsWith('/health')) {
      state.healthReads++
      return json(route, health(state.items[0]!))
    }
    state.reads++
    if (state.listGate) await state.listGate.promise
    return state.listError ? fail(route) : json(route, { items: state.items })
  })
  await page.route('**/api/v1/notifications/telegram-link', async (route) => {
    expect(route.request().headers()['x-tenant-id']).toBe(TENANT_ID)
    state.notificationReads++
    if (state.notificationGate) await state.notificationGate.promise
    return state.notificationError
      ? fail(route)
      : json(route, {
          linked: state.linked,
          linkedAt: state.linked ? '2026-10-25T10:00:00Z' : null,
        })
  })
  return state
}
const card = (page: Page) => page.locator(`[data-connection-id="${connectionId}"]`)
const refresh = (page: Page) =>
  page.getByRole('button', { name: 'Обновить источники', exact: true })
const notifications = (page: Page) =>
  page.getByRole('region', { name: 'Личные уведомления в Telegram' })
const connectTrigger = (page: Page) =>
  page.getByRole('button', { name: 'Подключить Telegram', exact: true })
const sheetOverlays = (page: Page) => page.locator('.fixed.inset-0.z-40[data-state="open"]')
const connectDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Подключить Telegram', exact: true })
async function loaded(page: Page) {
  await expect(page.getByRole('heading', { name: 'Интеграции', exact: true })).toBeVisible()
  await expect(card(page)).toBeVisible()
  await expect(refresh(page)).toBeEnabled()
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
}
async function assertLayout(page: Page, width: number) {
  const sourceBounds = (await card(page).boundingBox())!
  const helpBounds = (await page
    .getByRole('complementary', { name: 'Справка об источниках' })
    .boundingBox())!
  if (width >= 1280) {
    expect(helpBounds.x).toBeGreaterThan(sourceBounds.x + sourceBounds.width)
    expect(helpBounds.y).toBeCloseTo(sourceBounds.y, 0)
  } else expect(helpBounds.y).toBeGreaterThan(sourceBounds.y + sourceBounds.height)
  const check = (await card(page)
    .getByRole('button', { name: 'Проверить связь', exact: true })
    .boundingBox())!
  const instruction = (await card(page)
    .getByRole('button', { name: 'Инструкция', exact: true })
    .boundingBox())!
  const disconnect = (await card(page)
    .getByRole('button', { name: 'Отключить', exact: true })
    .boundingBox())!
  if (width < 768) {
    expect(check.y + check.height).toBeLessThanOrEqual(instruction.y)
    expect(check.x).toBeCloseTo(instruction.x, 0)
    expect(check.width).toBeGreaterThan(instruction.width + disconnect.width)
  } else expect(check.y).toBeCloseTo(instruction.y, 0)
  expect(instruction.y).toBeCloseTo(disconnect.y, 0)
  const badge = card(page).getByTestId('source-status')
  expect((await badge.boundingBox())!.height).toBeGreaterThanOrEqual(28)
  const icon = (await badge.locator('img').boundingBox())!
  expect(icon.width).toBe(14)
  expect(icon.height).toBe(14)
}
async function assertHeaderConnect(page: Page, width: number) {
  if (width < 1024) {
    const title = (await page
      .getByRole('heading', { name: 'Интеграции', exact: true })
      .boundingBox())!
    const refreshBounds = (await refresh(page).boundingBox())!
    const description = (await page
      .getByText('Переписка клиентов и личные уведомления — два независимых подключения.', {
        exact: true,
      })
      .boundingBox())!
    expect(refreshBounds.height).toBe(46)
    expect(
      description.y - Math.max(title.y + title.height, refreshBounds.y + refreshBounds.height),
    ).toBeCloseTo(24, 0)
  }
  const trigger = page
    .locator('.integrations-toolbar')
    .getByRole('button', { name: 'Подключить Telegram', exact: true })
  await expect(trigger).toHaveCount(1)
  await expect(trigger).toBeVisible()
  await expect(trigger).toBeEnabled()
  const heading = (await page
    .getByRole('heading', { name: 'Источники сообщений', exact: true })
    .boundingBox())!
  const cta = (await trigger.boundingBox())!
  expect(cta.height).toBe(46)
  if (width < 768) {
    expect(cta.y).toBeGreaterThanOrEqual(heading.y + heading.height)
    expect(cta.x).toBeCloseTo(heading.x, 0)
  } else expect(cta.x).toBeGreaterThan(heading.x + heading.width)
}
async function assertStatusAboveToolbar(page: Page, status: Locator) {
  const statusBounds = (await status.boundingBox())!
  const toolbarBounds = (await page.locator('.integrations-toolbar').boundingBox())!
  expect(statusBounds.y + statusBounds.height).toBeLessThanOrEqual(toolbarBounds.y)
  expect(await status.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe('0px')
}
async function assertEmptyConnect(page: Page) {
  await expect(
    page
      .locator('.integrations-toolbar')
      .getByRole('button', { name: 'Подключить Telegram', exact: true }),
  ).toHaveCount(0)
  const inside = page
    .locator('.integration-empty')
    .getByRole('button', { name: 'Подключить Telegram', exact: true })
  await expect(inside).toHaveCount(1)
  await expect(connectTrigger(page)).toHaveCount(1)
  await expect(inside).toBeVisible()
  await expect(inside).toBeEnabled()
  const logo = inside.locator('img')
  await expect(logo).toHaveCount(1)
  const rect = (await logo.boundingBox())!
  expect(rect.width).toBe(20)
  expect(rect.height).toBe(20)
}
async function settleFiniteTransitions(page: Page) {
  const settled = await page.evaluate(async () => {
    let waitedTransitions = 0
    const pending = () =>
      document.getAnimations().filter((animation) => {
        const endTime = animation.effect?.getComputedTiming().endTime
        return (
          animation instanceof CSSTransition &&
          animation.playState === 'running' &&
          typeof endTime === 'number' &&
          Number.isFinite(endTime)
        )
      })
    for (let pass = 0; pass < 4; pass++) {
      // Force style calculation before collecting transitions created by the latest Vue state.
      for (const control of document.querySelectorAll(
        '.integrations-page button, [role="dialog"] button',
      )) {
        void getComputedStyle(control).color
      }
      const transitions = pending()
      if (!transitions.length) return { waitedTransitions, pendingFiniteTransitions: 0 }
      waitedTransitions += transitions.length
      await Promise.allSettled(transitions.map((transition) => transition.finished))
    }
    return { waitedTransitions, pendingFiniteTransitions: pending().length }
  })
  expect(settled.pendingFiniteTransitions).toBe(0)
  return settled
}
interface CaptureOptions {
  viewportOnly?: boolean
  preserveScroll?: boolean
  guide?: {
    currentStepNo: number
    platform: string
    scrollFocus: string
    scrollTop: number
    stepRect: { x: number; y: number; width: number; height: number }
    illustrationRect: { x: number; y: number; width: number; height: number }
    bodyRect: { x: number; y: number; width: number; height: number }
    fullStepFits: boolean
    illustrationFullyVisible: boolean
  }
}
async function capture(page: Page, state: string, device: string, options: CaptureOptions = {}) {
  await page.evaluate(() => document.fonts.ready)
  if (!options.preserveScroll) {
    // Narrow guide visuals mount only after the async asset map resolves; ol16 alone is not ready.
    const narrowGuide = page.locator(
      'ol[data-guide-layout="mobile"], ol[data-guide-layout="tablet"]',
    )
    if (await narrowGuide.count())
      await expect(narrowGuide.locator('.integration-guide-visual')).toHaveCount(16)
    // Once every visual exists, wait for real paths before collecting lazy images.
    await expect
      .poll(() =>
        page
          .locator('img')
          .evaluateAll((images) => images.every((image) => Boolean(image.getAttribute('src')))),
      )
      .toBe(true)
    // Only the initial guide capture loads every lazy image and returns to the top.
    for (const image of await page.locator('img[loading="lazy"]').all())
      await image.scrollIntoViewIfNeeded()
    await page.locator('.sheet-body').evaluateAll((bodies) =>
      bodies.forEach((body) => {
        body.scrollTop = 0
      }),
    )
    await expect
      .poll(() =>
        page
          .locator('img')
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
  }
  await noOverflow(page)
  const transitionSettlement = await settleFiniteTransitions(page)
  // Disable screenshot-time CSS motion so spinner/skeleton rasters do not use random phases.
  // The state model and request gates remain active; only finite CSSTransition.finished is awaited.
  const images: Array<{ name: string; sha256: string }> = []
  if (!options.viewportOnly) {
    const full = await page.screenshot({
      path: `${artifact}/${state}-${device}.png`,
      fullPage: true,
      animations: 'disabled',
    })
    images.push({
      name: `${state}-${device}.png`,
      sha256: createHash('sha256').update(full).digest('hex'),
    })
  }
  const viewport = await page.screenshot({
    path: `${artifact}/${state}-${device}-viewport.png`,
    fullPage: false,
    animations: 'disabled',
  })
  images.push({
    name: `${state}-${device}-viewport.png`,
    sha256: createHash('sha256').update(viewport).digest('hex'),
  })
  const environment = await page.evaluate(() => {
    function rectOf(element: Element) {
      const rect = element.getBoundingClientRect()
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      }
    }
    function placement(element: Element) {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      const rendered =
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0' &&
        !element.closest('[hidden], .invisible')
      let left = Math.max(0, rect.left)
      let top = Math.max(0, rect.top)
      let right = Math.min(innerWidth, rect.right)
      let bottom = Math.min(innerHeight, rect.bottom)
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const parentStyle = getComputedStyle(parent)
        const parentRect = parent.getBoundingClientRect()
        if (/(auto|scroll|hidden|clip)/.test(parentStyle.overflowX)) {
          left = Math.max(left, parentRect.left)
          right = Math.min(right, parentRect.right)
        }
        if (/(auto|scroll|hidden|clip)/.test(parentStyle.overflowY)) {
          top = Math.max(top, parentRect.top)
          bottom = Math.min(bottom, parentRect.bottom)
        }
      }
      return {
        rendered: Boolean(rendered),
        inViewport:
          rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth,
        visible: Boolean(rendered) && right > left && bottom > top,
        clippedViewportRect: {
          x: left,
          y: top,
          width: Math.max(0, right - left),
          height: Math.max(0, bottom - top),
        },
        color: style.color,
        opacity: style.opacity,
        filter: style.filter,
      }
    }
    function slotOf(element: Element) {
      const source = element.closest('[data-connection-id]')
      const root = element.closest(
        '.integration-notifications, .integration-max, .integration-help, .integrations-heading, .integrations-toolbar, .integration-first-error, .integration-skeleton, [role="dialog"]',
      )
      const area = element.closest(
        '.source-status, .telegram-mark, .source-actions, .source-result, .integration-banner, .integration-notifications__pending, .integration-notifications__trigger, .integration-notifications__error',
      )
      return {
        scope: source
          ? 'source-card'
          : root?.getAttribute('role') === 'dialog'
            ? 'dialog'
            : (root?.classList[0] ?? 'shell'),
        connectionId: source?.getAttribute('data-connection-id') ?? null,
        area: area?.classList[0] ?? null,
      }
    }
    return {
      userAgent: navigator.userAgent,
      locale: navigator.language,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      deviceScaleFactor: window.devicePixelRatio,
      fontFamily: getComputedStyle(document.body).fontFamily,
      interLoaded: document.fonts.check('16px Inter'),
      // Только asset pathname/геометрия; DOM text, поля формы, storage и query string не читаются.
      renderedAssets: [...document.images].map((image) => {
        const url = new URL(image.currentSrc || image.src, location.origin)
        const assetPath = url.origin === location.origin ? url.pathname : null
        return {
          kind: 'img',
          assetPath,
          basename:
            assetPath?.split('/').at(-1) ??
            (url.protocol === 'data:' ? 'inline-data-image' : 'external-image'),
          alt: image.alt,
          widthAttribute: image.getAttribute('width'),
          heightAttribute: image.getAttribute('height'),
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          rect: rectOf(image),
          ...placement(image),
          slot: slotOf(image),
        }
      }),
      dialogOverlayGeometry: [
        ...document.querySelectorAll('.fixed.inset-0.z-40[data-state="open"]'),
      ].map((overlay) => ({
        rect: rectOf(overlay),
        ...placement(overlay),
        backgroundColor: getComputedStyle(overlay).backgroundColor,
      })),
      controlsGeometry: [
        ...document.querySelectorAll('.source-actions button, .integration-refresh'),
      ].map((control) => ({
        slot: slotOf(control),
        control:
          ['source-check', 'source-instruction', 'source-disconnect', 'integration-refresh'].find(
            (name) => control.classList.contains(name),
          ) ?? null,
        rect: rectOf(control),
        ...placement(control),
        backgroundColor: getComputedStyle(control).backgroundColor,
        webkitTextFillColor: getComputedStyle(control).webkitTextFillColor,
        disabled: control instanceof HTMLButtonElement && control.disabled,
        ariaBusy: control.getAttribute('aria-busy'),
      })),
      inlineSvgGeometry: [...document.querySelectorAll('svg')].map((svg) => ({
        kind: svg.classList.contains('animate-spin') ? 'spinner' : 'inline-svg',
        viewBox: svg.getAttribute('viewBox'),
        widthAttribute: svg.getAttribute('width'),
        heightAttribute: svg.getAttribute('height'),
        rect: rectOf(svg),
        ...placement(svg),
        slot: slotOf(svg),
      })),
    }
  })
  await writeFile(
    `${artifact}/${state}-${device}.json`,
    JSON.stringify(
      {
        state,
        device,
        viewport: page.viewportSize(),
        browser: { name: 'Chromium', version: page.context().browser()?.version() },
        ...environment,
        clock: fixedTime,
        tenantTimeZone: 'Europe/Moscow',
        fixture: 'mockOwner + integrations overrides; synthetic data only',
        sourceSnapshot:
          process.env.INTEGRATIONS_SNAPSHOT ??
          'development working tree; root freeze manifest required',
        transitionSettlement,
        capturePolicy: {
          finiteTransitions: 'CSSTransition.finished',
          screenshotAnimations: 'disabled',
          viewportOnly: options.viewportOnly === true,
          preserveScroll: options.preserveScroll === true,
        },
        ...(options.guide ? { guide: options.guide } : {}),
        images,
      },
      null,
      2,
    ),
  )
}
async function guideStepProof(step: Locator, stepStart = false) {
  return step.evaluate((element, stepStart) => {
    const body = element.closest('.sheet-body')
    const illustration = element.querySelector('button[aria-label^="Увеличить"]')
    if (!(body instanceof HTMLElement) || !(illustration instanceof HTMLElement))
      throw new Error('Guide step scroller/illustration missing')
    const rect = (node: Element) => {
      const box = node.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    }
    const fullStepFits = element.getBoundingClientRect().height <= body.clientHeight
    const target = stepStart || fullStepFits ? element : illustration
    // WebKit truncates fractional scroll offsets. Request the nearest CSS pixel so
    // the selected edge stays within the existing half-pixel alignment assertion.
    body.scrollTop = Math.round(
      body.scrollTop + target.getBoundingClientRect().top - body.getBoundingClientRect().top,
    )
    const bodyRect = body.getBoundingClientRect()
    const imageRect = illustration.getBoundingClientRect()
    return {
      currentStepNo: Number(element.id.replace('guide-step-', '')),
      platform: element.closest('ol')?.getAttribute('data-guide-platform') ?? 'unknown',
      scrollFocus: stepStart ? 'step-start' : fullStepFits ? 'whole-step' : 'illustration',
      scrollTop: body.scrollTop,
      stepRect: rect(element),
      illustrationRect: rect(illustration),
      bodyRect: rect(body),
      fullStepFits,
      illustrationFullyVisible:
        imageRect.top >= bodyRect.top && imageRect.bottom <= bodyRect.bottom,
    }
  }, stepStart)
}
async function captureGuideSteps(page: Page, guide: Locator, device: string, width: number) {
  const platform = await guide.locator('ol').getAttribute('data-guide-platform')
  expect(platform).toBe(width < 768 ? 'iPhone' : 'macOS')
  const jumps = guide.getByRole('navigation', { name: 'Этапы инструкции' }).getByRole('button')
  await expect(jumps).toHaveCount(4)
  const jumpRects = await Promise.all(
    (await jumps.all()).map(async (jump) => (await jump.boundingBox())!),
  )
  if (width < 768) {
    expect(jumpRects[0]!.y).toBeCloseTo(jumpRects[1]!.y, 0)
    expect(jumpRects[2]!.y).toBeCloseTo(jumpRects[3]!.y, 0)
    expect(jumpRects[2]!.y).toBeGreaterThan(jumpRects[0]!.y)
    for (const jump of await jumps.all()) await expect(jump).toHaveCSS('white-space', 'nowrap')
  } else for (const rect of jumpRects) expect(rect.y).toBeCloseTo(jumpRects[0]!.y, 0)
  if (width >= 768 && width < 1024) {
    const sheet = (await guide.boundingBox())!
    expect(sheet.y).toBeCloseTo(64, 0)
    expect(page.viewportSize()!.height - sheet.y - sheet.height).toBeCloseTo(64, 0)
    expect(
      (await guide
        .locator('#guide-step-1')
        .getByRole('button', { name: 'Увеличить скриншот шага 1', exact: true })
        .boundingBox())!.width,
    ).toBeGreaterThan(520)
  }
  // Measure every step independently before scrolling/capturing. CI font/scrollbar geometry
  // can make additional steps oversized, and each of them needs a real top proof.
  const mobileStepMeasurements =
    width < 768
      ? await guide.locator('ol > li').evaluateAll((steps) =>
          steps.map((step) => {
            const body = step.closest('.sheet-body')
            if (!(body instanceof HTMLElement)) throw new Error('Guide step scroller missing')
            return {
              stepNo: Number(step.id.replace('guide-step-', '')),
              height: step.getBoundingClientRect().height,
              bodyHeight: body.clientHeight,
            }
          }),
        )
      : []
  const oversizedMobileSteps = mobileStepMeasurements
    .filter((step) => step.height > step.bodyHeight)
    .map((step) => step.stepNo)
  if (width < 768) {
    expect(mobileStepMeasurements.map((step) => step.stepNo)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1),
    )
    for (const step of mobileStepMeasurements) {
      expect(step.height).toBeGreaterThan(0)
      expect(step.bodyHeight).toBeGreaterThan(0)
    }
    for (const mandatoryStep of [2, 5, 6, 14, 15, 16])
      expect(oversizedMobileSteps).toContain(mandatoryStep)
  }
  const mobileTopSteps: number[] = []
  for (let stepNo = 1; stepNo <= 16; stepNo++) {
    const step = guide.locator(`#guide-step-${stepNo}`)
    await expect(step).toHaveCount(1)
    const proof = await guideStepProof(step)
    expect(proof.currentStepNo).toBe(stepNo)
    expect(proof.platform).toBe(platform)
    await expect(
      step.getByRole('button', { name: `Увеличить скриншот шага ${stepNo}`, exact: true }),
    ).toBeInViewport({ ratio: 0.25 })
    await capture(page, `GuideStep${String(stepNo).padStart(2, '0')}`, device, {
      viewportOnly: true,
      preserveScroll: true,
      guide: proof,
    })
    if (width < 768 && !proof.fullStepFits) {
      const topProof = await guideStepProof(step, true)
      expect(topProof.currentStepNo).toBe(stepNo)
      expect(topProof.platform).toBe(platform)
      expect(topProof.fullStepFits).toBe(false)
      expect(topProof.scrollFocus).toBe('step-start')
      expect(topProof.stepRect.y).toBeCloseTo(topProof.bodyRect.y, 0)
      await capture(page, `GuideStep${String(stepNo).padStart(2, '0')}Top`, device, {
        viewportOnly: true,
        preserveScroll: true,
        guide: topProof,
      })
      mobileTopSteps.push(stepNo)
    }
  }
  if (width < 768) expect(mobileTopSteps).toEqual(oversizedMobileSteps)
}
async function confirm(page: Page): Promise<Locator> {
  await card(page).getByRole('button', { name: 'Отключить', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Отключить источник?', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

for (const [device, width, height] of viewports) {
  test(`интеграции: состояния и browser evidence ${device}`, async ({ page }) => {
    test.setTimeout(120_000)
    const state = await setup(page)
    await page.setViewportSize({ width, height })
    await page.goto('/integrations')
    await loaded(page)
    await expect(card(page).getByTestId('source-status')).toHaveText('Активно')
    await expect(card(page)).toContainText('14:20')
    await assertLayout(page, width)
    await assertHeaderConnect(page, width)
    await capture(page, 'Default', device)
    const instruction = card(page).getByRole('button', { name: 'Инструкция', exact: true })
    await instruction.focus()
    await page.keyboard.press('Enter')
    const guide = page.getByRole('dialog', { name: 'Подключение бота', exact: true })
    await expect(guide.locator('ol > li')).toHaveCount(16)
    await expect(sheetOverlays(page)).toHaveCount(1)
    await capture(page, 'Instruction', device)
    await captureGuideSteps(page, guide, device, width)
    const screenshotTrigger = guide.getByRole('button', {
      name: 'Увеличить скриншот шага 1',
      exact: true,
    })
    await screenshotTrigger.scrollIntoViewIfNeeded()
    await screenshotTrigger.click()
    const zoom = page.getByRole('dialog', { name: /^Шаг 1\./ })
    await expect(zoom).toBeVisible()
    await expect(sheetOverlays(page)).toHaveCount(1)
    const zoomHeaderClose = zoom
      .locator('header')
      .getByRole('button', { name: 'Закрыть', exact: true })
    const zoomFooterClose = zoom
      .locator('footer')
      .getByRole('button', { name: 'Закрыть', exact: true })
    await zoomFooterClose.focus()
    await page.keyboard.press('Tab')
    await expect(zoomHeaderClose).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(zoomFooterClose).toBeFocused()
    await zoomFooterClose.click()
    await expect(zoom).toHaveCount(0)
    await expect(screenshotTrigger).toBeFocused()
    await expect(sheetOverlays(page)).toHaveCount(1)
    await guide.getByRole('button', { name: 'Вернуться к подключению' }).click()
    await expect(instruction).toBeFocused()
    await expect(sheetOverlays(page)).toHaveCount(0)
    await instruction.click()
    await expect(guide).toBeVisible()
    await expect(sheetOverlays(page)).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(guide).toHaveCount(0)
    await expect(sheetOverlays(page)).toHaveCount(0)
    await expect(instruction).toBeFocused()
    await connectTrigger(page).click()
    await expect(sheetOverlays(page)).toHaveCount(1)
    await expect(connectDialog(page).getByLabel('Токен бота', { exact: true })).toBeEmpty()
    await capture(page, 'ConnectBlank', device)
    await connectDialog(page)
      .getByLabel('Название подключения', { exact: true })
      .fill('Черновик подключения')
    const detailed = connectDialog(page).getByRole('button', {
      name: 'Подробная инструкция со скриншотами',
      exact: true,
    })
    await detailed.click()
    await expect(sheetOverlays(page)).toHaveCount(1)
    const formGuide = page.getByRole('dialog', { name: 'Подключение бота', exact: true })
    await expect(formGuide.locator('ol')).toHaveAttribute(
      'data-guide-platform',
      width < 768 ? 'iPhone' : 'macOS',
    )
    await formGuide.getByRole('button', { name: 'Вернуться к подключению' }).click()
    await expect(detailed).toBeFocused()
    await expect(sheetOverlays(page)).toHaveCount(1)
    await expect(
      connectDialog(page).getByLabel('Название подключения', { exact: true }),
    ).toHaveValue('Черновик подключения')
    await expect(connectDialog(page).getByLabel('Токен бота', { exact: true })).toBeEmpty()
    await connectDialog(page).getByRole('button', { name: 'Отмена', exact: true }).click()
    await expect(sheetOverlays(page)).toHaveCount(0)
    const disconnectDialog = await confirm(page)
    await expect(disconnectDialog).toContainText('Сохранённые диалоги и риски останутся доступны')
    await capture(page, 'DisconnectConfirm', device)
    await disconnectDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    expect(state.deletes).toBe(0)
    state.linked = true
    await page.reload()
    await loaded(page)
    await expect(notifications(page)).toContainText('Подключены')
    await capture(page, 'Linked', device)
    for (const [name, item] of [
      ['NoEvents', source({ lastEventAt: null })],
      ['Degraded', source({ status: 'DEGRADED' })],
      ['Disconnected', source({ status: 'DISCONNECTED' })],
      [
        'SourceError',
        source({
          status: 'ERROR',
          lastErrorCode: 'TELEGRAM_WEBHOOK_MISMATCH',
          lastErrorAt: '2026-10-25T11:23:00Z',
        }),
      ],
    ] as const) {
      state.items = [item]
      await page.reload()
      await loaded(page)
      await expect(card(page).getByTestId('source-status')).toHaveText(
        name === 'NoEvents'
          ? 'Активно'
          : name === 'Degraded'
            ? 'Требует внимания'
            : name === 'Disconnected'
              ? 'Отключено'
              : 'Ошибка',
      )
      if (name === 'SourceError')
        await expect(card(page).getByRole('alert').locator('img, svg')).toHaveCount(0)
      if (name === 'Degraded') {
        const warning = card(page)
          .getByRole('status')
          .filter({ hasText: 'Подключение требует внимания' })
        expect(await warning.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe(
          '0px',
        )
      }
      await capture(page, name, device)
    }
    state.items = []
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Подключите первый источник' })).toBeVisible()
    await assertEmptyConnect(page)
    await capture(page, 'Empty', device)
    state.listError = true
    await refresh(page).click()
    await expect(page.getByText('Не удалось обновить источники', { exact: true })).toBeVisible()
    await assertEmptyConnect(page)
    state.listError = false
    await page
      .locator('.integration-refresh-error')
      .getByRole('button', { name: 'Повторить', exact: true })
      .click()
    await expect(page.getByText('Не удалось обновить источники', { exact: true })).toHaveCount(0)
    state.listError = true
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Не удалось загрузить источники' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Подключите первый источник' })).toHaveCount(0)
    await assertHeaderConnect(page, width)
    if (width < 768) {
      const retry = (await page
        .locator('.integration-first-error')
        .getByRole('button', { name: 'Повторить', exact: true })
        .boundingBox())!
      const error = (await page.locator('.integration-first-error').boundingBox())!
      expect(retry.x - error.x).toBeCloseTo(17, 0)
      expect(error.x + error.width - retry.x - retry.width).toBeCloseTo(17, 0)
    }
    await capture(page, 'FirstError', device)
    state.listError = false
    state.items = [source()]
    await page.getByRole('button', { name: 'Повторить', exact: true }).click()
    await loaded(page)
    state.listError = true
    await refresh(page).click()
    await expect(page.getByText('Не удалось обновить источники', { exact: true })).toBeVisible()
    await expect(card(page)).toBeVisible()
    await assertStatusAboveToolbar(
      page,
      page.getByRole('alert').filter({ hasText: 'Не удалось обновить источники' }),
    )
    await capture(page, 'RefreshError', device)
    state.listError = false
    await page
      .locator('.integration-refresh-error')
      .getByRole('button', { name: 'Повторить', exact: true })
      .click()
    await expect(page.getByText('Не удалось обновить источники', { exact: true })).toHaveCount(0)
    state.listGate = gate()
    await refresh(page).click()
    await expect(refresh(page)).toBeDisabled()
    await expect(card(page)).toBeVisible()
    await assertStatusAboveToolbar(
      page,
      page.getByRole('status').filter({ hasText: 'Обновляем состояние. Показаны прежние данные.' }),
    )
    const refreshingCaption = page.locator('.integration-refreshing > p')
    await expect(refreshingCaption).toHaveCSS('font-size', '12px')
    await expect(refreshingCaption).toHaveCSS('line-height', '18px')
    const refreshingSpinner = page.locator('.integration-refreshing svg')
    await expect(refreshingSpinner).toHaveCount(1)
    await expect(refreshingSpinner).toHaveCSS('width', '16px')
    await expect(refreshingSpinner).toHaveCSS('height', '16px')
    await expect(refreshingSpinner).toHaveCSS('color', 'rgb(0, 113, 227)')
    await capture(page, 'Refreshing', device)
    state.listGate.release()
    state.listGate = null
    await expect(refresh(page)).toBeEnabled()
    state.checkGate = gate()
    await card(page).getByRole('button', { name: 'Проверить связь', exact: true }).click()
    await expect(card(page).getByRole('button', { name: 'Проверяем…' })).toBeDisabled()
    await capture(page, 'Checking', device)
    expect(state.checks).toBe(1)
    await expect(card(page).getByRole('button', { name: 'Проверяем…' })).toHaveCSS(
      'color',
      'rgb(0, 113, 227)',
    )
    await expect(card(page).getByRole('button', { name: 'Отключить', exact: true })).toHaveCSS(
      'color',
      'rgb(86, 91, 100)',
    )
    state.checkGate.release()
    state.checkGate = null
    await expect(card(page)).toContainText('Связь с Telegram проверена')
    await capture(page, 'Remote', device)
    state.verification = 'LOCAL'
    await card(page).getByRole('button', { name: 'Проверить связь', exact: true }).click()
    await expect(card(page)).toContainText('Удалённая проверка не выполнялась')
    await expect(card(page).getByTestId('source-status')).toHaveClass(/source-status--neutral/)
    const localIcon = card(page).getByTestId('source-status').locator('img[src*=".svg"], svg')
    await expect(localIcon).toHaveCount(1)
    expect((await localIcon.boundingBox())!.width).toBe(14)
    expect((await localIcon.boundingBox())!.height).toBe(14)
    await capture(page, 'Local', device)
    state.checkError = true
    await card(page).getByRole('button', { name: 'Проверить связь', exact: true }).click()
    await expect(card(page).getByText('Не удалось проверить связь', { exact: true })).toBeVisible()
    await expect(card(page).getByTestId('source-status')).toHaveText('Активно')
    const errorBanner = card(page)
      .getByRole('alert')
      .filter({ hasText: 'Не удалось проверить связь' })
    const errorIcon = (await errorBanner.locator('img').boundingBox())!
    const errorText = (await errorBanner
      .getByText('Не удалось проверить связь', { exact: true })
      .boundingBox())!
    expect(errorIcon.width).toBe(20)
    expect(errorIcon.height).toBe(20)
    expect(errorIcon.x + errorIcon.width).toBeLessThan(errorText.x)
    await capture(page, 'CheckError', device)
    state.checkError = false
    state.deleteMode = 'partial'
    await (await confirm(page)).getByRole('button', { name: 'Отключить', exact: true }).click()
    await expect(card(page)).toContainText('Источник отключён в LidRadar')
    await expect(
      card(page).getByRole('button', { name: 'Проверить связь', exact: true }),
    ).toHaveCount(0)
    const retryDisconnect = (await card(page)
      .getByRole('button', { name: 'Повторить отключение', exact: true })
      .boundingBox())!
    const partialInstruction = (await card(page)
      .getByRole('button', { name: 'Инструкция', exact: true })
      .boundingBox())!
    expect(partialInstruction.y).toBeGreaterThanOrEqual(retryDisconnect.y + retryDisconnect.height)
    await capture(page, 'Partial', device)
    state.notificationError = true
    await page.reload()
    await loaded(page)
    await expect(notifications(page)).toContainText('Статус уведомлений недоступен')
    await capture(page, 'NotificationError', device)
    state.notificationError = false
    state.notificationGate = gate()
    state.items = [source()]
    await page.reload()
    await loaded(page)
    await expect(card(page).getByTestId('source-status')).toHaveText('Активно')
    await expect(
      notifications(page).getByRole('status', { name: 'Загружаем статус личных уведомлений' }),
    ).toBeVisible()
    await expect(notifications(page)).not.toContainText('Не подключены')
    await expect(notifications(page).getByText('Подключены', { exact: true })).toHaveCount(0)
    await expect(
      notifications(page).getByText('Уведомления в Telegram', { exact: true }),
    ).toBeVisible()
    const loadingBar = (await notifications(page)
      .locator('.integration-notifications__skeleton')
      .boundingBox())!
    expect(loadingBar.width).toBe(width < 768 ? 130 : 126)
    expect(loadingBar.height).toBe(width < 768 ? 18 : 14)
    await capture(page, 'NotificationLoading', device)
    state.notificationGate.release()
    state.notificationGate = null
    await expect(notifications(page)).toContainText('Подключены')
    await expect(
      notifications(page).getByRole('status', { name: 'Загружаем статус личных уведомлений' }),
    ).toHaveCount(0)
    state.listGate = gate()
    await page.reload()
    await expect(page.getByRole('status', { name: 'Загрузка источников' })).toBeVisible()
    await assertHeaderConnect(page, width)
    await capture(page, 'Skeleton', device)
    state.listGate.release()
    state.listGate = null
    await loaded(page)
  })
}

test('интеграции: connect validation, busy guard, отказ токена, 409 и 201 ERROR', async ({
  page,
}) => {
  const state = await setup(page)
  state.items = []
  await page.goto('/integrations')
  await connectTrigger(page).click()
  const dialog = connectDialog(page)
  await dialog.locator('button[type="submit"]').click()
  await expect(dialog).toContainText('Введите название подключения')
  await expect(dialog.locator('button[type="submit"]')).toBeEnabled()
  expect(state.connects).toBe(0)
  await dialog.getByLabel('Название подключения', { exact: true }).fill('Новая переписка')
  await dialog.getByLabel('Токен бота', { exact: true }).fill('invalid')
  await dialog.locator('button[type="submit"]').click()
  await expect(dialog).toContainText('Токен бота имеет вид')
  await expect(dialog.locator('button[type="submit"]')).toBeEnabled()
  expect(state.connects).toBe(0)
  for (const code of ['CHANNEL_CREDENTIALS_REJECTED', 'CHANNEL_ALREADY_CONNECTED'] as const) {
    state.connectError = code
    await dialog.getByLabel('Токен бота', { exact: true }).fill(token)
    state.connectGate = gate()
    const previous = state.connects
    const submitting = dialog.locator('button[type="submit"]').click()
    await expect.poll(() => state.connects).toBe(previous + 1)
    await expect(dialog.getByLabel('Токен бота', { exact: true })).toBeEmpty()
    await expect(dialog.getByRole('button', { name: 'Подключаем…', exact: true })).toBeDisabled()
    await dialog.locator('form').evaluate((form: HTMLFormElement) => {
      form.requestSubmit()
      form.requestSubmit()
    })
    expect(state.connects).toBe(previous + 1)
    state.connectGate.release()
    state.connectGate = null
    await submitting
    await expect(dialog).toContainText(
      code === 'CHANNEL_CREDENTIALS_REJECTED' ? 'Токен не принят' : 'Этот бот уже подключён',
    )
    await expect(dialog.locator('button[type="submit"]')).toBeEnabled()
    expect(state.connects).toBe(previous + 1)
    await expect(dialog.getByLabel('Название подключения', { exact: true })).toHaveValue(
      'Новая переписка',
    )
  }

  expect(state.connects).toBe(2)
  state.connectError = null
  state.connectStatus = 'ERROR'
  await dialog.getByLabel('Токен бота', { exact: true }).fill(token)

  await dialog.locator('button[type="submit"]').click()
  await expect(dialog).toContainText('Удалённая настройка не завершилась')
  await expect(dialog.locator('.bg-warning-pale')).toBeVisible()
  await expect(dialog).not.toContainText('Активно')
  await dialog.getByRole('button', { name: 'Готово', exact: true }).click()
  await connectTrigger(page).click()
  await expect(dialog.getByLabel('Токен бота', { exact: true })).toBeEmpty()
  await expect(dialog.getByLabel('Название подключения', { exact: true })).toBeEmpty()
})

test('интеграции: REMOTE учитывает ERROR, LOCAL не подтверждает Telegram и новые данные сохраняются', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto('/integrations')
  await loaded(page)
  state.checkStatus = 'ERROR'
  state.checkGate = gate()
  await card(page).getByRole('button', { name: 'Проверить связь', exact: true }).click()
  await expect(card(page)).toHaveAttribute('aria-busy', 'true')
  await expect(card(page).getByTestId('source-status')).toHaveText('Активно')
  await expect(card(page).getByRole('button', { name: 'Отключить', exact: true })).toBeDisabled()
  state.checkGate.release()
  state.checkGate = null
  await expect(card(page)).toContainText('Источник сообщил об ошибке')
  await expect(card(page).getByTestId('source-status')).toHaveText('Ошибка')
  // GET list/health ещё ACTIVE: POST check обязан сохранить более свежий результат.
  expect(state.items[0]!.status).toBe('ACTIVE')
  await expect(card(page)).not.toContainText('Связь с Telegram проверена')
  state.verification = 'LOCAL'
  state.checkStatus = 'ACTIVE'
  await card(page).getByRole('button', { name: 'Проверить связь', exact: true }).click()
  await expect(card(page)).toContainText('Показано сохранённое состояние')
  await expect(card(page)).not.toContainText('Связь с Telegram проверена')
})

test('интеграции: DELETE 503 память remount, retry204 и conservative reload; network не partial', async ({
  page,
}) => {
  const state = await setup(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/integrations')
  await loaded(page)
  await (await confirm(page)).getByRole('button', { name: 'Отмена', exact: true }).click()
  expect(state.deletes).toBe(0)
  state.deleteMode = 'network'
  await (await confirm(page)).getByRole('button', { name: 'Отключить', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Отключить источник?', exact: true })
  await expect(dialog).toContainText('Результат запроса неизвестен')
  await expect(card(page)).not.toContainText('Источник отключён в LidRadar')
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
  state.deleteMode = 'partial'
  await (await confirm(page)).getByRole('button', { name: 'Отключить', exact: true }).click()
  await expect(card(page)).toContainText('Удаление настройки у Telegram не подтверждено')
  await expect(
    card(page).getByRole('button', { name: 'Проверить связь', exact: true }),
  ).toHaveCount(0)
  await expect(card(page).getByRole('button', { name: 'Отключить', exact: true })).toHaveCount(0)
  // RouterLink покидает виджет без перезапуска JS, browser back восстанавливает scoped marker.
  await notifications(page).getByRole('link', { name: 'Настройки уведомлений' }).click()
  await expect(page).toHaveURL(/\/settings\/notifications$/)
  await page.goBack()
  await loaded(page)
  await expect(card(page)).toContainText('Источник отключён в LidRadar')
  state.deleteMode = 'success'
  await card(page).getByRole('button', { name: 'Повторить отключение', exact: true }).click()
  await expect(card(page)).toContainText(
    'Повтор выполнен. Удаление настройки у Telegram не подтверждено',
  )
  await expect(card(page).getByTestId('source-status')).toHaveText('Отключено')
  await page.reload()
  await loaded(page)
  await expect(card(page)).toContainText('Новые сообщения не поступают')
  await expect(
    card(page).getByRole('button', { name: 'Повторить отключение', exact: true }),
  ).toHaveCount(0)
  await expect(card(page)).not.toContainText('Удалено у Telegram')
  await expect(card(page)).not.toContainText('Источник отключён в LidRadar')
})

test('интеграции: личный retry не перечитывает и не скрывает источник', async ({ page }) => {
  const state = await setup(page)
  state.notificationError = true
  await page.goto('/integrations')
  await loaded(page)
  await expect(notifications(page)).toContainText('Статус уведомлений недоступен')
  const reads = state.reads
  const notificationReads = state.notificationReads
  state.notificationError = false
  state.linked = true
  await notifications(page).getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect(notifications(page)).toContainText('Подключены')
  expect(state.notificationReads).toBe(notificationReads + 1)
  expect(state.reads).toBe(reads)
  await expect(card(page).getByTestId('source-status')).toHaveText('Активно')
})

test('интеграции: manager direct URL не получает данные и пункт навигации', async ({ page }) => {
  const state = await setup(page, 'MANAGER')
  await page.goto('/integrations')
  await expect(page.getByRole('heading', { name: 'Раздел недоступен' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Интеграции', exact: true })).toHaveCount(0)
  expect(state.reads).toBe(0)
  expect(state.healthReads).toBe(0)
  expect(state.checks + state.deletes + state.connects).toBe(0)
  // Approved NoPermission содержит собственную независимую личную строку менеджера.
  expect(state.notificationReads).toBe(1)
  await expect(notifications(page).getByRole('status')).toContainText('Не подключены')
  await expect(
    notifications(page).getByRole('link', { name: 'Настройки уведомлений', exact: true }),
  ).toHaveAttribute('href', '/settings/notifications')
  await expect(page.getByRole('button', { name: 'Подключить Telegram', exact: true })).toHaveCount(
    0,
  )
  await expect(card(page)).toHaveCount(0)
  for (const [device, width, height] of viewports) {
    await page.setViewportSize({ width, height })
    await capture(page, 'NoPermission', device)
  }
})

test('интеграции: длинные названия и промежуточные ширины 320–1280 без overflow', async ({
  page,
}) => {
  const state = await setup(page)
  state.items = [
    source({
      name: 'Telegram · Очень длинное название подключения переписки клиентов организации с несколькими филиалами',
    }),
  ]
  await page.route('**/api/v1/locations', (route) =>
    json(route, {
      items: [
        {
          id: locationId,
          name: 'Очень длинное название точки обслуживания на Большой Тверской улице',
          active: true,
          timezone: 'Europe/Moscow',
          responseThresholdMinutes: 45,
          agreementThresholdMinutes: 120,
          createdAt: fixedTime,
          updatedAt: fixedTime,
        },
      ],
    }),
  )
  await page.goto('/integrations')
  await loaded(page)
  for (const width of [320, 600, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(card(page).getByRole('heading')).toContainText('Очень длинное название')
    await noOverflow(page)
    const check = card(page).getByRole('button', { name: 'Проверить связь', exact: true })
    const instruction = card(page).getByRole('button', { name: 'Инструкция', exact: true })
    const disconnect = card(page).getByRole('button', { name: 'Отключить', exact: true })
    for (const action of [check, instruction, disconnect]) {
      const bounds = await action.boundingBox()
      expect(bounds!.width).toBeGreaterThanOrEqual(44)
      expect(bounds!.height).toBeGreaterThanOrEqual(44)
    }
    await capture(page, 'LongNames', `Width${width}`)
  }
})

test('интеграции: delayed organization timezone не подменяется UTC при готовых источниках', async ({
  page,
}) => {
  const state = await setup(page)
  const organization = gate()
  await page.route('**/api/v1/organization', async (route) => {
    expect(route.request().headers()['x-tenant-id']).toBe(TENANT_ID)
    await organization.promise
    return route.fallback()
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/integrations')
  await loaded(page)
  await expect.poll(() => state.healthReads).toBe(1)
  const metadata = card(page).locator('.source-metadata dd')
  await expect(metadata).toHaveText([
    'Часовой пояс не загружен',
    'Часовой пояс не загружен',
    'Ещё не было',
  ])
  await expect(card(page).locator('.source-read')).toContainText('Часовой пояс не загружен')
  await expect(card(page)).not.toContainText('11:20')
  await expect(card(page)).not.toContainText('11:25')
  const check = card(page).getByRole('button', { name: 'Проверить связь', exact: true })
  await expect(check).toBeEnabled()
  await expect(card(page).getByRole('button', { name: 'Отключить', exact: true })).toBeEnabled()
  await check.click()
  await expect(card(page)).toContainText('Связь с Telegram проверена')
  await expect(card(page).locator('.source-read')).toContainText('Часовой пояс не загружен')
  await expect(card(page).locator('.source-read')).not.toContainText('11:30')
  await capture(page, 'TimezoneLoading', 'Desktop')
  organization.release()
  await expect(metadata.nth(0)).toContainText('14:20')
  await expect(metadata.nth(1)).toContainText('14:20')
  await expect(metadata.nth(2)).toHaveText('Ещё не было')
  await expect(card(page).locator('.source-read')).toContainText('14:30')
  await expect(card(page)).not.toContainText('Часовой пояс не загружен')
  await capture(page, 'TimezoneResolved', 'Desktop')
})
