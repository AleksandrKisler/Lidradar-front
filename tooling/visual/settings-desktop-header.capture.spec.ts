/** N-SHELL-HEADER-01. Privacy16 desktop hosts +2 adaptive regressions; body R57 is out of scope. */
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import {
  HEADER_NOW,
  privacyHeaderFixture,
  readySettingsHeader,
  settingsHeaderGeometry,
} from '../../tests/e2e/fixtures/settings-desktop-header'
type Adaptive = 'desktop' | 'tablet' | 'mobile'
type Frame = { adaptive: Adaptive; group: 'main' | 'openDialogs'; state: string; nodeId: string }
type Source = Frame & {
  package: string
  name: string
  width: number
  height: number
  expectedHeader?: { top: number; accountColor: string; headerId?: string; accountId?: string }
  nativePng: { path: string; sha256: string; width: number; height: number }
  acquisition: { status: string }
}
const ROOT = resolve('artifacts/frontend-v2/settings-notifications-team/Codex-R1/header-correction')
const OUT = resolve(process.env.HEADER_CAPTURE_OUT ?? `${ROOT}/tests/browser`)
const run = process.env.HEADER_CAPTURE_RUN ?? `${process.pid}-${Date.now()}`
const designIndex = JSON.parse(readFileSync('docs/frontend-v2/design-index.json', 'utf8'))
const selection = designIndex.settingsPrivacySelection as {
  adaptives: Record<
    Adaptive,
    { primaryScreenId: string; states: Record<string, Record<string, string>> }
  >
}
const frames: Frame[] = ['main', 'openDialogs'].flatMap((group) =>
  Object.entries(selection.adaptives.desktop.states[group]!).map(([state, nodeId]) => ({
    adaptive: 'desktop',
    group: group as Frame['group'],
    state,
    nodeId,
  })),
)
for (const adaptive of ['tablet', 'mobile'] as const)
  frames.push({
    adaptive,
    group: 'main',
    state: 'never',
    nodeId: selection.adaptives[adaptive].primaryScreenId,
  })
