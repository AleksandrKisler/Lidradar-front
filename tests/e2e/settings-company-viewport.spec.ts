import { expect, test, type Locator } from '@playwright/test'
import { openSettings, settingsFixture, type SettingsFixture } from './fixtures/settings-company'

test.use({ locale: 'ru-RU', timezoneId: 'Europe/Moscow', reducedMotion: 'reduce' })
let fixture: SettingsFixture | undefined
test.afterEach(() => fixture?.dispose())

async function controlsFit(dialog: Locator, top: number, bottom: number, editing = false) {
  for (const name of ['Закрыть', 'Отмена', editing ? 'Сохранить точку' : 'Добавить точку']) {
    const control = dialog.getByRole('button', { name, exact: true })
    const box = await control.boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(top)
    expect(box!.y + box!.height).toBeLessThanOrEqual(bottom)
    await expect(control).toBeInViewport({ ratio: 1 })
  }
}

for (const viewport of [
  { width: 320, height: 480 },
  { width: 390, height: 480 },
  { width: 834, height: 500 },
  { width: 1440, height: 600 },
]) {
  test(`point dialogs keep fields and actions available at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    fixture = await settingsFixture(page)
    await openSettings(page)
    for (const editing of [false, true]) {
      if (editing)
        await page.getByRole('button', { name: 'Изменить точку', exact: true }).first().click()
      else await page.getByRole('button', { name: 'Добавить точку', exact: true }).click()
      const dialog = page.getByRole('dialog', {
        name: editing ? 'Изменить точку' : 'Добавить точку',
        exact: true,
      })
      const lastField = editing
        ? dialog.getByLabel('Состояние точки', { exact: true })
        : dialog.locator('input[name="agreementThresholdMinutes"]')
      await lastField.focus()
      await lastField.scrollIntoViewIfNeeded()
      await expect(lastField).toBeInViewport({ ratio: 1 })
      await controlsFit(dialog, 0, viewport.height, editing)
      const box = await dialog.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
      expect(box!.height).toBeLessThanOrEqual(viewport.height)
      if (!editing) {
        const help = dialog.getByRole('button', { name: 'О поле «Нет ответа»', exact: true })
        const helpBox = await help.boundingBox()
        expect(helpBox!.width).toBeGreaterThanOrEqual(44)
        expect(helpBox!.height).toBeGreaterThanOrEqual(44)
        await help.focus()
        await expect(page.getByRole('tooltip')).toBeVisible()
        const tooltipBox = await page.getByRole('tooltip').boundingBox()
        // Approved Start tooltip is offset 80px from its 20px glyph; mobile uses page gutters.
        expect(tooltipBox!.x).toBeCloseTo(viewport.width < 768 ? 16 : helpBox!.x + 12 - 80, 0)
        await dialog.locator('.sheet-body').evaluate(
          (body) =>
            new Promise<void>((resolve) => {
              body.addEventListener('scroll', () => resolve(), { once: true })
              body.scrollTop += body.scrollTop > 0 ? -1 : 1
            }),
        )
        await expect(page.getByRole('tooltip')).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(dialog).toBeVisible()
      }
      await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
      await expect(dialog).toHaveCount(0)
    }
    expect(fixture.writes()).toHaveLength(0)
  })
}

test('point dialog follows a smaller visual viewport while layout viewport stays unchanged', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    const view = Object.assign(new EventTarget(), {
      width: 390,
      height: 844,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
    })
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => view })
  })
  fixture = await settingsFixture(page)
  await openSettings(page)
  await page.getByRole('button', { name: 'Добавить точку', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Добавить точку', exact: true })
  await expect(dialog).toBeVisible()
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 480, offsetTop: 40 })
    window.visualViewport!.dispatchEvent(new Event('resize'))
  })
  await expect.poll(async () => (await dialog.boundingBox())!.height).toBe(480)
  expect(await page.evaluate(() => innerHeight)).toBe(844)
  await controlsFit(dialog, 40, 520)
  const lastField = dialog.locator('input[name="agreementThresholdMinutes"]')
  await lastField.focus()
  await lastField.scrollIntoViewIfNeeded()
  await expect(lastField).toBeInViewport({ ratio: 1 })
  await controlsFit(dialog, 40, 520)
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 844, offsetTop: 0 })
    window.visualViewport!.dispatchEvent(new Event('resize'))
  })
  await expect.poll(async () => (await dialog.boundingBox())!.height).toBe(844)
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
  expect(fixture.writes()).toHaveLength(0)
})

test('reconnecting keeps the existing warning and settings geometry until the stream opens', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const network = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const response = await network(input, init)
      const request = input instanceof Request ? input : null
      const url = new URL(request?.url ?? String(input), location.origin)
      if (url.pathname !== '/api/v1/events' || !response.ok) return response
      const signal = init?.signal ?? request?.signal
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(': connected\n\n'))
            signal?.addEventListener('abort', () => controller.close(), { once: true })
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      )
    }
  })
  fixture = await settingsFixture(page)
  let calls = 0
  let release = () => {}
  await page.route('**/api/v1/events', async (route) => {
    const attempt = ++calls
    if (attempt > 1) await new Promise<void>((resolve) => (release = resolve))
    await route.fulfill({ status: attempt === 1 ? 503 : 200, body: '{}' }).catch(() => {})
  })
  try {
    await openSettings(page)
    const warning = page.getByRole('status').filter({ hasText: 'Обновления недоступны:' })
    await expect(warning).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const company = page.getByRole('region', { name: 'Компания', exact: true })
    const top = (await company.boundingBox())!.y
    await expect.poll(() => calls, { timeout: 10_000 }).toBe(2)
    await expect(warning).toBeVisible()
    expect((await company.boundingBox())!.y).toBe(top)
    release()
    await expect(warning).toHaveCount(0)
    expect(calls).toBe(2)
  } finally {
    release()
  }
})
