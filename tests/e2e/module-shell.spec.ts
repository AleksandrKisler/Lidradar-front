import { expect, test } from '@playwright/test'
import { CONVERSATION_ID, mockOwner } from './fixtures/api'

const modules = [
  { path: '/conversations', label: 'Диалоги', suffix: 'Все точки', date: true },
  { path: '/analytics', label: 'Аналитика', suffix: null, date: true },
  { path: '/integrations', label: 'Интеграции', suffix: null, date: true },
  { path: '/settings/company', label: 'Настройки', suffix: 'Настройки', date: false },
] as const

test.describe('общая оболочка C четырёх разделов', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-25T11:30:00Z'))
    await mockOwner(page)
  })

  for (const width of [1440, 834, 390, 320]) {
    for (const module of modules) {
      test(`${module.label} / ${width}: общие header/sidebar, контекст и активный раздел`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: width === 834 ? 1194 : 1000 })
        await page.goto(module.path)
        const main = page.getByRole('main')
        const context = main.locator(':scope > div').first()
        const contextText = context.locator('p').first()
        await expect(contextText).toContainText('Студия «Блик»')
        await expect(contextText).toHaveText(
          module.suffix ? `Студия «Блик» / ${module.suffix}` : 'Студия «Блик»',
        )
        const date = context.getByText(/2026 · .*МСК/)
        if (module.date) await expect(date).toBeVisible()
        else await expect(date).toHaveCount(0)
        const gear = page.getByRole('link', { name: 'Настройки', exact: true })
        await expect(gear).toBeVisible()
        if (module.label === 'Настройки') await expect(gear).toHaveAttribute('aria-current', 'page')
        else await expect(gear).not.toHaveAttribute('aria-current')
        if (width >= 1024) {
          const aside = page.locator('aside')
          expect((await aside.boundingBox())!.width).toBe(240)
          const nav = aside.getByRole('navigation', { name: 'Разделы', exact: true })
          await expect(nav.getByRole('link')).toHaveCount(4)
          await expect(nav.getByRole('link', { name: 'Настройки', exact: true })).toHaveCount(0)
          const selected = nav.locator('[aria-current="page"]')
          if (module.label === 'Настройки') await expect(selected).toHaveCount(0)
          else await expect(selected).toHaveText(module.label)
          await expect(context.getByText('Мария Владелец', { exact: true })).toBeVisible()
          await expect(context.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible()
          const bottom = await aside
            .getByText('Рабочее пространство', { exact: true })
            .evaluate(
              (element) =>
                innerHeight - element.closest('aside > div')!.getBoundingClientRect().bottom,
            )
          expect(bottom).toBe(24)
        } else {
          const trigger = page.getByRole('button', { name: 'Меню', exact: true })
          const bar = page.locator('header').filter({ has: trigger })
          expect((await bar.boundingBox())!.height).toBe(width >= 768 ? 72 : 64)
          await trigger.press('Enter')
          const menu = page.getByRole('dialog', { name: 'Меню', exact: true })
          await expect(menu).toBeVisible()
          expect((await menu.boundingBox())!.width).toBe(
            width === 320 ? 320 : width >= 768 ? 360 : 344,
          )
          const selected = menu
            .getByRole('navigation', { name: 'Разделы', exact: true })
            .locator('[aria-current="page"]')
          if (module.label === 'Настройки') await expect(selected).toHaveCount(0)
          else await expect(selected).toHaveText(module.label)
          for (let index = 0; index < 10; index += 1) {
            await page.keyboard.press('Tab')
            expect(await menu.evaluate((element) => element.contains(document.activeElement))).toBe(
              true,
            )
          }
          await page.keyboard.press('Escape')
          await expect(menu).toBeHidden()
          await expect(trigger).toBeFocused()
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        ).toBeLessThanOrEqual(0)
      })
    }
  }

  test('деталь диалога остаётся в Диалогах, а смена разделов не оставляет старый контекст', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`/conversations/${CONVERSATION_ID}?q=Дмитрий`)
    const nav = page.locator('aside').getByRole('navigation', { name: 'Разделы', exact: true })
    await expect(nav.getByRole('link', { name: 'Диалоги', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await nav.getByRole('link', { name: 'Аналитика', exact: true }).click()
    await expect(page).toHaveURL(/\/analytics$/)
    const context = page.getByRole('main').locator(':scope > div').first()
    await expect(context.locator('p').first()).toHaveText('Студия «Блик»')
    await page.getByRole('link', { name: 'Настройки', exact: true }).click()
    await expect(page).toHaveURL(/\/settings\/company$/)
    await expect(context.locator('p').first()).toHaveText('Студия «Блик» / Настройки')
    await expect(context.getByText(/2026 ·/)).toHaveCount(0)
  })

  test('предупреждение потери обновлений остаётся на перенесённых страницах', async ({ page }) => {
    await mockOwner(page, { events: 'unavailable' })
    for (const module of modules) {
      await page.goto(module.path)
      await expect(
        page.getByText('Обновления недоступны: обновляйте вручную', { exact: true }),
      ).toBeVisible()
    }
  })
})
