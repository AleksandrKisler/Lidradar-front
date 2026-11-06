/** Approved Services: 48 native frames plus responsive evidence. No baseline writes. */
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SETTINGS_NOW } from '../../tests/e2e/fixtures/settings-company'
import {
  CREATED_SERVICE_ID,
  settingsServicesFixture,
  type SettingsServicesFixture,
} from '../../tests/e2e/fixtures/settings-services'

type Source = {
  adaptive: string
  row: number
  stateIndex: number
  nodeId: string
  role: string
  name: string
  width: number
  height: number
  nativePng: { path: string; sha256: string; width: number; height: number }
}
const ROOT = 'artifacts/frontend-v2/settings-services-adaptive/Codex-R1'
const OUT = resolve(`${ROOT}/browser`)
const sources = JSON.parse(readFileSync(`${ROOT}/source-map.json`, 'utf8')).nodes as Source[]
const captureRun = process.env.SERVICES_CAPTURE_RUN ?? `${process.pid}-${Date.now()}`
const adaptives = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 834, height: 1194 },
  { name: 'mobile', width: 390, height: 844 },
]
expect(sources).toHaveLength(48)
expect(new Set(sources.map((source) => source.nodeId)).size).toBe(48)
for (const adaptive of adaptives) {
  const frames = sources.filter((source) => source.adaptive === adaptive.name)
  expect(frames).toHaveLength(16)
  expect([0, 1, 2, 3].map((row) => frames.filter((frame) => frame.row === row).length)).toEqual([
    1, 5, 6, 4,
  ])
}
for (const source of sources) {
  if (!source.nativePng?.path) throw new Error(`Missing native PNG: ${source.nodeId}`)
  expect(createHash('sha256').update(readFileSync(source.nativePng.path)).digest('hex')).toBe(
    source.nativePng.sha256,
  )
}
test.use({
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
})
const visible = (page: Page, role: 'button' | 'switch', name: string) =>
  page.getByRole(role, { name, exact: true }).filter({ visible: true })

