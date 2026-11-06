/** R47:87 exact frame/state pairs, plus responsive evidence. Never writes baselines. */
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import {
  NOTIFICATIONS_NOW,
  notificationEditor,
  openNotificationEditor,
  refreshNotifications,
  settingsNotificationsFixture,
  type SettingsNotificationsFixture,
} from '../../tests/e2e/fixtures/settings-notifications'

type Adaptive = 'desktop' | 'tablet' | 'mobile'
type Group = 'main' | 'editor' | 'openEditor' | 'telegram'
type Frame = { adaptive: Adaptive; group: Group; state: string; nodeId: string }
type Source = Frame & {
  package: string
  name: string
  width: number
  height: number
  nativePng: { path: string; sha256: string; width: number; height: number } | null
  acquisition: { status: string; [key: string]: unknown }
}
const ROOT = resolve('artifacts/frontend-v2/settings-notifications-team/Codex-R1')
const OUT = resolve(process.env.NOTIFICATIONS_CAPTURE_OUT ?? `${ROOT}/notification-tests/browser`)
const SOURCE_ROOT = `${ROOT}/sources`
const CORRECTION_ROOT = `${ROOT}/header-correction`
const captureRun = process.env.NOTIFICATIONS_CAPTURE_RUN ?? `${process.pid}-${Date.now()}`
const design = JSON.parse(readFileSync('docs/frontend-v2/design-index.json', 'utf8'))
  .settingsNotificationsSelection as {
  adaptives: Record<Adaptive, { states: Record<Group, Record<string, string>> }>
}
const adaptives: Record<Adaptive, { width: number; height: number }> = {
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 834, height: 1194 },
  mobile: { width: 390, height: 844 },
}
const frames: Frame[] = (
  Object.entries(design.adaptives) as [Adaptive, typeof design.adaptives.desktop][]
).flatMap(([adaptive, spec]) =>
  (Object.entries(spec.states) as [Group, Record<string, string>][]).flatMap(([group, states]) =>
    Object.entries(states).map(([state, nodeId]) => ({ adaptive, group, state, nodeId })),
  ),
)
expect(frames).toHaveLength(87)
expect(new Set(frames.map((frame) => frame.nodeId)).size).toBe(87)
for (const adaptive of Object.keys(adaptives))
  expect(frames.filter((frame) => frame.adaptive === adaptive)).toHaveLength(29)

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
function png(path: string) {
  const bytes = readFileSync(path)
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  return {
    path,
    sha256: hash(bytes),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  }
}
/** Resolve at execution time: incomplete Figma downloads cannot masquerade as references. */
function sourceFor(frame: Frame) {
  const historical = JSON.parse(readFileSync(`${SOURCE_ROOT}/source-map.json`, 'utf8')) as {
    entries: Source[]
  }
  const correction = JSON.parse(readFileSync(`${CORRECTION_ROOT}/source-map.json`, 'utf8')) as {
    entries: Source[]
  }
  const corrected = correction.entries.some(
    (entry) => entry.package === 'notifications' && entry.nodeId === frame.nodeId,
  )
  const sourceMap = corrected ? correction : historical
  const sourceRoot = corrected ? CORRECTION_ROOT : SOURCE_ROOT
  const matches = sourceMap.entries.filter(
    (entry) => entry.package === 'notifications' && entry.nodeId === frame.nodeId,
  )
  expect(matches, `Unique exact-frame source for ${frame.nodeId}`).toHaveLength(1)
  const source = matches[0]!
  expect({ adaptive: source.adaptive, group: source.group, state: source.state }).toEqual({
    adaptive: frame.adaptive,
    group: frame.group,
    state: frame.state,
  })
  expect(source.acquisition.status, `Native PNG acquisition for ${frame.nodeId}`).toBe('usable')
  expect(source.nativePng, `Missing native PNG for ${frame.nodeId}`).not.toBeNull()
  const native = source.nativePng!
  const path = isAbsolute(native.path) ? native.path : resolve(sourceRoot, native.path)
  const actual = png(path)
  expect(actual.sha256).toBe(native.sha256)
  expect([actual.width, actual.height]).toEqual([source.width, source.height])
  expect([native.width, native.height]).toEqual([source.width, source.height])
  return { ...source, nativePng: actual }
}

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
const ruleDialog = (page: Page) => notificationEditor(page)
const telegramDialog = (page: Page) =>
  page.getByRole('dialog').filter({ hasText: 'Личная привязка · Не источник переписки' })
