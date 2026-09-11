import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
test('demo acknowledgement and keyboard dismissal', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Дмитрий Соколов' })).toBeVisible()
  await page.getByRole('button', { name: 'Признать риск', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Признать риск', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Признать риск', exact: true }).click()
  await page.getByRole('button', { name: 'Подтвердить', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Обращение взято в работу')
  await expect(page.getByRole('button', { name: 'Риск принят' })).toBeDisabled()
})
test('workspace accessibility and responsive width', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Дмитрий Соколов' })).toBeVisible()
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('button', { name: 'Признать риск', exact: true }).click()
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([])
})
test('deep links render fallback', async ({ page }) => {
  await page.goto('/missing-page')
  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible()
  await page.getByRole('link', { name: 'Вернуться в Radar' }).click()
  await expect(page.getByRole('heading', { name: 'Дмитрий Соколов' })).toBeVisible()
})