async function ready(page: Page) {
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
        if (!image.naturalWidth) throw new Error(`Undecoded asset: ${url}`)
        return {
          url: new URL(url, location.href).pathname,
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
        src: new URL(image.currentSrc).pathname,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })),
    }
  })
}
async function open(page: Page) {
  const fixture = await settingsServicesFixture(page, {
    sessionName: 'Мария Владелец',
    traceId: '',
  })
  fixture.company.name = 'Студия «Блик»'
  fixture.locations.splice(1)
  fixture.services.forEach((service) => {
    service.locationId = null
  })
  fixture.services[1]!.name = 'Химчистка салона'
  await page.addInitScript(() => {
    const fetchNetwork = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : null
      const url = new URL(request?.url ?? String(input), location.origin)
      if (url.pathname !== '/api/v1/events') return fetchNetwork(input, init)
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
  await page.clock.install({ time: new Date(SETTINGS_NOW) })
  await page.clock.pauseAt(new Date(new Date(SETTINGS_NOW).getTime() + 1000))
  try {
    await page.goto('/settings/services')
    await expect(page.getByRole('heading', { name: 'Услуги и цены', exact: true })).toBeVisible()
    await expect(visible(page, 'switch', 'Активность услуги «Полировка кузова»')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Все · 6', exact: true })).toBeVisible()
    await expect(
      page.getByText('Обновления недоступны: обновляйте вручную', { exact: true }),
    ).toHaveCount(0)
    return fixture
  } catch (error) {
    fixture.dispose()
    throw error
  }
}
async function prepare(page: Page, fixture: SettingsServicesFixture, row: number, state: number) {
  if (row === 0) return
  if (row === 3) {
    await visible(page, 'switch', 'Активность услуги «Полировка кузова»').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    if (state >= 2) {
      fixture.hold('deactivate')
      if (state === 3) fixture.failures.set('deactivate', 500)
      await dialog.getByRole('button', { name: 'Отключить', exact: true }).click()
      await expect(dialog.getByRole('button', { name: 'Отключаем…', exact: true })).toBeDisabled()
      expect(fixture.services[0]!.active).toBe(true)
      if (state === 3) {
        fixture.release('deactivate')
        await expect(dialog.getByRole('alert')).toContainText('Не удалось отключить услугу')
        await expect(
          dialog.getByRole('button', { name: 'Повторить отключение', exact: true }),
        ).toBeEnabled()
      }
    }
    return
  }
  const creating = row === 1 || state === 5
  await visible(
    page,
    'button',
    creating ? 'Добавить услугу' : 'Изменить услугу «Полировка кузова»',
  ).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('input[name=serviceName]')).toHaveValue(
    creating ? '' : 'Полировка кузова',
  )
  if (state >= 2) {
    if (creating) {
      await dialog.locator('input[name=serviceName]').fill('Озонирование салона')
      await dialog.locator('input[name=priceFrom]').fill('1 500')
      await dialog.locator('input[name=priceTo]').fill('2 500')
    }
    const endpoint = creating ? 'create' : 'update'
    fixture.hold(endpoint)
    if (state === 4) fixture.failures.set(endpoint, creating ? 422 : 500)
    await dialog
      .getByRole('button', { name: creating ? 'Добавить услугу' : 'Сохранить услугу', exact: true })
      .click()
    await page.clock.runFor(5)
    await expect(dialog.getByRole('button', { name: 'Сохраняем…', exact: true })).toBeDisabled()
    await expect(dialog.locator('input[name=serviceName]')).toBeDisabled()
    if (state !== 2) {
      fixture.release(endpoint)
      if (state === 4) {
        await expect(dialog.getByRole('alert')).toContainText('Не удалось сохранить услугу')
        await expect(dialog.locator('input[name=serviceName]')).toBeEnabled()
      } else {
        await expect(dialog.getByRole('button', { name: 'ОК', exact: true })).toBeVisible()
        await expect(dialog.getByRole('status')).toContainText(
          creating ? 'Услуга добавлена' : 'Изменения сохранены',
        )
        if (state === 5) {
          await dialog.getByRole('button', { name: 'Изменить услугу', exact: true }).click()
          await expect(dialog.locator('input[name=serviceName]')).toHaveValue('Озонирование салона')
          expect(fixture.services.find((service) => service.id === CREATED_SERVICE_ID)?.name).toBe(
            'Озонирование салона',
          )
          expect(fixture.writes('POST')).toHaveLength(1)
          expect(fixture.writes('PATCH')).toHaveLength(0)
        }
      }
    }
  }
  // Source images show resting fields; remove the real focus without changing styles/DOM.
  const field = dialog.locator('input[name=serviceName]')
  if (await field.count()) await field.blur()
}
async function geometry(page: Page) {
  return page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    dpr: devicePixelRatio,
    document: {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    },
    elements: [
      ...document.querySelectorAll(
        'main, .lr-service-catalog, article, table, [role=dialog], [role=tooltip], [role=dialog] input, [role=dialog] select, [role=dialog] button',
      ),
    ]
      .filter((element) => element.getClientRects().length)
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          tag: element.tagName,
          role: element.getAttribute('role'),
          name: element.getAttribute('aria-label') ?? element.getAttribute('name'),
          text: element.textContent?.trim().slice(0, 100),
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        }
      }),
  }))
}
async function record(
  page: Page,
  info: TestInfo,
  id: string,
  source: Source,
  files: Record<string, string>,
  fixture: SettingsServicesFixture,
  referenceKind: string,
) {
  const actual = await geometry(page)
  expect(actual.document.width).toBeLessThanOrEqual(actual.viewport.width)
  const result = {
    captureRun,
    source,
    referenceKind,
    files,
    comparisonFile:
      source.row === 0 ? files.fullPage : source.stateIndex === 0 ? files.viewport : files.popup,
    fixture: {
      name: 'settingsServicesFixture: approved six prices, all locations null',
      company: fixture.company,
      locations: fixture.locations,
      services: fixture.services,
    },
    requests: fixture.calls,
    writes: fixture.writes(),
    geometry: actual,
    assets: await ready(page),
    browser: info.project.use.browserName ?? 'chromium',
    version: page.context().browser()!.version(),
    project: info.project.name,
    locale: 'ru-RU',
    timezone: 'Europe/Moscow',
    clock: SETTINGS_NOW,
    result: 'UNVERIFIED',
  }
  writeFileSync(
    `${OUT}/${referenceKind === 'exact-frame' ? 'records' : 'responsive'}/${id}.json`,
    JSON.stringify(result, null, 2),
  )
}
for (const source of sources) {
  const adaptive = adaptives.find((item) => item.name === source.adaptive)!
  test(`services ${source.adaptive} ${source.nodeId} ${source.role}`, async ({ page }, info) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: adaptive.width, height: adaptive.height })
    const fixture = await open(page)
    try {
      await prepare(page, fixture, source.row, source.stateIndex)
      await page.mouse.move(0, 0)
      await ready(page)
      const id = `${source.adaptive}-${source.nodeId.replace(':', '-')}`
      mkdirSync(`${OUT}/actual`, { recursive: true })
      mkdirSync(`${OUT}/records`, { recursive: true })
      const files: Record<string, string> = { viewport: `actual/${id}-viewport.png` }
      if (source.row === 0) {
        await page.evaluate(() => scrollTo(0, 0))
        files.resting = `actual/${id}-resting.png`
        await page.screenshot({
          path: `${OUT}/${files.resting}`,
          fullPage: true,
          animations: 'disabled',
        })
        await page
          .getByRole('button', { name: 'Об отключении услуги и цене', exact: true })
          .filter({ visible: true })
          .nth(3)
          .click()
        await expect(page.getByRole('tooltip')).toBeVisible()
        await page.evaluate(() => scrollTo(0, 0))
        files.fullPage = `actual/${id}-full.png`
        await page.screenshot({
          path: `${OUT}/${files.fullPage}`,
          fullPage: true,
          animations: 'disabled',
        })
      } else {
        files.popup = `actual/${id}-popup.png`
        await page
          .getByRole('dialog')
          .screenshot({ path: `${OUT}/${files.popup}`, animations: 'disabled' })
      }
      await page.screenshot({ path: `${OUT}/${files.viewport}`, animations: 'disabled' })
      await record(page, info, id, source, files, fixture, 'exact-frame')
      await info.attach(id, { path: `${OUT}/${files.viewport}`, contentType: 'image/png' })
    } finally {
      fixture.dispose()
    }
  })
}