const resetDialog = (page: Page) =>
  page
    .getByRole('dialog')
    .filter({ has: page.getByRole('button', { name: 'Оставить мои', exact: true }) })
async function changeSeverity(page: Page) {
  await ruleDialog(page).locator('select[name=severity-NO_RESPONSE]').selectOption('CRITICAL')
}
async function save(page: Page, fixture: SettingsNotificationsFixture, state: string) {
  if (state === 'saving') fixture.hold('save')
  if (state === 'error') fixture.failures.set('save', { status: 500, code: 'INTERNAL_ERROR' })
  await ruleDialog(page).getByRole('button', { name: 'Сохранить', exact: true }).click()
  if (state === 'saving')
    await expect(
      ruleDialog(page).getByRole('button', { name: 'Сохраняем…', exact: true }),
    ).toBeDisabled()
  else if (state === 'error')
    await expect(
      ruleDialog(page).getByRole('button', { name: 'Повторить сохранение', exact: true }),
    ).toBeEnabled()
  else
    await expect(
      ruleDialog(page).getByRole('status').filter({ hasText: 'Настройка сохранена' }),
    ).toBeVisible()
  expect(fixture.writes('save')).toHaveLength(1)
}
async function reset(page: Page, fixture: SettingsNotificationsFixture) {
  await ruleDialog(page).getByRole('button', { name: 'Вернуть по умолчанию', exact: true }).click()
  await resetDialog(page).getByRole('button', { name: 'Вернуть', exact: true }).click()
  await expect(resetDialog(page)).toHaveCount(0)
  await expect(ruleDialog(page).locator('select[name=severity-NO_RESPONSE]')).toHaveValue('LOW')
  expect(fixture.writes('reset')).toHaveLength(1)
}
async function digestQuiet(page: Page, invalid = false) {
  const dialog = ruleDialog(page)
  await dialog.locator('select[name=mode-NO_RESPONSE]').selectOption('DIGEST')
  await dialog.locator('select[name=severity-NO_RESPONSE]').selectOption('CRITICAL')
  await dialog.locator('input[name=digest-NO_RESPONSE]').fill('09:00')
  await dialog.locator('input[name=quiet-NO_RESPONSE]').check()
  await dialog.locator('input[name=quiet-start-NO_RESPONSE]').fill('22:00')
  await dialog.locator('input[name=quiet-end-NO_RESPONSE]').fill(invalid ? '22:00' : '08:00')
  if (invalid) {
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await expect(
      dialog.getByText('Границы тихих часов должны различаться', { exact: true }),
    ).toBeVisible()
  }
}
async function prepare(page: Page, frame: Frame, fixture: SettingsNotificationsFixture) {
  if (frame.group === 'main') {
    if (frame.state === 'loading') {
      await expect(
        page.getByRole('status', { name: 'Загрузка настроек', exact: true }),
      ).toBeVisible()
      return
    }
    if (frame.state === 'initial-error') {
      // Wait for each asynchronous response before advancing the next retry timer.
      await expect
        .poll(async () => {
          await page.clock.runFor(1500)
          return page.getByText('Не удалось загрузить правила', { exact: true }).isVisible()
        })
        .toBe(true)
      await page.getByRole('button', { name: 'О доставке уведомлений', exact: true }).click()
      await expect(page.getByRole('tooltip')).toBeVisible()
      return
    }
    await expect(page.getByRole('button', { name: /^Изменить:/ })).toHaveCount(6)
    if (frame.state === 'unlinked') {
      await expect(
        page.getByText(
          'Telegram выбран в правилах, но сообщения начнут приходить только после личной привязки.',
          { exact: true },
        ),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Подключить Telegram', exact: true }),
      ).toBeVisible()
    }
    if (frame.state === 'refresh-error') {
      fixture.failures.set('preferences', { status: 500, code: 'INTERNAL_ERROR' })
      await refreshNotifications(page)
      await expect
        .poll(async () => {
          await page.clock.runFor(1500)
          return page.getByText('Правила не обновлены', { exact: true }).isVisible()
        })
        .toBe(true)
      await page.clock.setFixedTime(new Date(NOTIFICATIONS_NOW))
    }
    if (frame.state === 'afterSave' || frame.state === 'afterReset') {
      await openNotificationEditor(page)
      if (frame.state === 'afterSave') {
        await changeSeverity(page)
        await save(page, fixture, 'saved')
      } else await reset(page, fixture)
      await ruleDialog(page).getByRole('button', { name: 'Отмена', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
    return
  }
  if (frame.group === 'telegram' && frame.state !== 'reset') {
    if (frame.state === 'disconnect') {
      await page.getByRole('button', { name: 'Управлять', exact: true }).click()
      await expect(
        page.getByRole('dialog').getByRole('button', { name: 'Отключить', exact: true }),
      ).toBeVisible()
      return
    }
    if (frame.state === 'issuing') fixture.hold('issue')
    await page.getByRole('button', { name: 'Подключить Telegram', exact: true }).click()
    const dialog = telegramDialog(page)
    if (frame.state === 'issuing') {
      await expect(dialog.getByText('Готовим одноразовую ссылку…', { exact: true })).toBeVisible()
      return
    }
    await expect(dialog.getByRole('link', { name: 'Открыть бота', exact: true })).toBeVisible()
    if (frame.state === 'checking' || frame.state === 'error') {
      if (frame.state === 'checking') fixture.hold('status')
      else fixture.failures.set('status', { status: 500, code: 'INTERNAL_ERROR' })
      await dialog.getByRole('button', { name: 'Проверить привязку', exact: true }).click()
      if (frame.state === 'checking')
        await expect(dialog.getByRole('button', { name: 'Проверяем…', exact: true })).toBeDisabled()
      else await expect(dialog.getByRole('alert')).toBeVisible()
    }
    if (frame.state === 'expired') {
      await page.clock.runFor(15 * 60_000 + 1)
      await expect(dialog.getByText('Срок ссылки истёк', { exact: true })).toBeVisible()
    }
    return
  }
  await openNotificationEditor(page)
  const dialog = ruleDialog(page)
  if (frame.group === 'telegram') {
    await dialog.getByRole('button', { name: 'Вернуть по умолчанию', exact: true }).click()
    await expect(resetDialog(page)).toBeVisible()
    return
  }
  if (frame.state === 'digest-quiet' || frame.state === 'validation')
    await digestQuiet(page, frame.state === 'validation')
  else if (frame.state === 'off')
    await dialog.locator('select[name=mode-NO_RESPONSE]').selectOption('DISABLED')
  else if (frame.state === 'default-after-reset') await reset(page, fixture)
  else if (['dirty', 'saving', 'saved', 'error'].includes(frame.state)) {
    await changeSeverity(page)
    if (frame.state !== 'dirty') await save(page, fixture, frame.state)
  }
  if (frame.state === 'clean' || frame.state === 'default-after-reset')
    await expect(dialog.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled()
  if (frame.state === 'telegram-unlinked')
    await expect(dialog.getByText(/Telegram не подключён/)).toBeVisible()
  if (frame.state === 'validation') expect(fixture.writes()).toHaveLength(0)
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
        'main, section, [role=dialog], .sheet-body, [role=dialog] header, [role=dialog] footer, [role=dialog] input, [role=dialog] select, [role=dialog] button',
      ),
    ]
      .filter((element) => element.getClientRects().length)
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          tag: element.tagName,
          role: element.getAttribute('role'),
          name: element.getAttribute('aria-label') ?? element.getAttribute('name'),
          text: element.textContent?.trim().slice(0, 120),
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        }
      }),
  }))
}
async function capture(
  page: Page,
  info: TestInfo,
  frame: Frame,
  source: ReturnType<typeof sourceFor>,
  fixture: SettingsNotificationsFixture,
  errors: unknown[],
  referenceKind: 'exact-frame' | 'approved-pattern',
  id: string,
) {
  mkdirSync(`${OUT}/actual`, { recursive: true })
  mkdirSync(`${OUT}/records`, { recursive: true })
  await page.mouse.move(0, 0)
  await page
    .locator('[role=dialog] input, [role=dialog] select')
    .evaluateAll((elements) => elements.forEach((element) => (element as HTMLElement).blur()))
  // Real form interactions may scroll fields into view; capture the approved resting position.
  await page
    .locator('.sheet-body')
    .evaluateAll((elements) => elements.forEach((element) => element.scrollTo(0, 0)))
  await page.evaluate(() => scrollTo(0, 0))
  const assets = await ready(page)
  const measured = await geometry(page)
  expect(measured.document.width).toBeLessThanOrEqual(measured.viewport.width)
  const files: Record<string, ReturnType<typeof png>> = {}
  const viewportPath = `${OUT}/actual/${id}-viewport.png`
  await page.screenshot({ path: viewportPath, animations: 'disabled' })
  files.viewport = png(viewportPath)
  if (frame.group === 'main') {
    const full = `${OUT}/actual/${id}-full.png`
    await page.screenshot({ path: full, fullPage: true, animations: 'disabled' })
    files.comparison = png(full)
  } else if (frame.group === 'openEditor') {
    // Exact host bounds come from the native source, not the long main-screen frame.
    const host = `${OUT}/actual/${id}-host.png`
    expect(measured.viewport).toEqual({ width: source.width, height: source.height })
    await page.screenshot({
      path: host,
      clip: { x: 0, y: 0, width: source.width, height: source.height },
      animations: 'disabled',
    })
    files.comparison = png(host)
  } else {
    const popup = `${OUT}/actual/${id}-dialog.png`
    const dialog =
      frame.group === 'telegram' && frame.state === 'reset'
        ? resetDialog(page)
        : frame.group === 'telegram'
          ? page.getByRole('dialog').filter({ visible: true }).last()
          : ruleDialog(page)
    await dialog.screenshot({ path: popup, animations: 'disabled' })
    files.comparison = png(popup)
  }
  const record = {
    captureRun,
    id,
    referenceKind,
    frame,
    source,
    native: source.nativePng,
    actual: files.comparison,
    files,
    viewport: measured.viewport,
    expectedNativeSize: { width: source.width, height: source.height },
    nativeSizeMatches:
      files.comparison!.width === source.width && files.comparison!.height === source.height,
    fixture: {
      name: 'settingsNotificationsFixture: approved six effective preferences',
      company: fixture.company,
      rows: fixture.rows,
      telegram: fixture.telegram,
    },
    requests: fixture.calls,
    writes: fixture.writes(),
    geometry: measured,
    assets,
    errors,
    browser: info.project.use.browserName ?? 'chromium',
    version: page.context().browser()!.version(),
    project: info.project.name,
    locale: 'ru-RU',
    timezone: 'Europe/Moscow',
    clock: {
      start:
        frame.group === 'telegram' && !['disconnect', 'reset'].includes(frame.state)
          ? '2026-11-01T08:30:00Z'
          : NOTIFICATIONS_NOW,
      capture: await page.evaluate(() => new Date().toISOString()),
    },
    deviceScaleFactor: 1,
    result: 'UNVERIFIED',
  }
  writeFileSync(`${OUT}/records/${id}.json`, JSON.stringify(record, null, 2))
  await info.attach(id, { path: files.comparison!.path, contentType: 'image/png' })
}

