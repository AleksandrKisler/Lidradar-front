/**
 * Smoke-проверка на учебном стенде backend (не часть `npm run test:e2e`).
 *
 * Запускается только при заданном пути к файлу с паролем стенда и адресе
 * dev-сервера, который проксирует `/api` на стенд:
 *
 *   LIDRADAR_STAND_PASSWORD_FILE=../Lidradar/runtime/frontend/password.txt \
 *   E2E_BASE_URL=http://127.0.0.1:5173 npx playwright test tests/e2e/stand.spec.ts --project=chromium
 *
 * Вход выполняется API-запросом, а cookie сессии переносится в браузерный
 * контекст: пароль читается из файла и не попадает в отчёты, трассы и вывод.
 */
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const passwordFile = process.env.LIDRADAR_STAND_PASSWORD_FILE
const email = process.env.LIDRADAR_STAND_EMAIL ?? 'small@lidradar.test'

// Трассы и видео могли бы сохранить cookie сессии стенда — отключены.
test.use({ trace: 'off', video: 'off' })

test.describe('учебный стенд', () => {
  test.skip(
    !passwordFile || !process.env.E2E_BASE_URL,
    'нужны LIDRADAR_STAND_PASSWORD_FILE и E2E_BASE_URL',
  )

  test('вход, Radar, фильтр и выход на реальном API', async ({ browser, playwright, baseURL }) => {
    const password = readFileSync(passwordFile!, 'utf8').trim()
    const api = await playwright.request.newContext({ baseURL: baseURL! })
    const login = await api.post('/api/v1/auth/login', { data: { email, password } })
    expect(login.status(), 'вход по API').toBe(200)
    const state = await api.storageState()
    await api.dispose()
    expect(state.cookies.some((cookie) => cookie.name === 'lidradar_session')).toBe(true)

    const context = await browser.newContext({ storageState: state })
    const page = await context.newPage()
    const tenantHeaders: string[] = []
    let meRequests = 0
    page.on('request', (request) => {
      if (!request.url().includes('/api/v1/')) return
      if (request.url().endsWith('/api/v1/auth/me')) meRequests += 1
      const header = request.headers()['x-tenant-id']
      if (header) tenantHeaders.push(header)
    })

    await page.goto('/radar')
    await expect(page).toHaveURL(/\/radar$/)
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Список активных рисков' })).toBeVisible()
    // Сессия читается один раз при загрузке; повторных /auth/me нет.
    expect(meRequests).toBe(1)
    // Поток сигналов стенда открыт: индикатор говорит о канале, не об актуальности данных.
    await expect(page.getByRole('status').filter({ hasText: 'Обновления онлайн' })).toBeVisible()
    await page.screenshot({ path: 'test-results/stand-radar.png', fullPage: true })

    // `networkidle` не наступает: поток сигналов держит соединение открытым.
    const filtered = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/risks?') && response.url().includes('severity=HIGH'),
    )
    await page.getByLabel('Важность').selectOption('HIGH')
    await expect(page).toHaveURL(/severity=HIGH/)
    await filtered
    await expect(page.getByRole('list', { name: 'Список активных рисков' })).toBeVisible()
    await page.screenshot({ path: 'test-results/stand-radar-high.png', fullPage: true })
    expect(new Set(tenantHeaders).size).toBe(1)

    // Карточка риска открывается из ленты и возвращает к ленте с тем же фильтром.
    await page
      .getByRole('list', { name: 'Список активных рисков' })
      .getByRole('link')
      .first()
      .click()
    await expect(page).toHaveURL(/\/risks\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: 'Почему это риск' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'История' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Оценка сигнала' })).toBeVisible()
    await page.screenshot({ path: 'test-results/stand-risk.png', fullPage: true })
    // Диалог оплаты открывается и закрывается без записи: стенд не меняем.
    await page.getByRole('button', { name: 'Подтвердить оплату' }).click()
    const dialog = page.getByRole('dialog', { name: 'Подтвердить оплату' })
    await expect(dialog).toBeVisible()
    await page.screenshot({ path: 'test-results/stand-revenue-dialog.png' })
    await dialog.getByRole('button', { name: 'Отмена' }).click()
    await expect(dialog).toBeHidden()
    await page.getByRole('link', { name: '← Radar' }).click()
    await expect(page).toHaveURL(/severity=HIGH/)

    // Диалоги: список и первая переписка на реальных данных.
    await page
      .getByRole('navigation', { name: 'Разделы' })
      .getByRole('link', { name: 'Диалоги' })
      .click()
    await expect(page).toHaveURL(/\/conversations$/)
    const conversationLinks = page.getByRole('list', { name: 'Список диалогов' }).getByRole('link')
    await expect(conversationLinks.first()).toBeVisible()
    await conversationLinks.first().click()
    await expect(page).toHaveURL(/\/conversations\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('region', { name: 'Сообщения' })).toBeVisible()
    await page.screenshot({ path: 'test-results/stand-conversations.png', fullPage: true })

    // Настройки: компания, точки и услуги стенда читаются без изменений.
    await page
      .getByRole('navigation', { name: 'Разделы' })
      .getByRole('link', { name: 'Настройки' })
      .click()
    await expect(page).toHaveURL(/\/settings\/company$/)
    await expect(page.getByLabel('Название компании')).not.toHaveValue('')
    await expect(
      page.getByRole('list', { name: 'Список точек' }).getByRole('listitem').first(),
    ).toBeVisible()
    await page.screenshot({ path: 'test-results/stand-settings.png', fullPage: true })
    await page.getByRole('link', { name: 'Услуги' }).click()
    await expect(
      page.getByRole('table', { name: 'Услуги организации' }).getByRole('row').nth(1),
    ).toBeVisible()

    // Уведомления: личные настройки и статус привязки читаются; ссылка не выпускается.
    await page.getByRole('link', { name: 'Уведомления' }).click()
    await expect(page).toHaveURL(/\/settings\/notifications$/)
    await expect(page.getByRole('region', { name: 'Ваши уведомления в Telegram' })).toContainText(
      /Не подключены|Подключены/,
    )
    const preferenceRows = page
      .getByRole('list', { name: 'Настройки по типам рисков' })
      .locator(':scope > li')
    await expect(preferenceRows).toHaveCount(5)
    // Закрытые строки тоже держат поля в DOM: ищем внутри раскрытой строки.
    const firstRow = preferenceRows.filter({ hasText: 'Нет ответа клиенту' })
    await firstRow.getByText('Нет ответа клиенту', { exact: true }).click()
    await expect(firstRow.getByLabel('Как уведомлять', { exact: true })).toBeVisible()
    await page.screenshot({ path: 'test-results/stand-notifications.png', fullPage: true })

    // Команда: владелец видит себя в списке, приглашений на стенде нет; ничего не выпускаем.
    await page.getByRole('link', { name: 'Команда' }).click()
    await expect(page).toHaveURL(/\/settings\/team$/)
    const memberRows = page.getByRole('table', { name: 'Участники компании' }).locator('tbody tr')
    await expect(memberRows.first()).toBeVisible()
    await expect(memberRows.filter({ hasText: 'вы' })).toHaveCount(1)
    await expect(page.getByRole('heading', { name: 'Приглашения' })).toBeVisible()
    await page.screenshot({ path: 'test-results/stand-team.png', fullPage: true })

    // Интеграции: подключения стенда читаются без изменений.
    await page
      .getByRole('navigation', { name: 'Разделы' })
      .getByRole('link', { name: 'Интеграции' })
      .click()
    await expect(page).toHaveURL(/\/integrations$/)
    await expect(page.getByRole('heading', { name: 'Источники сообщений' })).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'Подключения' }).locator(':scope > li').first(),
    ).toBeVisible()
    await page.screenshot({ path: 'test-results/stand-integrations.png', fullPage: true })

    await page.getByRole('button', { name: 'Выйти' }).click()
    await expect(page).toHaveURL(/\/login$/)
    // Адрес по умолчанию (/radar) в путь возврата не попадает, адрес с фильтром — попадает.
    await page.goto('/radar?severity=HIGH')
    await expect(page).toHaveURL(/\/login\?redirect=\/radar\?severity=HIGH$/)
    await context.close()
  })
})
