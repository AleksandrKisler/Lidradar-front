import { expect, test } from '@playwright/test'
import { settingsFixture, openSettings } from './fixtures/settings-company'

test.use({ locale: 'ru-RU', timezoneId: 'Europe/Moscow', reducedMotion: 'reduce' })

for (const width of [1440, 834, 390]) {
  test(`settings polish ${width}: warning, location cards and shared threshold help`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width === 834 ? 1194 : 1000 })
    const fixture = await settingsFixture(page)
    try {
      await openSettings(page)
      const warning = page.getByRole('alert').filter({ hasText: 'Изменения сохраняются отдельно' })
      await expect(warning).toBeVisible()
      await expect(warning).toHaveClass(/bg-warning-pale/)
      const list = page.getByRole('list', { name: 'Список точек' })
      await expect(list).not.toContainText('Порог ответа')
      await expect(list).not.toContainText('UTC')
      for (const card of await list.getByRole('button', { pressed: true }).all())
        await expect(card).toContainText('Активна')
      await documentShot('company')
      await list.getByRole('button', { name: 'Изменить точку', exact: true }).first().click()
      const dialog = page.getByRole('dialog', { name: 'Изменить точку', exact: true })
      await expect(dialog.getByLabel('Нет ответа', { exact: true })).toHaveValue('45')
      await expect(dialog.getByLabel('Следующий шаг', { exact: true })).toHaveValue('120')
      await expect(dialog.getByText('мин', { exact: true })).toHaveCount(2)
      const help = dialog.getByRole('button', { name: 'О поле «Нет ответа»', exact: true })
      await help.focus()
      await expect(page.getByRole('tooltip')).toHaveText(
        'Через сколько рабочих минут ожидания ответа клиенту появляется риск «Нет ответа». Вне графика точки время не считается.',
      )
      await expect(help).toHaveAttribute('aria-describedby', /.+/)
      await documentShot('edit-help')
      await expect(page.getByRole('tooltip')).toContainText(
        'Через сколько рабочих минут ожидания ответа',
      )
      await page.keyboard.press('Escape')
      await expect(page.getByRole('tooltip')).toHaveCount(0)
      await expect(dialog).toBeVisible()
      await dialog.getByLabel('Нет ответа', { exact: true }).fill('46')
      await dialog.getByRole('button', { name: 'Сохранить точку', exact: true }).click()
      await expect(dialog.getByRole('button', { name: 'ОК', exact: true })).toBeVisible()
      await dialog.getByRole('button', { name: 'ОК', exact: true }).click()
      await expect(dialog).toHaveCount(0)
      expect(fixture.writes('location').at(-1)?.body).toEqual({ responseThresholdMinutes: 46 })
      await page.getByRole('button', { name: 'Добавить точку', exact: true }).click()
      const add = page.getByRole('dialog', { name: 'Добавить точку', exact: true })
      await add.getByRole('button', { name: 'О поле «Следующий шаг»', exact: true }).focus()
      await expect(page.getByRole('tooltip')).toHaveText(
        'Через сколько рабочих минут без следующего действия появляется риск «Следующий шаг». Вне графика точки время не считается.',
      )
      await documentShot('add-help')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      )
    } finally {
      fixture.dispose()
    }
    async function documentShot(state: string) {
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({
        path: info.outputPath(`${info.project.name}-${width}-${state}.png`),
        // A full-page capture can resize/reposition a modal and dismiss its tooltip.
        fullPage: state === 'company',
      })
    }
  })

  test(`settings polish ${width}: service switch confirmation, failure, retry, filters and edit`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width === 834 ? 1194 : 1000 })
    const fixture = await settingsFixture(page)
    try {
      const writes: { method: string; body: unknown }[] = []
      let failDelete = true
      await page.route('**/api/v1/services/*', async (route) => {
        const method = route.request().method()
        if (['DELETE', 'PATCH'].includes(method)) {
          writes.push({ method, body: method === 'PATCH' ? route.request().postDataJSON() : null })
          if (method === 'DELETE' && failDelete)
            return route.fulfill({
              status: 500,
              json: { error: { code: 'INTERNAL_ERROR', message: '' } },
            })
        }
        return route.fallback()
      })
      await page.goto('/settings/services')
      const control = page.getByRole('switch', { name: 'Активность услуги «Полировка кузова»' })
      await expect(control).toBeChecked()
      const filters = page.getByRole('group', { name: 'Фильтр услуг' })
      await expect(filters.getByRole('button', { name: 'Все · 1', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect((await filters.getByRole('button').first().boundingBox())!.height).toBeLessThanOrEqual(
        36,
      )
      const help = page.getByRole('button', { name: 'Об отключении услуги и цене', exact: true })
      await control.focus()
      await expect(page.getByRole('tooltip')).toHaveCount(0)
      await help.focus()
      await expect(page.getByRole('tooltip')).toContainText('История сохраняется.')
      await expect(page.getByRole('tooltip')).toContainText('Пустая цена означает «Не указана»')
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({
        path: info.outputPath(`${info.project.name}-${width}-services-help.png`),
        fullPage: true,
      })
      await page.mouse.move(0, 0)
      await page.keyboard.press('Escape')
      await expect(page.getByRole('tooltip')).toHaveCount(0)
      await expect(
        page.locator('main > div > p').filter({ hasText: 'Отключение не удаляет историю' }),
      ).toHaveCount(0)
      await control.click()
      const confirm = page.getByRole('dialog', { name: 'Отключить услугу?', exact: true })
      await expect(
        page
          .getByRole('switch', {
            name: 'Активность услуги «Полировка кузова»',
            includeHidden: true,
          })
          .filter({ visible: true }),
      ).toBeChecked()
      await confirm.getByRole('button', { name: 'Оставить активной', exact: true }).click()
      expect(writes).toHaveLength(0)
      await expect(control).toBeFocused()
      await control.click()
      await confirm.getByRole('button', { name: 'Отключить', exact: true }).click()
      await expect(confirm.getByRole('alert')).toBeVisible()
      await expect(
        page
          .getByRole('switch', {
            name: 'Активность услуги «Полировка кузова»',
            includeHidden: true,
          })
          .filter({ visible: true }),
      ).toBeChecked()
      failDelete = false
      await confirm.getByRole('button', { name: 'Повторить отключение', exact: true }).click()
      await expect(confirm).toHaveCount(0)
      await expect(control).not.toBeChecked()
      await filters.getByRole('button', { name: 'Активные · 0', exact: true }).click()
      await expect(page.getByRole('switch')).toHaveCount(0)
      await filters.getByRole('button', { name: 'Отключённые · 1', exact: true }).click()
      await control.focus()
      await page.keyboard.press('Space')
      await expect(page.getByRole('switch')).toHaveCount(0)
      await filters.getByRole('button', { name: 'Все · 1', exact: true }).click()
      await expect(control).toBeChecked()
      expect(writes).toEqual([
        { method: 'DELETE', body: null },
        { method: 'DELETE', body: null },
        { method: 'PATCH', body: { active: true } },
      ])
      await page
        .getByRole('button', { name: 'Изменить услугу «Полировка кузова»', exact: true })
        .click()
      await expect(page.getByRole('dialog', { name: 'Изменить услугу', exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      )
    } finally {
      fixture.dispose()
    }
  })
}
