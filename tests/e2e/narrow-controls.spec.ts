import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { mockOwner } from './fixtures/api'

const widths = [320, 344, 360, 375, 390, 420, 640, 834, 1440]

test.use({ locale: 'ru-RU', timezoneId: 'Europe/Moscow', reducedMotion: 'reduce' })
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-25T11:30:00Z'))
  await mockOwner(page, { events: 'unavailable' })
})

async function capture(page: Page, info: TestInfo, name: string) {
  if (process.env.NARROW_CAPTURE !== '1') return
  await page.evaluate(() => document.fonts.ready)
  const geometry = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    scrollWidth: document.documentElement.scrollWidth,
    dpr: devicePixelRatio,
    locale: navigator.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    controls: [
      ...document.querySelectorAll(
        'input[type=date], [data-testid=email-verification-banner] button',
      ),
    ].map((element) => {
      const box = element.getBoundingClientRect()
      return {
        text: element.textContent,
        name: element.getAttribute('name'),
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      }
    }),
  }))
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: false, animations: 'disabled' })
  await info.attach(name, { path, contentType: 'image/png' })
  const metadataPath = info.outputPath(`${name}.json`)
  await writeFile(
    metadataPath,
    JSON.stringify({
      ...geometry,
      testTitle: info.title,
      state: name,
      project: info.project.name,
      browserVersion: page.context().browser()!.version(),
      clock: '2026-10-25T11:30Z',
      fixture: 'mockOwner; unavailable SSE; explicit email flags only in banner test',
    }),
  )
  await info.attach(`${name}-metadata`, {
    path: metadataPath,
    contentType: 'application/json',
  })
}

for (const width of widths) {
  test(`N-ML-01 / ${width}: баннер и действия целиком в viewport`, async ({ page }, info) => {
    await page.setViewportSize({
      width,
      height: width === 834 ? 1194 : width === 1440 ? 1000 : 844,
    })
    const auth = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/v1/auth/me',
    )
    await page.goto('/conversations')
    const me = await (await auth).json()
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        json: {
          ...me,
          user: {
            ...me.user,
            emailVerifiedAt: null,
            email: 'very.long.synthetic.address.for.banner@example.test',
            deletionDueAt: '2026-11-02T11:30:00Z',
          },
        },
      }),
    )
    let sends = 0
    await page.route('**/api/v1/auth/email/verification', (route) => {
      sends += 1
      return route.fulfill({ status: 204 })
    })
    await page.reload()
    const banner = page.getByTestId('email-verification-banner')
    await expect(banner).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    for (const button of await banner.getByRole('button').all()) {
      const box = (await button.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      await button.focus()
      await expect(button).toBeFocused()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await capture(page, info, 'banner-initial')
    await banner.getByRole('button', { name: 'Отправить письмо ещё раз', exact: true }).click()
    await expect(banner.getByRole('status')).toHaveText(
      'Письмо отправлено. Проверьте почту, включая папку «Спам».',
    )
    expect(sends).toBe(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await capture(page, info, 'banner-sent')
    await banner.getByRole('button', { name: 'Скрыть', exact: true }).click()
    await expect(banner).toBeHidden()
  })

  test(`N-ML-02 / ${width}: дата целиком, изменение и reload сохраняют период`, async ({
    page,
  }, info) => {
    await page.setViewportSize({
      width,
      height: width === 834 ? 1194 : width === 1440 ? 1000 : 844,
    })
    await page.goto('/analytics?from=2026-09-10&to=2026-09-20')
    const from = page.getByLabel('Начало периода', { exact: true })
    const to = page.getByLabel('Конец периода', { exact: true })
    await expect(from).toHaveValue('2026-09-10')
    await expect(to).toHaveValue('2026-09-20')
    await expect(page.getByTestId('analytics-period')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    for (const field of [from, to]) {
      const box = (await field.boundingBox())!
      // Approved desktop date control is 160px; narrower native fields clip the year.
      expect(box.width).toBeGreaterThanOrEqual(160)
      expect(box.height).toBe(46)
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      expect(await field.evaluate((element) => getComputedStyle(element).fontSize)).toBe('17px')
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await capture(page, info, 'analytics-date')
    await from.fill('2026-09-12')
    await expect(page).toHaveURL(/from=2026-09-12&to=2026-09-20/)
    await page.reload()
    await expect(from).toHaveValue('2026-09-12')
    await expect(to).toHaveValue('2026-09-20')
    await to.fill('2026-09-01')
    await expect(page.getByRole('alert')).toContainText('Дата начала позже даты окончания')
    await page.getByRole('button', { name: '7 дней', exact: true }).click()
    await expect(from).toHaveValue('2026-10-19')
    await expect(to).toHaveValue('2026-10-25')
    await expect(page.getByRole('form', { name: 'Период аналитики' })).toContainText('· 7 дн.')
  })
}