const widths = [320, 344, 375, 767, 768, 1023, 1024]
const shortViewports = [
  { width: 320, height: 480 },
  { width: 390, height: 480 },
  { width: 834, height: 500 },
  { width: 1440, height: 600 },
]
const supplementaryIds = [
  ...widths.map((width) => `main-${width}`),
  ...shortViewports.flatMap(({ width, height }) =>
    [1, 2, 3].map((row) => `dialog-${row}-${width}-${height}`),
  ),
]
for (const id of supplementaryIds) {
  test(`services responsive ${id}`, async ({ page }, info) => {
    const parts = id.split('-').map(Number)
    const row = id.startsWith('main') ? 0 : parts[1]!
    const width = id.startsWith('main') ? parts[1]! : parts[2]!
    const height = id.startsWith('main')
      ? width < 768
        ? 844
        : width < 1024
          ? 1194
          : 1000
      : parts[3]!
    await page.setViewportSize({ width, height })
    const fixture = await open(page)
    try {
      await prepare(page, fixture, row, 0)
      if (row && row < 3) {
        const last = page.getByRole('dialog').locator('select[name=serviceCurrency]')
        await last.focus()
        await last.scrollIntoViewIfNeeded()
        await expect(last).toBeInViewport({ ratio: 1 })
      }
      if (row) {
        const dialog = page.getByRole('dialog')
        for (const name of row === 3
          ? ['Оставить активной', 'Отключить', 'Закрыть']
          : ['Отмена', row === 1 ? 'Добавить услугу' : 'Сохранить услугу', 'Закрыть']) {
          await expect(dialog.getByRole('button', { name, exact: true })).toBeInViewport({
            ratio: 1,
          })
        }
      }
      await page.mouse.move(0, 0)
      await ready(page)
      mkdirSync(`${OUT}/responsive`, { recursive: true })
      const files: Record<string, string> = { viewport: `responsive/${id}-viewport.png` }
      if (!row) {
        files.fullPage = `responsive/${id}-full.png`
        await page.screenshot({
          path: `${OUT}/${files.fullPage}`,
          fullPage: true,
          animations: 'disabled',
        })
      }
      await page.screenshot({ path: `${OUT}/${files.viewport}`, animations: 'disabled' })
      const adaptive = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop'
      const source = sources.find(
        (item) => item.adaptive === adaptive && item.row === row && item.stateIndex === 0,
      )!
      await record(page, info, id, source, files, fixture, 'approved-pattern')
      expect(fixture.writes()).toHaveLength(0)
    } finally {
      fixture.dispose()
    }
  })
}
// A partial run never inherits historical screenshots as fresh evidence.
test.afterAll(() => {
  mkdirSync(OUT, { recursive: true })
  const collect = (id: string, folder: string) => {
    const path = `${OUT}/${folder}/${id}.json`
    const saved = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
    return saved?.captureRun === captureRun
      ? saved
      : { id, result: 'UNVERIFIED', reason: 'Capture did not complete in this run' }
  }
  const records = sources.map((source) =>
    collect(`${source.adaptive}-${source.nodeId.replace(':', '-')}`, 'records'),
  )
  const supplementary = supplementaryIds.map((id) => collect(id, 'responsive'))
  writeFileSync(`${OUT}/source-map.json`, JSON.stringify(records, null, 2))
  writeFileSync(`${OUT}/responsive-source-map.json`, JSON.stringify(supplementary, null, 2))
  expect(records.filter((item) => item.captureRun === captureRun)).toHaveLength(48)
  expect(supplementary.filter((item) => item.captureRun === captureRun)).toHaveLength(
    supplementaryIds.length,
  )
})