expect(frames).toHaveLength(18)
expect(frames.filter((frame) => frame.adaptive === 'desktop')).toHaveLength(16)
expect(new Set(frames.map((frame) => frame.nodeId)).size).toBe(18)
test.use({
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  reducedMotion: 'reduce',
  deviceScaleFactor: 1,
})
const png = (path: string) => {
  const bytes = readFileSync(path)
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  return {
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  }
}
function reference(frame: Frame) {
  const currentMap = designIndex.accountLinkColorCorrection?.nativeSourceMap
  const path = currentMap
    ? resolve(currentMap)
    : `${ROOT}/${frame.adaptive === 'desktop' ? 'source-map' : 'regression-source-map'}.json`
  const nativeRoot = currentMap ? dirname(path) : ROOT
  const all = JSON.parse(readFileSync(path, 'utf8')) as { entries: Source[] }
  const matches = all.entries.filter(
    (source) => source.package === 'privacy' && source.nodeId === frame.nodeId,
  )
  expect(matches, `exact native header source ${frame.nodeId}`).toHaveLength(1)
  const source = matches[0]!
  expect(source.acquisition.status).toBe('usable')
  const native = png(
    isAbsolute(source.nativePng.path)
      ? source.nativePng.path
      : resolve(nativeRoot, source.nativePng.path),
  )
  expect(native.sha256).toBe(source.nativePng.sha256)
  expect([native.width, native.height]).toEqual([source.width, source.height])
  if (frame.adaptive === 'desktop') {
    expect(source.expectedHeader?.top).toBe(32)
    expect(source.expectedHeader?.accountColor.toUpperCase()).toBe('#005BB5')
  }
  return { ...source, nativePng: native }
}
const dialog = (page: Page) => page.getByRole('dialog')
async function terminalConsentError(page: Page) {
  await expect
    .poll(async () => {
      await page.clock.runFor(1500)
      return page.getByText('Не удалось прочитать состояние согласия', { exact: true }).isVisible()
    })
    .toBe(true)
}
async function prepare(
  page: Page,
  frame: Frame,
  fixture: Awaited<ReturnType<typeof privacyHeaderFixture>>,
) {
  if (frame.state === 'loading') {
    await expect.poll(() => fixture.calls.filter((call) => call.endpoint === 'read').length).toBe(1)
    await expect(page.getByRole('button', { name: 'Дать согласие', exact: true })).toHaveCount(0)
    return
  }
  if (frame.state === 'load-error') {
    await terminalConsentError(page)
    return
  }
  if (frame.state === 'readonly') {
    await expect(page.getByTestId('consent-readonly')).toBeVisible()
    return
  }
  await expect(
    page.getByRole('button', {
      name: fixture.consent.active ? 'Отозвать согласие' : 'Дать согласие',
      exact: true,
    }),
  ).toBeVisible()
  if (frame.state === 'refresh-error') {
    fixture.failures.set('read', { status: 500, code: 'INTERNAL_ERROR' })
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await terminalConsentError(page)
    return
  }
  if (frame.group === 'openDialogs' || ['grant-saved', 'revoke-saved'].includes(frame.state)) {
    const granting = frame.state.startsWith('grant')
    await page
      .getByRole('button', { name: granting ? 'Дать согласие' : 'Отозвать согласие', exact: true })
      .click()
    await expect(dialog(page)).toBeVisible()
    if (frame.group === 'openDialogs') return
    await dialog(page)
      .getByRole('button', { name: granting ? 'Дать согласие' : 'Отозвать', exact: true })
      .click()
    await expect(dialog(page)).toHaveCount(0)
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: granting ? 'Согласие выдано.' : 'Согласие отозвано.' }),
    ).toBeVisible()
    return
  }
  if (frame.state.startsWith('archive-')) {
    if (frame.state === 'archive-preparing') fixture.hold('export')
    if (frame.state === 'archive-error')
      fixture.failures.set('export', { status: 500, code: 'INTERNAL_ERROR' })
    if (frame.state === 'archive-busy')
      fixture.failures.set('export', { status: 429, code: 'EXPORT_BUSY' })
    if (frame.state === 'archive-limit')
      fixture.failures.set('export', { status: 429, code: 'RATE_LIMITED' })
    const download = frame.state === 'archive-saved' ? page.waitForEvent('download') : null
    await page.getByTestId('export-organization').click()
    if (frame.state === 'archive-preparing')
      await expect(page.getByRole('button', { name: 'Готовим архив…', exact: true })).toBeDisabled()
    else if (download) {
      await download
      await expect(page.getByTestId('export-organization-saved')).toBeVisible()
    } else await expect(page.getByTestId('export-organization-error')).toBeVisible()
  }
}
async function capture(
  page: Page,
  info: TestInfo,
  frame: Frame,
  source: ReturnType<typeof reference>,
  fixture: Awaited<ReturnType<typeof privacyHeaderFixture>>,
  errors: unknown[],
) {
  const id = `${frame.adaptive}-${frame.nodeId.replace(':', '-')}`
  mkdirSync(`${OUT}/actual`, { recursive: true })
  mkdirSync(`${OUT}/records`, { recursive: true })
  await page.mouse.move(0, 0)
  await page.evaluate(() => scrollTo(0, 0))
  const assets = await readySettingsHeader(page)
  const geometry = await settingsHeaderGeometry(page)
  if (frame.adaptive === 'desktop') {
    expect(geometry.shellHeader).toMatchObject({ x: 280, y: 32, width: 1120, height: 44 })
    expect(geometry.account.color).toBe('rgb(0, 91, 181)')
  } else {
    expect(geometry.appbar).toMatchObject({ y: 0, height: frame.adaptive === 'tablet' ? 72 : 64 })
    expect(geometry.account.color).toBe(
      frame.adaptive === 'tablet' ? 'rgb(0, 91, 181)' : 'rgb(0, 113, 227)',
    )
  }
  const viewportPath = `${OUT}/actual/${id}-viewport.png`,
    fullPath = `${OUT}/actual/${id}-full.png`,
    headerPath = `${OUT}/actual/${id}-header.png`
  await page.screenshot({ path: viewportPath, animations: 'disabled' })
  await page.screenshot({ path: fullPath, fullPage: true, animations: 'disabled' })
  const bounds = frame.adaptive === 'desktop' ? geometry.shellHeader : geometry.appbar
  await page.screenshot({
    path: headerPath,
    clip: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    animations: 'disabled',
  })
  const files = { viewport: png(viewportPath), fullPage: png(fullPath), header: png(headerPath) }
  writeFileSync(
    `${OUT}/records/${id}.json`,
    JSON.stringify(
      {
        run,
        frame,
        source,
        referenceKind: 'header-only',
        acceptanceScope: {
          desktopHeader: frame.adaptive === 'desktop',
          adaptiveRegression: frame.adaptive !== 'desktop',
          privacyR57Body: 'OUT_OF_SCOPE_NOT_IMPLEMENTED',
          dialogBody: 'existing-runtime-only',
        },
        comparisonFile: files.header,
        contextFiles: { viewport: files.viewport, fullPage: files.fullPage },
        nativeHeaderBounds:
          frame.adaptive === 'desktop'
            ? { x: 280, y: 32, width: 1120, height: 44 }
            : { x: 0, y: 0, width: geometry.viewport.width, height: geometry.appbar.height },
        geometry,
        assets,
        errors,
        fixture: {
          kind: 'synthetic existing consent/export API',
          consent: fixture.consent,
          company: fixture.company,
          calls: fixture.calls,
        },
        browser: info.project.use.browserName ?? 'chromium',
        version: page.context().browser()!.version(),
        project: info.project.name,
        locale: 'ru-RU',
        timezone: 'Europe/Moscow',
        clock: await page.evaluate(() => new Date().toISOString()),
        deviceScaleFactor: 1,
        result: 'UNVERIFIED',
      },
      null,
      2,
    ),
  )
  await info.attach(id, { path: headerPath, contentType: 'image/png' })
}
for (const frame of frames) {
  test(`privacy header-only ${frame.adaptive} ${frame.group}.${frame.state} ${frame.nodeId}`, async ({
    page,
  }, info) => {
    test.setTimeout(60_000)
    const source = reference(frame)
    await page.setViewportSize(
      frame.adaptive === 'desktop'
        ? { width: 1440, height: 1000 }
        : frame.adaptive === 'tablet'
          ? { width: 834, height: 1194 }
          : { width: 390, height: 844 },
    )
    const active = ['active', 'revoke', 'revoke-saved'].includes(frame.state)
    const fixture = await privacyHeaderFixture(page, {
      manager: frame.state === 'readonly',
      initial: active ? 'active' : frame.state === 'revoked' ? 'revoked' : 'never',
    })
    const errors: unknown[] = []
    page.on('pageerror', (error) => errors.push({ type: 'pageerror', message: error.message }))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push({ type: 'console', message: message.text() })
    })
    await page.clock.install({ time: new Date(HEADER_NOW) })
    await page.clock.pauseAt(new Date(HEADER_NOW))
    try {
      if (frame.state === 'loading') fixture.hold('read')
      if (frame.state === 'load-error')
        fixture.failures.set('read', { status: 500, code: 'INTERNAL_ERROR' })
      await page.goto('/settings/privacy')
      await expect(
        page.getByRole('heading', { name: 'Данные и конфиденциальность', exact: true }),
      ).toBeVisible()
      await prepare(page, frame, fixture)
      await capture(page, info, frame, source, fixture, errors)
    } finally {
      fixture.dispose()
    }
  })
}
test.afterAll(() => {
  mkdirSync(OUT, { recursive: true })
  const records = frames.map((frame) => {
    const path = `${OUT}/records/${frame.adaptive}-${frame.nodeId.replace(':', '-')}.json`
    const saved = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
    return saved?.run === run
      ? saved
      : { frame, result: 'UNVERIFIED', reason: 'Not captured in this run' }
  })
  writeFileSync(
    `${OUT}/source-map.json`,
    JSON.stringify(
      {
        run,
        expected: 18,
        completed: records.filter((record) => record.run === run).length,
        complete: records.every((record) => record.run === run),
        referenceKind: 'header-only',
        privacyBodyAcceptance: 'OUT_OF_SCOPE',
        result: 'UNVERIFIED',
        records,
      },
      null,
      2,
    ),
  )
})