for (const frame of frames) {
  test(`notifications ${frame.adaptive} ${frame.group}.${frame.state} ${frame.nodeId}`, async ({
    page,
  }, info) => {
    test.setTimeout(60_000)
    const source = sourceFor(frame)
    const viewport =
      frame.group === 'openEditor'
        ? { width: source.width, height: source.height }
        : adaptives[frame.adaptive]
    await page.setViewportSize(viewport)
    const unlinked =
      (frame.group === 'telegram' && !['disconnect', 'reset'].includes(frame.state)) ||
      frame.state === 'unlinked' ||
      frame.state === 'telegram-unlinked'
    const fixture = await settingsNotificationsFixture(page, { linked: !unlinked })
    const errors: unknown[] = []
    page.on('pageerror', (error) => errors.push({ kind: 'pageerror', message: error.message }))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push({ kind: 'console', message: message.text() })
    })
    page.on('requestfailed', (request) =>
      errors.push({
        kind: 'requestfailed',
        path: new URL(request.url()).pathname,
        failure: request.failure(),
      }),
    )
    const captureClock =
      frame.group === 'telegram' && !['disconnect', 'reset'].includes(frame.state)
        ? '2026-11-01T08:30:00Z'
        : NOTIFICATIONS_NOW
    if (captureClock !== NOTIFICATIONS_NOW) fixture.telegram.expiresAt = '2026-11-01T08:45:00Z'
    await page.clock.install({ time: new Date(captureClock) })
    await page.clock.pauseAt(new Date(captureClock))
    try {
      if (frame.group === 'main' && frame.state === 'loading') fixture.hold('preferences')
      if (frame.group === 'main' && frame.state === 'initial-error')
        fixture.failures.set('preferences', { status: 500, code: 'INTERNAL_ERROR' })
      await page.goto('/settings/notifications')
      await expect(page.getByRole('heading', { name: 'Уведомления', exact: true })).toBeVisible()
      await prepare(page, frame, fixture)
      await capture(
        page,
        info,
        frame,
        source,
        fixture,
        errors,
        'exact-frame',
        `${frame.adaptive}-${frame.nodeId.replace(':', '-')}`,
      )
    } finally {
      fixture.dispose()
    }
  })
}
const responsive = [
  ...[320, 375, 640, 768, 1024].map((width) => ({
    width,
    height: width < 768 ? 844 : 1194,
    editor: false,
  })),
  ...[
    { width: 320, height: 480 },
    { width: 390, height: 480 },
    { width: 834, height: 500 },
    { width: 1440, height: 600 },
  ].map((viewport) => ({ ...viewport, editor: true })),
]
for (const viewport of responsive) {
  test(`notifications responsive ${viewport.width}x${viewport.height} ${viewport.editor ? 'editor' : 'main'}`, async ({
    page,
  }, info) => {
    const adaptive: Adaptive =
      viewport.width < 768 ? 'mobile' : viewport.width < 1024 ? 'tablet' : 'desktop'
    const frame = frames.find(
      (item) =>
        item.adaptive === adaptive &&
        item.group === (viewport.editor ? 'editor' : 'main') &&
        item.state === (viewport.editor ? 'digest-quiet' : 'connected'),
    )!
    const source = sourceFor(frame)
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const fixture = await settingsNotificationsFixture(page)
    try {
      await page.goto('/settings/notifications')
      await expect(page.getByRole('button', { name: /^Изменить:/ })).toHaveCount(6)
      if (viewport.editor) {
        await openNotificationEditor(page)
        await digestQuiet(page)
        const dialog = ruleDialog(page)
        const last = dialog.locator('input[name=quiet-end-NO_RESPONSE]')
        await last.scrollIntoViewIfNeeded()
        await expect(last).toBeInViewport({ ratio: 1 })
        for (const name of ['Закрыть', 'Отмена', 'Сохранить'])
          await expect(dialog.getByRole('button', { name, exact: true })).toBeInViewport({
            ratio: 1,
          })
        await dialog.getByRole('button', { name: 'Закрыть', exact: true }).focus()
        await page.keyboard.press('Shift+Tab')
        await expect(dialog.getByRole('button', { name: 'Сохранить', exact: true })).toBeFocused()
      }
      expect(fixture.writes()).toHaveLength(0)
      await capture(
        page,
        info,
        frame,
        source,
        fixture,
        [],
        'approved-pattern',
        `responsive-${viewport.width}-${viewport.height}-${viewport.editor ? 'editor' : 'main'}`,
      )
    } finally {
      fixture.dispose()
    }
  })
}
// Partial/failed runs never reuse old records as evidence for this run.
test.afterAll(() => {
  mkdirSync(OUT, { recursive: true })
  const expectedIds = frames.map((frame) => `${frame.adaptive}-${frame.nodeId.replace(':', '-')}`)
  const records = expectedIds.map((id) => {
    const path = `${OUT}/records/${id}.json`
    const saved = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
    return saved?.captureRun === captureRun
      ? saved
      : { id, result: 'UNVERIFIED', reason: 'Capture did not complete in this run' }
  })
  const responsiveRecords = responsive.map((viewport) => {
    const id = `responsive-${viewport.width}-${viewport.height}-${viewport.editor ? 'editor' : 'main'}`
    const path = `${OUT}/records/${id}.json`
    const saved = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
    return saved?.captureRun === captureRun
      ? saved
      : { id, result: 'UNVERIFIED', reason: 'Responsive capture did not complete in this run' }
  })
  writeFileSync(
    `${OUT}/source-map.json`,
    JSON.stringify(
      {
        captureRun,
        expectedExactFrames: 87,
        completedExactFrames: records.filter((record) => record.captureRun === captureRun).length,
        complete: records.every((record) => record.captureRun === captureRun),
        result: 'UNVERIFIED',
        records,
        expectedResponsiveFrames: responsive.length,
        completedResponsiveFrames: responsiveRecords.filter(
          (record) => record.captureRun === captureRun,
        ).length,
        responsiveRecords,
      },
      null,
      2,
    ),
  )
})
