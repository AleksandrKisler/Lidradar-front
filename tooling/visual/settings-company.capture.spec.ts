/** Current approved 21 × 3 matrix. Legacy S6 exports/baselines are never written. */
import { expect, test, type Page } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  SETTINGS_NOW,
  VISUAL_LONG_LOCATION,
  settingsVisualFixture,
  fillSettingsVisualWeek,
  openSettings,
  type SettingsFixture,
} from '../../tests/e2e/fixtures/settings-company'

type Frame = { nodeId: string; name: string; width: number; height: number }
type Matrix = { rows: { frames: Frame[] }[] }
const selection = JSON.parse(readFileSync('docs/frontend-v2/design-index.json', 'utf8'))
  .settingsCompanyAndScheduleSelection as Matrix & { tabletDraft: Matrix; mobileDraft: Matrix }
const captureRun = `${process.pid}-${Date.now()}`
const OUT = resolve('artifacts/frontend-v2/settings-company-adaptive/Codex-R1/browser')
const adaptives = [
  { name: 'desktop', width: 1440, height: 1000, matrix: selection },
  { name: 'tablet', width: 834, height: 1194, matrix: selection.tabletDraft },
  { name: 'mobile', width: 390, height: 844, matrix: selection.mobileDraft },
]
test.use({
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
})

async function ready(page: Page) {
  return page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((image) => image.decode()))
    const masks = new Set(
      [...document.querySelectorAll<HTMLElement>('span[style]')].flatMap((element) => {
        const mask = getComputedStyle(element).maskImage
        const url = mask.match(/url\(["']?([^"')]+)["']?\)/)?.[1]
        return url ? [url] : []
      }),
    )
    return Promise.all(
      [...masks].map(async (url) => {
        const asset = new Image()
        asset.src = url
        await asset.decode()
        if (!asset.naturalWidth || !asset.naturalHeight) throw new Error('Empty SVG asset')
        return {
          url: new URL(url).pathname,
          width: asset.naturalWidth,
          height: asset.naturalHeight,
        }
      }),
    )
  })
}

async function prepare(page: Page, fixture: SettingsFixture, row: number, state: number) {
  const editing = row === 3
  if (editing && state >= 2 && state < 5) {
    fixture.locations[0]!.responseThresholdMinutes = 44
  }
  if (row !== 0 || state !== 3) {
    // A real dirty edit is also required behind graph/dialog reference frames.
    fixture.company.name = 'Студия «Блик» · прежнее название'
    await page.reload()
    await expect(page.locator('input[name=organizationName]')).toBeVisible()
    await page.locator('input[name=organizationName]').fill('Студия «Блик»')
  }
  await fillSettingsVisualWeek(page)
  if (row < 2) {
    const company = row === 0
    const endpoint = company ? 'company' : 'week'
    const badge = page.getByTestId(company ? 'settings-company-status' : 'settings-schedule-status')
    if (state === 3) {
      if (!company) {
        await page.getByRole('button', { name: 'Сохранить график', exact: true }).click()
        await expect(badge).toHaveText('Сохранено')
        await page.clock.runFor(2000)
      }
      await expect(badge).toHaveText('Изменений нет')
    } else if (state > 0) {
      fixture.hold(endpoint)
      if (state === 4) fixture.failures.add(endpoint)
      await page
        .getByRole('button', {
          name: company ? 'Сохранить компанию' : 'Сохранить график',
          exact: true,
        })
        .click()
      if (company) await page.clock.runFor(5)
      await expect(badge).toHaveText('Сохраняем…')
      if (state !== 1) {
        fixture.release(endpoint)
        await expect(badge).toHaveText(state === 4 ? 'Ошибка сохранения' : 'Сохранено')
      }
    }
    return
  }
  const create = !editing || state === 5
  if (create) await page.getByRole('button', { name: 'Добавить точку', exact: true }).click()
  else
    await page
      .getByRole('list', { name: 'Список точек' })
      .getByRole('button', { name: 'Изменить точку', exact: true })
      .first()
      .click()
  let dialog = page.getByRole('dialog', {
    name: create ? 'Добавить точку' : 'Изменить точку',
    exact: true,
  })
  await expect(dialog).toBeVisible()
  if (create && state >= 2)
    await dialog.locator('input[name=locationName]').fill('Студия на Арбате')
  if (state === 1) {
    await dialog
      .getByRole('button', {
        name:
          (await page.evaluate(() => innerWidth >= 768)) !== editing
            ? 'О поле «Следующий шаг»'
            : 'О поле «Нет ответа»',
        exact: true,
      })
      .focus()
    await expect(page.getByRole('tooltip')).toBeVisible()
  }
  if (state >= 2) {
    const endpoint = create ? 'locations' : 'location'
    if (!create) await dialog.locator('input[name=responseThresholdMinutes]').fill('45')
    fixture.hold(endpoint)
    if (state === 4) fixture.failures.add(endpoint)
    await dialog
      .getByRole('button', { name: create ? 'Добавить точку' : 'Сохранить точку', exact: true })
      .click()
    await page.clock.runFor(5)
    await expect(dialog.getByRole('button', { name: 'Сохраняем…', exact: true })).toBeVisible()
    if (state !== 2) {
      fixture.release(endpoint)
      if (state === 4) await expect(dialog.getByRole('alert')).toBeVisible()
      else {
        await expect(dialog.getByRole('button', { name: 'ОК', exact: true })).toBeVisible()
        if (state === 5) {
          await dialog.getByRole('button', { name: 'Изменить точку', exact: true }).click()
          dialog = page.getByRole('dialog', { name: 'Изменить точку', exact: true })
          await expect(dialog.locator('input[name=locationName]')).toHaveValue('Студия на Арбате')
          expect(fixture.writes('locations')).toHaveLength(1)
          await dialog.locator('input[name=locationName]').blur()
        }
      }
    }
  }
}

