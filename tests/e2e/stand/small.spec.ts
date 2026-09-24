/** Основной сквозной набор на небольшой студии: только чтение, снимки для отчёта. */
import { apiSnapshot, expect, openStand, requireStand, riskDetailRequests, test } from './support'

test.use({ trace: 'off', video: 'off', screenshot: 'off' })

test.describe('стенд · небольшая студия', () => {
  requireStand()

  test('Radar, фильтр и карточка риска без N+1 и без смешения организаций', async ({
    browser,
    baseURL,
  }) => {
    const stand = await openStand(browser, baseURL!, 'small')
    const { page, requests } = stand
    await page.goto('/radar')
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
    const feed = page.getByRole('list', { name: 'Список активных рисков' })
    await expect(feed).toBeVisible()
    // Сессия читается один раз; поток сигналов открыт; лента не читает карточки построчно.
    expect(requests.filter((item) => item.url.endsWith('/api/v1/auth/me'))).toHaveLength(1)
    await expect(page.getByRole('status').filter({ hasText: 'Обновления онлайн' })).toBeVisible()
    expect(riskDetailRequests(requests)).toBe(0)
    const summary = await apiSnapshot<{ openRisks: number }>(stand, '/api/v1/radar')
    expect(summary.openRisks).toBeGreaterThan(0)
    await page.screenshot({ path: 'test-results/stand-radar.png', fullPage: true })

    const filtered = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/risks?') && response.url().includes('severity=HIGH'),
    )
    await page.getByLabel('Важность').selectOption('HIGH')
    await expect(page).toHaveURL(/severity=HIGH/)
    await filtered
    const tenants = new Set(requests.map((item) => item.tenant).filter(Boolean))
    expect(tenants.size, 'все запросы адресованы одной организации').toBe(1)

    await feed.getByRole('link').first().click()
    await expect(page).toHaveURL(/\/risks\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: 'Почему это риск' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Этапы сделки' })).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'История этапов' }).getByRole('listitem').first(),
    ).toBeVisible()
    await page.screenshot({ path: 'test-results/stand-risk.png', fullPage: true })
    // Диалог оплаты открывается и закрывается без записи.
    await page.getByRole('button', { name: 'Подтвердить оплату' }).click()
    const dialog = page.getByRole('dialog', { name: 'Подтвердить оплату' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Отмена' }).click()
    await expect(dialog).toBeHidden()
    await page.getByRole('link', { name: '← Radar' }).click()
    await expect(page).toHaveURL(/severity=HIGH/)
    await stand.context.close()
  })

  test('диалоги, настройки, аналитика и интеграции читаются без изменений', async ({
    browser,
    baseURL,
  }) => {
    const stand = await openStand(browser, baseURL!, 'small')
    const { page } = stand
    await page.goto('/conversations')
    const conversationLinks = page.getByRole('list', { name: 'Список диалогов' }).getByRole('link')
    await expect(conversationLinks.first()).toBeVisible()
    await conversationLinks.first().click()
    await expect(page).toHaveURL(/\/conversations\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('region', { name: 'Сообщения' })).toBeVisible()
    await page.screenshot({ path: 'test-results/stand-conversations.png', fullPage: true })

    await page.goto('/settings/company')
    await expect(page.getByLabel('Название компании')).not.toHaveValue('')
    await expect(
      page.getByRole('list', { name: 'Список точек' }).getByRole('listitem').first(),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Услуги' }).click()
    await expect(
      page.getByRole('table', { name: 'Услуги организации' }).getByRole('row').nth(1),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Уведомления' }).click()
    await expect(page.getByRole('region', { name: 'Ваши уведомления в Telegram' })).toContainText(
      /Не подключены|Подключены/,
    )
    const preferenceRows = page
      .getByRole('list', { name: 'Настройки по типам рисков' })
      .locator(':scope > li')
    await expect(preferenceRows).toHaveCount(5)
    await page.screenshot({ path: 'test-results/stand-notifications.png', fullPage: true })
    await page.getByRole('link', { name: 'Команда' }).click()
    const memberRows = page.getByRole('table', { name: 'Участники компании' }).locator('tbody tr')
    await expect(memberRows.filter({ hasText: 'вы' })).toHaveCount(1)
    await page.screenshot({ path: 'test-results/stand-team.png', fullPage: true })
    await page.getByRole('link', { name: 'Данные' }).click()
    await expect(
      page.getByRole('region', { name: 'Согласие на использование данных в наборах' }),
    ).toContainText(/Не дано|Действует/)

    await page.goto('/analytics')
    await expect(page.getByTestId('analytics-period')).toBeVisible()
    await expect(
      page.getByRole('table', { name: 'Точность сигналов по типам' }).locator('tbody tr'),
    ).toHaveCount(5)
    await page.screenshot({ path: 'test-results/stand-analytics.png', fullPage: true })

    await page.goto('/integrations')
    await expect(
      page.getByRole('list', { name: 'Подключения' }).locator(':scope > li').first(),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ваши уведомления в Telegram' })).toBeVisible()
    await page.screenshot({ path: 'test-results/stand-integrations.png', fullPage: true })
    await stand.context.close()
  })

  test('администрирование закрыто, выход возвращает на вход с путём возврата', async ({
    browser,
    baseURL,
  }) => {
    const stand = await openStand(browser, baseURL!, 'small')
    const { page } = stand
    await page.goto('/admin')
    await expect(page.getByText('Раздел недоступен')).toBeVisible()
    await page.screenshot({ path: 'test-results/stand-admin-denied.png', fullPage: true })
    await page.goto('/radar')
    await page.getByRole('button', { name: 'Выйти' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/radar?severity=HIGH')
    await expect(page).toHaveURL(/\/login\?redirect=\/radar\?severity=HIGH$/)
    await stand.context.close()
  })
})
