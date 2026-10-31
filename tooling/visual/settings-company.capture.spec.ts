/** Desktop design acceptance inputs only. Narrow layouts retain regression tests. */
import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  SETTINGS_NOW,
  SETTINGS_SCENARIOS,
  prepareSettingsScenario,
  settingsFixture,
  openSettings,
} from '../../tests/e2e/fixtures/settings-company'
import { settleInPlace } from './shot'

const OUT = resolve(
  process.env.VISUAL_OUT ?? 'artifacts/frontend-v2/settings-company/Codex-R1/browser',
)
const captureRun = `${process.pid}-${Date.now()}`
type Source = {
  scenario: string
  adaptive: string
  node: string
  fixture: string
  [key: string]: unknown
}
const sources = JSON.parse(
  readFileSync(
    resolve('artifacts/frontend-v2/settings-company/Codex-R1/source-matrix.json'),
    'utf8',
  ),
) as Source[]
test.use({
  viewport: { width: 1440, height: 1000 },
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
})
test.beforeAll(() => {
  mkdirSync(`${OUT}/actual`, { recursive: true })
  mkdirSync(`${OUT}/records`, { recursive: true })
})

for (const scenario of SETTINGS_SCENARIOS) {
  test(`settings company desktop ${scenario}`, async ({ page, browserName }, info) => {
    test.setTimeout(60_000)
    const fixture = await prepareSettingsScenario(page, scenario)
    try {
      await settleInPlace(page)
      await page.evaluate(() => scrollTo(0, 0))
      const geometry = await page.evaluate(() => {
        const rect = (element: Element) => {
          const box = element.getBoundingClientRect()
          return { x: box.x, y: box.y, width: box.width, height: box.height }
        }
        return {
          viewport: { width: innerWidth, height: innerHeight },
          documentHeight: document.documentElement.scrollHeight,
          scrollWidth: document.documentElement.scrollWidth,
          dpr: devicePixelRatio,
          sections: [...document.querySelectorAll('main section')].map((element) => ({
            label: element.getAttribute('aria-labelledby'),
            ...rect(element),
          })),
          dialogs: [...document.querySelectorAll('[role=dialog]')]
            .filter((element) => element.getClientRects().length)
            .map(rect),
          footerButtons: [...document.querySelectorAll('[role=dialog] footer button')]
            .filter((element) => element.getClientRects().length)
            .map(rect),
          controls: [...document.querySelectorAll('main select, main input, main button')]
            .filter((element) => element.getClientRects().length)
            .map((element) => ({
              name: element.getAttribute('name'),
              label: element.getAttribute('aria-label'),
              ...rect(element),
            })),
        }
      })
      expect(geometry.scrollWidth).toBeLessThanOrEqual(1440)
      if (geometry.dialogs.length) {
        // Figma desktop cards640: both outer button widths280 and gap16, including borders.
        expect(geometry.footerButtons).toHaveLength(2)
        for (const button of geometry.footerButtons) expect(button.width).toBeCloseTo(280, 1)
        const [first, second] = geometry.footerButtons
        expect(second!.x - first!.x - first!.width).toBeCloseTo(16, 1)
      }
      const prefix = `actual/${scenario}-desktop`
      const files: Record<string, string> = {
        viewport: `${prefix}.png`,
        fullPage: `${prefix}-full.png`,
      }
      await page.screenshot({
        path: `${OUT}/${files.viewport}`,
        fullPage: false,
        animations: 'disabled',
      })
      // Capture raw browser geometry; never stretch sticky shell or resize the image.
      await page.screenshot({
        path: `${OUT}/${files.fullPage}`,
        fullPage: true,
        animations: 'disabled',
      })
      const dialog = page.getByRole('dialog').filter({ visible: true })
      if (await dialog.count()) {
        files.dialog = `${prefix}-dialog.png`
        await dialog.screenshot({ path: `${OUT}/${files.dialog}`, animations: 'disabled' })
      } else {
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
        await settleInPlace(page)
        files.bottom = `${prefix}-bottom.png`
        await page.screenshot({
          path: `${OUT}/${files.bottom}`,
          fullPage: false,
          animations: 'disabled',
        })
      }
      const source = sources.find(
        (item) => item.scenario === scenario && item.adaptive === 'desktop',
      )
      expect(source, `Exact source node for ${scenario}`).toBeTruthy()
      const record = {
        captureRun,
        scenario,
        adaptive: 'desktop',
        node: source!.node,
        fixture: `mockOwner + settingsFixture:${scenario}`,
        file: files.dialog ?? files.fullPage,
        files,
        browser: browserName,
        version: page.context().browser()!.version(),
        geometry,
        clock: SETTINGS_NOW,
        locale: 'ru-RU',
        timezone: 'Europe/Moscow',
        dpr: 1,
        project: info.project.name,
        result: 'UNVERIFIED',
        requests: fixture.calls,
        mutations: fixture.writes(),
      }
      writeFileSync(`${OUT}/records/${scenario}-desktop.json`, JSON.stringify(record, null, 2))
      await info.attach(`${scenario}-desktop`, {
        path: `${OUT}/${files.viewport}`,
        contentType: 'image/png',
      })
    } finally {
      fixture.dispose()
    }
  })
}