for (const adaptive of adaptives) {
  expect(adaptive.matrix.rows.flatMap((row) => row.frames)).toHaveLength(21)
  for (const [rowIndex, row] of adaptive.matrix.rows.entries()) {
    for (const [stateIndex, frame] of row.frames.entries()) {
      test(`settings ${adaptive.name} ${frame.nodeId} ${frame.name}`, async ({
        page,
        browserName,
      }, info) => {
        test.setTimeout(60_000)
        await page.setViewportSize({ width: adaptive.width, height: adaptive.height })
        const fixture = await settingsVisualFixture(page)
        await page.clock.install({ time: new Date(SETTINGS_NOW) })
        await page.clock.pauseAt(new Date(new Date(SETTINGS_NOW).getTime() + 1000))
        try {
          await openSettings(page)
          await prepare(page, fixture, rowIndex, stateIndex)
          // Approved frames show resting controls, except the explicitly requested tooltip.
          await page.mouse.move(0, 0)
          const assets = await ready(page)
          if ((rowIndex < 2 && stateIndex === 1) || (rowIndex >= 2 && stateIndex === 2))
            await expect(page.getByRole('button', { name: 'Сохраняем…', exact: true })).toHaveCSS(
              'background-color',
              'rgb(0, 113, 227)',
            )
          const name = `${adaptive.name}-${frame.nodeId.replace(':', '-')}`
          mkdirSync(`${OUT}/actual`, { recursive: true })
          mkdirSync(`${OUT}/records`, { recursive: true })
          const files: Record<string, string> = { viewport: `actual/${name}-viewport.png` }
          const dialog = page.getByRole('dialog').filter({ visible: true })
          const hasDialog = (await dialog.count()) > 0
          const isMain = rowIndex < 2 && stateIndex === 0
          const host = rowIndex >= 2 && stateIndex === 0
          if (isMain) {
            await page.evaluate(() => scrollTo(0, 0))
            const longName = page
              .getByRole('list', { name: 'Список точек' })
              .getByRole('button', { name: new RegExp(VISUAL_LONG_LOCATION) })
            await page.getByRole('heading', { level: 1 }).focus()
            await page.getByRole('heading', { level: 1 }).blur()
            if (adaptive.name !== 'mobile') {
              await longName.scrollIntoViewIfNeeded()
              await page.clock.runFor(16)
              await longName.hover()
              await expect(page.getByRole('tooltip')).toBeVisible()
            }
            files.fullPage = `actual/${name}-full.png`
            await page.screenshot({
              path: `${OUT}/${files.fullPage}`,
              fullPage: true,
              animations: 'disabled',
            })
          }
          if (hasDialog) {
            files.popup = `actual/${name}-popup.png`
            await dialog.screenshot({ path: `${OUT}/${files.popup}`, animations: 'disabled' })
          } else if (!isMain) {
            files.fragment = `actual/${name}-fragment.png`
            const section = page.locator(
              `section[aria-labelledby=${rowIndex === 0 ? 'company-title' : 'schedule-title'}]`,
            )
            // Schedule state references include the common locations/schedule group.
            const crop = rowIndex === 1 ? page.getByTestId('settings-points-schedule') : section
            await crop.screenshot({ path: `${OUT}/${files.fragment}`, animations: 'disabled' })
          }
          if (host || isMain) await page.evaluate(() => scrollTo(0, 0))
          await page.screenshot({ path: `${OUT}/${files.viewport}`, animations: 'disabled' })
          const geometry = await page.evaluate(() => ({
            viewport: { width: innerWidth, height: innerHeight },
            dpr: devicePixelRatio,
            document: {
              width: document.documentElement.scrollWidth,
              height: document.documentElement.scrollHeight,
            },
            sections: [
              ...document.querySelectorAll('main section, [data-testid=settings-points-schedule]'),
            ].map((element) => {
              const box = element.getBoundingClientRect()
              return {
                label:
                  element.getAttribute('aria-labelledby') ?? element.getAttribute('data-testid'),
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
              }
            }),
            dialogs: [...document.querySelectorAll('[role=dialog]')].map((element) => {
              const box = element.getBoundingClientRect()
              return { x: box.x, y: box.y, width: box.width, height: box.height }
            }),
          }))
          expect(geometry.document.width).toBeLessThanOrEqual(adaptive.width)
          if (hasDialog && !host) {
            expect(geometry.dialogs[0]!.height).toBe(
              adaptive.width < 768 ? adaptive.height : Math.min(frame.height, adaptive.height - 48),
            )
          }
          writeFileSync(
            `${OUT}/records/${name}.json`,
            JSON.stringify(
              {
                captureRun,
                source: {
                  node: frame.nodeId,
                  name: frame.name,
                  size: { width: frame.width, height: frame.height },
                },
                adaptive: adaptive.name,
                rowIndex,
                stateIndex,
                files,
                comparisonFile: host
                  ? files.viewport
                  : (files.fragment ?? files.popup ?? files.fullPage),
                fixture: 'settingsVisualFixture: five points, API empty week + real input draft',
                assets,
                browser: browserName,
                version: page.context().browser()!.version(),
                project: info.project.name,
                locale: 'ru-RU',
                timezone: 'Europe/Moscow',
                clock: SETTINGS_NOW,
                geometry,
                requests: fixture.calls,
                writes: fixture.writes(),
                result: 'UNVERIFIED',
              },
              null,
              2,
            ),
          )
          await info.attach(name, { path: `${OUT}/${files.viewport}`, contentType: 'image/png' })
        } finally {
          fixture.dispose()
        }
      })
    }
  }
}

