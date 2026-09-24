/** Пустой кабинет: честные нулевые состояния, отличимые от ошибок и отключений. */
import { apiSnapshot, expect, openStand, requireStand, test } from './support'

test.use({ trace: 'off', video: 'off', screenshot: 'off' })

test.describe('стенд · пустая организация', () => {
  requireStand()

  test('Radar без рисков отличается от ошибки, напоминание о настройке видно', async ({
    browser,
    baseURL,
  }) => {
    const stand = await openStand(browser, baseURL!, 'empty')
    const { page } = stand
    await page.goto('/radar')
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
    // Успешный пустой ответ: сводка нулевая, ленты нет, ошибок нет.
    const summary = await apiSnapshot<{ openRisks: number }>(stand, '/api/v1/radar')
    expect(summary.openRisks).toBe(0)
    await expect(page.getByText('Не удалось загрузить')).toHaveCount(0)
    await expect(
      page.getByRole('status').filter({ hasText: 'Настройка не завершена' }),
    ).toBeVisible()
    await page.screenshot({ path: 'test-results/stand-empty-radar.png', fullPage: true })

    // Разделы без данных показывают пустые состояния, а не сбой.
    await page.goto('/conversations')
    await expect(page.getByText(/Переписок пока нет|Ничего не найдено/)).toBeVisible()
    await page.goto('/analytics')
    await expect(page.getByTestId('analytics-period')).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'Главные показатели' }).getByRole('listitem'),
    ).toHaveCount(4)
    await page.goto('/integrations')
    await expect(page.getByText('Источников пока нет')).toBeVisible()
    await page.goto('/settings/team')
    await expect(
      page.getByRole('table', { name: 'Участники компании' }).locator('tbody tr'),
    ).toHaveCount(1)
    await stand.context.close()
  })
})
