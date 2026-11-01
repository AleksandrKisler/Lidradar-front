import { expect, test, type Locator, type Page } from '@playwright/test'
import { mockOwner } from './fixtures/api'
import { openSettings, settingsFixture } from './fixtures/settings-company'

async function clock(field: Locator, value: string) {
  await expect(field).toHaveAttribute('type', 'text')
  await expect(field).toHaveAttribute('inputmode', 'numeric')
  await expect(field).toHaveValue(value)
  expect(
    await field.evaluate((input: HTMLInputElement) => input.scrollWidth <= input.clientWidth),
  ).toBe(true)
}

async function ready(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((image) => image.decode()))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}

for (const locale of ['ru-RU', 'en-US']) {
  test.describe(`24h clock with ${locale} browser`, () => {
    test.use({ locale, timezoneId: 'Europe/Moscow', reducedMotion: 'reduce' })
    for (const [adaptive, width, height] of [
      ['desktop', 1440, 1000],
      ['tablet', 834, 1194],
      ['mobile', 390, 844],
    ] as const) {
      test(`${adaptive}: schedule, wizard and notification PUT preserve HH:mm`, async ({
        page,
      }, info) => {
        test.setTimeout(60_000)
        await page.setViewportSize({ width, height })
        const fixture = await settingsFixture(page)
        try {
          await openSettings(page)
          const opens = page.locator('input[name=opens-1]')
          const closes = page.locator('input[name=closes-1]')
          await clock(opens, '09:00')
          await clock(closes, '20:00')
          await closes.fill('25:00')
          await page.getByRole('button', { name: 'Сохранить график', exact: true }).click()
          await expect(closes).toHaveAttribute('aria-invalid', 'true')
          expect(fixture.writes('week')).toHaveLength(0)
          await opens.fill('0000')
          await closes.fill('')
          await closes.pressSequentially('2359')
          await clock(opens, '00:00')
          await clock(closes, '23:59')
          await page.getByRole('button', { name: 'Сохранить график', exact: true }).click()
          await expect(page.getByTestId('settings-schedule-status')).toHaveText('Сохранено')
          expect(fixture.writes('week')).toHaveLength(1)
          expect(fixture.writes('week')[0]?.body).toMatchObject({
            timezone: 'Europe/Moscow',
            days: expect.arrayContaining([
              { weekday: 1, closed: false, opensAt: '00:00', closesAt: '23:59' },
            ]),
          })
          await ready(page)
          await page.screenshot({ path: info.outputPath('company-24h.png'), fullPage: true })
        } finally {
          fixture.dispose()
        }
        await page.goto('about:blank')
        await page.unrouteAll({ behavior: 'wait' })
        await mockOwner(page)
        await page.goto('/onboarding/location')
        const wizardOpens = page.locator('input[name=opens-1]')
        const wizardCloses = page.locator('input[name=closes-1]')
        await expect(wizardOpens).toBeVisible()
        await wizardOpens.fill('0730')
        await wizardCloses.fill('2145')
        await clock(wizardOpens, '07:30')
        await clock(wizardCloses, '21:45')
        const week = page.waitForRequest(
          (request) => request.method() === 'PUT' && request.url().endsWith('/business-hours'),
        )
        await page.getByRole('button', { name: 'Сохранить график', exact: true }).click()
        expect((await week).postDataJSON()).toMatchObject({
          timezone: 'Europe/Moscow',
          days: expect.arrayContaining([
            { weekday: 1, closed: false, opensAt: '07:30', closesAt: '21:45' },
          ]),
        })
        await expect(page.getByTestId('location-continue')).toBeEnabled()
        await ready(page)
        await page.screenshot({ path: info.outputPath('wizard-24h.png'), fullPage: true })
        await page.goto('about:blank')
        await page.unrouteAll({ behavior: 'wait' })
        await mockOwner(page)
        await page.goto('/settings/notifications')
        const row = page
          .getByRole('list', { name: 'Настройки по типам рисков' })
          .locator(':scope > li')
          .filter({ hasText: 'Обещание не выполнено' })
        await row.getByText('Обещание не выполнено', { exact: true }).click()
        await row.getByLabel('Как уведомлять', { exact: true }).selectOption('DIGEST')
        await row.getByLabel('Время сводки', { exact: true }).fill('2300')
        await row.getByLabel('Не беспокоить ночью', { exact: true }).check()
        await row.getByLabel('Не беспокоить с', { exact: true }).fill('2230')
        await row.getByLabel('До', { exact: true }).fill('0700')
        await clock(row.getByLabel('Время сводки', { exact: true }), '23:00')
        await clock(row.getByLabel('Не беспокоить с', { exact: true }), '22:30')
        await clock(row.getByLabel('До', { exact: true }), '07:00')
        await expect(page.locator('input[type=time]')).toHaveCount(0)
        const preference = page.waitForRequest(
          (request) =>
            request.method() === 'PUT' &&
            request.url().endsWith('/notifications/preferences/PROMISE_NOT_FULFILLED'),
        )
        await row.getByRole('button', { name: 'Сохранить', exact: true }).click()
        expect((await preference).postDataJSON()).toMatchObject({
          digestTime: '23:00',
          quietHoursStart: '22:30',
          quietHoursEnd: '07:00',
        })
        await expect(row.getByText('Настройка сохранена.', { exact: true })).toBeVisible()
        await ready(page)
        await page.screenshot({ path: info.outputPath('notifications-24h.png'), fullPage: true })
      })
    }
  })
}