const narrowWidths = [320, 344, 375, 768, 1023, 1024]
const shortViewports = [
  { width: 320, height: 480 },
  { width: 390, height: 480 },
  { width: 834, height: 500 },
  { width: 1440, height: 600 },
]
const responsiveIds = [
  ...narrowWidths.map((width) => `main-${width}`),
  ...shortViewports.flatMap(({ width, height }) =>
    ['create', 'edit'].map((kind) => `${kind}-${width}-${height}`),
  ),
]

async function openVisualDraft(page: Page) {
  const fixture = await settingsVisualFixture(page)
  try {
    await page.clock.install({ time: new Date(SETTINGS_NOW) })
    await page.clock.pauseAt(new Date(new Date(SETTINGS_NOW).getTime() + 1000))
    await openSettings(page)
    await prepare(page, fixture, 0, 0)
    return fixture
  } catch (error) {
    fixture.dispose()
    throw error
  }
}

async function responsiveRecord(
  page: Page,
  id: string,
  files: Record<string, string>,
  row: number,
  assets: Awaited<ReturnType<typeof ready>>,
  state: string,
) {
  const width = await page.evaluate(() => innerWidth)
  const adaptive = adaptives[width >= 1024 ? 0 : width >= 768 ? 1 : 2]!
  const geometry = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    documentWidth: document.documentElement.scrollWidth,
    dpr: devicePixelRatio,
  }))
  expect(geometry.documentWidth).toBeLessThanOrEqual(width)
  writeFileSync(
    `${OUT}/responsive/${id}.json`,
    JSON.stringify(
      {
        captureRun,
        id,
        referenceKind: 'approved-pattern',
        referenceNode: adaptive.matrix.rows[row]!.frames[0]!.nodeId,
        state,
        files,
        geometry,
        assets,
        clock: SETTINGS_NOW,
        locale: 'ru-RU',
        timezone: 'Europe/Moscow',
        browser: 'chromium',
        version: page.context().browser()!.version(),
        result: 'UNVERIFIED',
      },
      null,
      2,
    ),
  )
}