test.afterAll(() => {
  mkdirSync(OUT, { recursive: true })
  const records = sources.map((source) => {
    if (source.adaptive !== 'desktop')
      return {
        ...source,
        file: null,
        browser: null,
        version: null,
        geometry: null,
        result: 'DEFERRED_UNAPPROVED_DESIGN',
      }
    const path = `${OUT}/records/${source.scenario}-desktop.json`
    const record = existsSync(path)
      ? (JSON.parse(readFileSync(path, 'utf8')) as { captureRun?: string })
      : null
    return record?.captureRun === captureRun
      ? record
      : {
          ...source,
          file: null,
          browser: null,
          version: null,
          geometry: null,
          result: 'UNVERIFIED',
          reason: 'Capture did not complete',
        }
  })
  writeFileSync(`${OUT}/source-map.json`, JSON.stringify(records, null, 2))
})

// States without an exact approved frame use the established desktop form/alert pattern.
for (const state of [
  'company-save-error',
  'location-save-error',
  'week-save-error',
  'short-dialog',
  'long-values',
  'keyboard-focus',
] as const) {
  test(`settings desktop supplemental ${state}`, async ({ page, browserName }) => {
    const fixture = await settingsFixture(page, { longNames: state === 'long-values' })
    try {
      if (state === 'short-dialog') await page.setViewportSize({ width: 1440, height: 600 })
      await openSettings(page)
      if (state === 'company-save-error') {
        fixture.failures.add('company')
        await page.locator('input[name=organizationName]').fill('Компания QA')
        await page.getByRole('button', { name: 'Сохранить компанию', exact: true }).click()
        await expect(
          page.locator('section[aria-labelledby=company-title]').getByRole('alert'),
        ).toBeVisible()
      } else if (state === 'location-save-error' || state === 'short-dialog') {
        await page.getByRole('button', { name: 'Добавить точку', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: 'Добавить точку', exact: true })
        await dialog.locator('input[name=locationName]').fill('Новая студия QA')
        if (state === 'location-save-error') {
          fixture.failures.add('locations')
          await dialog.getByRole('button', { name: 'Добавить точку', exact: true }).click()
          await expect(dialog.getByRole('alert')).toBeVisible()
        } else {
          await dialog.locator('select[name=locationTimezone]').scrollIntoViewIfNeeded()
          await expect(
            dialog.getByRole('button', { name: 'Добавить точку', exact: true }),
          ).toBeVisible()
        }
      } else if (state === 'week-save-error') {
        fixture.failures.add('week')
        await page.locator('input[name=opens-1]').fill('10:00')
        await page.getByRole('button', { name: 'Сохранить график', exact: true }).click()
        await expect(
          page.locator('section[aria-labelledby=schedule-title]').getByRole('alert'),
        ).toBeVisible()
      } else if (state === 'keyboard-focus') {
        await page.locator('input[name=opens-1]').focus()
      }
      await settleInPlace(page)
      if (state !== 'keyboard-focus')
        await page.evaluate(() => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        })
      const geometry = await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }))
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width)
      const files = [`actual/supplemental-${state}.png`, `actual/supplemental-${state}-full.png`]
      await page.screenshot({ path: `${OUT}/${files[0]}`, animations: 'disabled' })
      await page.screenshot({ path: `${OUT}/${files[1]}`, fullPage: true, animations: 'disabled' })
      if (await page.getByRole('dialog').count()) {
        files.push(`actual/supplemental-${state}-dialog.png`)
        await page
          .getByRole('dialog')
          .screenshot({ path: `${OUT}/${files[2]}`, animations: 'disabled' })
      } else {
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
        files.push(`actual/supplemental-${state}-bottom.png`)
        await page.screenshot({ path: `${OUT}/${files[2]}`, animations: 'disabled' })
      }
      writeFileSync(
        `${OUT}/records/supplemental-${state}.json`,
        JSON.stringify(
          {
            captureRun,
            state,
            adaptive: 'desktop',
            fixture: 'settingsFixture',
            files,
            geometry,
            browser: browserName,
            version: page.context().browser()!.version(),
            locale: 'ru-RU',
            timezone: 'Europe/Moscow',
            dpr: 1,
            clock: SETTINGS_NOW,
            referenceKind: 'approved-state-pattern',
            result: 'UNVERIFIED',
          },
          null,
          2,
        ),
      )
    } finally {
      fixture.dispose()
    }
  })
}