for (const width of narrowWidths) {
  test(`settings responsive main ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : width < 1024 ? 1194 : 1000 })
    const fixture = await openVisualDraft(page)
    try {
      await page.getByRole('heading', { level: 1 }).focus()
      await page.getByRole('heading', { level: 1 }).blur()
      await page.mouse.move(0, 0)
      await page.evaluate(() => scrollTo(0, 0))
      const assets = await ready(page)
      mkdirSync(`${OUT}/responsive`, { recursive: true })
      const id = `main-${width}`
      const files = {
        fullPage: `responsive/${id}-full.png`,
        viewport: `responsive/${id}-viewport.png`,
      }
      await page.screenshot({
        path: `${OUT}/${files.fullPage}`,
        fullPage: true,
        animations: 'disabled',
      })
      await page.screenshot({ path: `${OUT}/${files.viewport}`, animations: 'disabled' })
      await responsiveRecord(page, id, files, 0, assets, 'resting main; real dirty company/week')
      expect(fixture.writes()).toHaveLength(0)
    } finally {
      fixture.dispose()
    }
  })
}

for (const viewport of shortViewports) {
  test(`settings responsive point dialogs ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const fixture = await openVisualDraft(page)
    try {
      mkdirSync(`${OUT}/responsive`, { recursive: true })
      for (const editing of [false, true]) {
        if (editing)
          await page.getByRole('button', { name: 'Изменить точку', exact: true }).first().click()
        else await page.getByRole('button', { name: 'Добавить точку', exact: true }).click()
        const dialog = page.getByRole('dialog', {
          name: editing ? 'Изменить точку' : 'Добавить точку',
          exact: true,
        })
        const field = editing
          ? dialog.getByLabel('Состояние точки', { exact: true })
          : dialog.locator('input[name=agreementThresholdMinutes]')
        await field.focus()
        await field.scrollIntoViewIfNeeded()
        await expect(field).toBeInViewport({ ratio: 1 })
        for (const name of ['Закрыть', 'Отмена', editing ? 'Сохранить точку' : 'Добавить точку'])
          await expect(dialog.getByRole('button', { name, exact: true })).toBeInViewport({
            ratio: 1,
          })
        await page.mouse.move(0, 0)
        const assets = await ready(page)
        const id = `${editing ? 'edit' : 'create'}-${viewport.width}-${viewport.height}`
        const files = { viewport: `responsive/${id}-viewport.png` }
        await page.screenshot({ path: `${OUT}/${files.viewport}`, animations: 'disabled' })
        await responsiveRecord(
          page,
          id,
          files,
          editing ? 3 : 2,
          assets,
          'last field focused/scrolled; actions visible',
        )
        await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
      }
      expect(fixture.writes()).toHaveLength(0)
    } finally {
      fixture.dispose()
    }
  })
}

// Failed/interrupted states remain UNVERIFIED; stale records from earlier runs cannot imply success.
test.afterAll(() => {
  mkdirSync(OUT, { recursive: true })
  const records = adaptives.flatMap((adaptive) =>
    adaptive.matrix.rows.flatMap((row) =>
      row.frames.map((frame) => {
        const path = `${OUT}/records/${adaptive.name}-${frame.nodeId.replace(':', '-')}.json`
        const record = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
        return record?.captureRun === captureRun
          ? record
          : {
              source: { node: frame.nodeId, name: frame.name },
              adaptive: adaptive.name,
              result: 'UNVERIFIED',
              reason: 'Capture did not complete in this run',
            }
      }),
    ),
  )
  writeFileSync(`${OUT}/source-map.json`, JSON.stringify(records, null, 2))
  mkdirSync(`${OUT}/responsive`, { recursive: true })
  writeFileSync(
    `${OUT}/responsive/source-map.json`,
    JSON.stringify(
      responsiveIds.map((id) => {
        const file = `${OUT}/responsive/${id}.json`
        const record = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
        return record?.captureRun === captureRun ? record : { id, result: 'UNVERIFIED' }
      }),
      null,
      2,
    ),
  )
})
