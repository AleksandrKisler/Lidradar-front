import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  CONVERSATION_ID,
  mockGuest,
  mockOwner,
  RISK_ID,
  TENANT_ID,
  confirmTelegramLink,
  INVITATION_CODE,
  USED_INVITATION_CODE,
  failNextMemberCommand,
  ADMIN_IDS,
  failNextAdminCommand,
  setOpportunityStage,
} from './fixtures/api'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa']

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  expect(violations).toEqual([])
}

test.describe('гость', () => {
  test.beforeEach(async ({ page }) => mockGuest(page))

  test('защищённый адрес ведёт на вход с путём возврата', async ({ page }) => {
    await page.goto('/radar?severity=HIGH')
    await expect(page).toHaveURL(/\/login\?redirect=\/radar\?severity=HIGH$/)
    await expect(
      page.getByRole('heading', { name: 'Войдите в своё рабочее пространство' }),
    ).toBeVisible()
    await expectNoAxeViolations(page)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  })

  test('форма входа проверяет поля и не раскрывает причину отказа', async ({ page }) => {
    await page.goto('/login')
    const submit = page.getByRole('button', { name: 'Войти' })
    await submit.click()
    await expect(page.getByText('Введите электронную почту')).toBeVisible()
    await expect(page.getByText('Введите пароль')).toBeVisible()

    await page.getByLabel('Электронная почта').fill('owner@example.test')
    await page.getByLabel('Пароль', { exact: true }).fill('wrong-password-123')
    await submit.click()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Не удалось войти')
    await expect(alert).toContainText('Проверьте электронную почту и пароль')
    await expect(page.getByLabel('Пароль', { exact: true })).toHaveValue('wrong-password-123')
    await expectNoAxeViolations(page)
  })

  test('неизвестный адрес показывает страницу 404', async ({ page }) => {
    await page.goto('/missing-page')
    await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible()
    await page.getByRole('link', { name: 'Вернуться в Radar' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('поток сигналов', () => {
  test('сигнал risk.* инвалидирует ленту, запрос идёт с заголовком организации', async ({
    page,
  }) => {
    await mockOwner(page, { events: 'event' })
    const eventRequests: string[] = []
    let risksRequests = 0
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/events')) {
        eventRequests.push(request.headers()['x-tenant-id'] ?? '')
      }
      if (request.url().includes('/api/v1/risks?')) risksRequests += 1
    })
    await page.goto('/radar')
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
    await expect.poll(() => eventRequests.length).toBeGreaterThan(0)
    expect(eventRequests[0]).toBe(TENANT_ID)
    // Первый запрос ленты — загрузка страницы, второй — перечитывание по сигналу.
    await expect.poll(() => risksRequests, { timeout: 10_000 }).toBeGreaterThanOrEqual(2)
  })

  test('без потока интерфейс работает по REST и предупреждает о ручном обновлении', async ({
    page,
  }) => {
    await mockOwner(page, { events: 'unavailable' })
    await page.goto('/radar')
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
    await expect(page.getByText('47 000 ₽')).toBeVisible()
    // На телефоне индикатор живёт в меню, чтобы не вытеснять название организации из шапки.
    const menu = page.getByRole('button', { name: 'Меню' })
    if (await menu.isVisible()) await menu.click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Обновления недоступны' }),
    ).toBeVisible()
    await expectNoAxeViolations(page)
  })
})

test.describe('владелец организации', () => {
  test.beforeEach(async ({ page }) => mockOwner(page))

  test('Radar показывает сводку, ленту и фильтр в адресе', async ({ page }) => {
    const risksRequests: string[] = []
    const tenantHeaders: string[] = []
    page.on('request', (request) => {
      if (!request.url().includes('/api/v1/')) return
      if (request.url().includes('/api/v1/risks')) risksRequests.push(request.url())
      const header = request.headers()['x-tenant-id']
      if (header) tenantHeaders.push(header)
    })

    await page.goto('/')
    await expect(page).toHaveURL(/\/radar$/)
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
    // Название организации видно в шапке при любой ширине; боковая панель на телефоне скрыта.
    await expect(page.getByRole('banner').getByText('Студия «Блик»')).toBeVisible()
    await expect(page.getByText('47 000 ₽')).toBeVisible()
    await expect(page.getByText('12 000 ₽')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Дмитрий Соколов' })).toHaveCount(2)
    await expectNoAxeViolations(page)

    await page.getByLabel('Важность').selectOption('CRITICAL')
    await expect(page).toHaveURL(/severity=CRITICAL/)
    await expect(page.getByRole('heading', { name: 'Дмитрий Соколов' })).toHaveCount(1)
    expect(
      risksRequests.some((url) => url.includes('severity=CRITICAL') && url.includes('active=true')),
    ).toBe(true)

    // Каждый tenant-scoped запрос несёт заголовок выбранной организации.
    expect(tenantHeaders.length).toBeGreaterThan(0)
    expect(new Set(tenantHeaders)).toEqual(new Set([TENANT_ID]))
  })

  test('карточка риска: контекст, команды и история', async ({ page }) => {
    await page.goto('/radar?severity=CRITICAL')
    await page.getByRole('link', { name: 'Дмитрий Соколов' }).first().click()
    await expect(page).toHaveURL(new RegExp(`/risks/${RISK_ID}$`))
    await expect(page.getByRole('heading', { level: 1, name: 'Дмитрий Соколов' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Почему это риск' })).toBeVisible()
    await expect(
      page.getByText('Бизнес не ответил клиенту в течение 60 рабочих минут'),
    ).toBeVisible()
    await expect(page.getByText('Действий и исходов по этому риску ещё нет.')).toBeVisible()
    await expectNoAxeViolations(page)

    // Команды: взять в работу, получить рекомендацию, записать действие и исход.
    await page.getByRole('button', { name: 'Взять в работу' }).click()
    await expect(page.getByRole('button', { name: 'Взять в работу' })).toHaveCount(0)
    await expect(page.getByText('В работе', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Получить рекомендацию' }).click()
    await expect(page.getByText('Ответьте клиенту и назовите цену.')).toBeVisible()

    await page.getByLabel('Что сделано').selectOption('CALL')
    await page.getByLabel('Заметка').first().fill('Договорились созвониться вечером')
    await page.getByRole('button', { name: 'Записать действие' }).click()
    await expect(page.getByText('Действие записано.')).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'История' }).getByText('Звонок клиенту'),
    ).toBeVisible()

    await page.getByLabel('Чем ответил клиент').selectOption('THINKING')
    await page.getByRole('button', { name: 'Записать исход' }).click()
    await expect(page.getByText('Исход записан.')).toBeVisible()
    await expect(page.getByRole('list', { name: 'История' }).getByText('Думает')).toBeVisible()
    await expectNoAxeViolations(page)

    // Возврат в Radar сохраняет фильтры, с которыми открыли карточку.
    await page.getByRole('link', { name: '← Radar' }).click()
    await expect(page).toHaveURL(/\/radar\?severity=CRITICAL$/)
  })

  test('подтверждение оплаты: возвращённая выручка, затем повтор как обычная оплата', async ({
    page,
  }) => {
    await page.goto(`/risks/${RISK_ID}`)
    // Доказательная цепочка: действие и исход «Оплатил».
    await page.getByLabel('Что сделано').selectOption('CALL')
    await page.getByRole('button', { name: 'Записать действие' }).click()
    await expect(page.getByText('Действие записано.')).toBeVisible()
    await page.getByLabel('Чем ответил клиент').selectOption('PAID')
    await page.getByRole('button', { name: 'Записать исход' }).click()
    await expect(page.getByText('Исход записан.')).toBeVisible()

    await page.getByRole('button', { name: 'Подтвердить оплату' }).click()
    const dialog = page.getByRole('dialog', { name: 'Подтвердить оплату' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Сумма оплаты')).toHaveValue('31000.00')
    await expect(dialog.getByRole('radio', { name: /Возвращённая выручка/ })).toBeChecked()
    await expect(dialog.getByText('риск → звонок клиенту → исход «Оплатил»')).toBeVisible()
    await expectNoAxeViolations(page)

    await dialog.getByLabel('Я подтверждаю, что оплата получена').check()
    await dialog.getByRole('button', { name: 'Подтвердить 31 000 ₽' }).click()
    await expect(dialog.getByText('Оплата подтверждена')).toBeVisible()
    await expect(dialog.getByText('31 000 ₽ · Возвращённая выручка')).toBeVisible()
    await dialog.getByRole('button', { name: 'Готово' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('region', { name: 'Деньги' })).toContainText('31 000 ₽')

    // Вторая оплата: сервер отвечает 409, интерфейс предлагает обычную оплату по решению пользователя.
    await page.getByRole('button', { name: 'Подтвердить оплату' }).click()
    await dialog.getByLabel('Сумма оплаты').fill('5 000')
    await dialog.getByLabel('Я подтверждаю, что оплата получена').check()
    await dialog.getByRole('button', { name: 'Подтвердить 5 000 ₽' }).click()
    await expect(dialog.getByText('Возвращённая выручка уже учтена')).toBeVisible()
    await expect(dialog.getByRole('radio', { name: /Возвращённая выручка/ })).toBeChecked()
    await dialog.getByRole('button', { name: 'Подтвердить как обычную оплату' }).click()
    await expect(dialog.getByText('5 000 ₽ · Оплата без связи с риском')).toBeVisible()
    await dialog.getByRole('button', { name: 'Готово' }).click()
    await expect(page.getByRole('region', { name: 'Деньги' })).toContainText('31 000 ₽')
  })

  test('оценка сигнала: подтверждение, затем ложное срабатывание с каскадом', async ({ page }) => {
    await page.goto(`/risks/${RISK_ID}`)
    const panel = page.getByRole('region', { name: 'Оценка сигнала' })
    await panel.getByRole('radio', { name: /Риск подтвердился/ }).check()
    await panel.getByRole('button', { name: 'Записать оценку' }).click()
    await expect(panel.getByText('Оценка записана')).toBeVisible()
    await expect(panel.getByText('не войдёт в набор для обучения')).toBeVisible()

    await panel.getByRole('button', { name: 'Оценить ещё раз' }).click()
    await panel.getByRole('radio', { name: /Ложное срабатывание/ }).check()
    await panel.getByLabel('Почему сигнал ложный').selectOption('NOT_A_LEAD')
    await expect(panel.getByText('закрыта как потерянная')).toBeVisible()
    await expectNoAxeViolations(page)
    await panel.getByRole('button', { name: 'Записать и закрыть риск' }).click()
    const dialog = page.getByRole('dialog', { name: 'Закрыть риск как ложное срабатывание?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Закрыть риск' }).click()
    await expect(dialog).toBeHidden()
    await expect(panel.getByText('Ложное срабатывание · Это не клиент')).toBeVisible()
    await expect(page.getByText('Риск закрыт: история доступна только для чтения.')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Переписка и сделка' })).toContainText('Потеряна')
  })

  test('диалоги: поиск, фильтр по риску, переписка и более ранние сообщения', async ({ page }) => {
    await page.goto('/conversations')
    await expect(page.getByRole('heading', { name: 'Диалоги' })).toBeVisible()
    const list = page.getByRole('list', { name: 'Список диалогов' })
    await expect(list.getByRole('link')).toHaveCount(3)
    await expect(list.getByText('Без имени')).toBeVisible()
    await expect(list.getByText('Голосовое сообщение')).toBeVisible()
    await expectNoAxeViolations(page)

    await page.getByRole('button', { name: 'С риском' }).click()
    await expect(page).toHaveURL(/withRisk=true/)
    await expect(list.getByRole('link')).toHaveCount(1)
    await page.getByRole('button', { name: 'Все диалоги' }).click()
    await page.getByLabel('Поиск по имени, телефону или почте').fill('елена')
    await expect(page).toHaveURL(/search=%D0%B5%D0%BB%D0%B5%D0%BD%D0%B0|search=елена/)
    await expect(list.getByRole('link')).toHaveCount(1)
    await expect(list.getByText('Елена Волкова')).toBeVisible()
    await page
      .getByRole('button', { name: 'Сбросить фильтры' })
      .isVisible()
      .catch(() => false)
    await page.getByLabel('Поиск по имени, телефону или почте').fill('')
    await expect(list.getByRole('link')).toHaveCount(3)

    await list.getByRole('link', { name: /Дмитрий Соколов/ }).click()
    await expect(page).toHaveURL(new RegExp(`/conversations/${CONVERSATION_ID}$`))
    const thread = page.getByRole('region', { name: 'Сообщения' })
    await expect(page.getByRole('heading', { name: 'Дмитрий Соколов' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Открыть в Telegram' })).toHaveAttribute(
      'href',
      'tg://user?id=123',
    )
    const bubbles = thread.getByRole('list').last().getByRole('listitem')
    await expect(thread.getByText('А на какое время можно завтра?')).toBeVisible()
    await expect(thread.getByText('Вложение недоступно в LidRadar')).toBeVisible()
    await expect(thread.getByText('18 сентября')).toBeVisible()
    await expectNoAxeViolations(page)

    // Ранняя страница ждётся по ответу с курсором: под нагрузкой ответ приходит позже.
    const earlierPage = page.waitForResponse(
      (response) => /\/messages\?.*cursor=/.test(response.url()) && response.ok(),
    )
    await thread.getByRole('button', { name: 'Показать более ранние' }).click()
    await earlierPage
    await expect(thread.getByText('Сообщение удалено в мессенджере.')).toBeVisible()
    await expect(thread.getByText('Удалённый текст')).toHaveCount(0)
    await expect(thread.getByText('Начало переписки')).toBeVisible()
    await expect(thread.getByText('17 сентября')).toBeVisible()
    expect(await bubbles.count()).toBeGreaterThan(0)

    // На телефоне список и переписка — отдельные состояния с возвратом.
    const back = page.getByRole('link', { name: '← К списку' })
    if (await back.isVisible()) {
      await back.click()
      await expect(page).toHaveURL(/\/conversations$/)
      await expect(list.getByRole('link')).toHaveCount(3)
    }
  })

  test('из карточки риска открывается переписка', async ({ page }) => {
    await page.goto(`/risks/${RISK_ID}`)
    await page.getByRole('link', { name: 'Открыть переписку' }).click()
    await expect(page).toHaveURL(new RegExp(`/conversations/${CONVERSATION_ID}$`))
    await expect(page.getByRole('heading', { name: 'Дмитрий Соколов' })).toBeVisible()
  })

  test('настройки: компания, точка, график и услуги', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/settings\/company$/)
    await expect(
      page.getByRole('heading', { name: 'Настройки рабочего пространства' }),
    ).toBeVisible()
    await expect(
      page.getByRole('status').filter({ hasText: /Настройка не завершена/ }),
    ).toHaveCount(0)
    await expectNoAxeViolations(page)

    // Название компании сохраняется без подтверждения, валюта — с предупреждением.
    await page.getByLabel('Название компании').fill('Студия «Блик» и партнёры')
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await expect(page.getByText('Настройки компании сохранены.')).toBeVisible()
    await page.getByLabel('Основная валюта').selectOption('KZT')
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
    const currencyDialog = page.getByRole('dialog', { name: 'Изменить пояс или валюту?' })
    await expect(currencyDialog).toContainText('Исторические суммы не конвертируются')
    await currencyDialog.getByRole('button', { name: 'Отмена' }).click()

    // Новая точка через диалог появляется в списке.
    await page.getByRole('button', { name: 'Добавить точку' }).click()
    const locationDialog = page.getByRole('dialog', { name: 'Новая точка' })
    await locationDialog.getByLabel('Название точки').fill('Студия на Пресне')
    await locationDialog.getByLabel('Порог ответа, минут').fill('60')
    await locationDialog.getByRole('button', { name: 'Создать точку' }).click()
    await expect(page.getByRole('list', { name: 'Список точек' })).toContainText('Студия на Пресне')

    // График: воскресенье становится рабочим, неделя уходит одним запросом.
    const putHours = page.waitForRequest(
      (request) => request.method() === 'PUT' && request.url().includes('/business-hours'),
    )
    await page.getByLabel('Воскресенье', { exact: true }).check()
    await page.getByRole('button', { name: 'Сохранить график' }).click()
    const request = await putHours
    expect((request.postDataJSON() as { days: unknown[] }).days).toHaveLength(7)
    await expect(page.getByText('График сохранён.')).toBeVisible()

    // Услуги: добавить, отключить с подтверждением, включить снова.
    await page.getByRole('link', { name: 'Услуги' }).click()
    await expect(page).toHaveURL(/\/settings\/services$/)
    await expect(page.getByRole('table', { name: 'Услуги организации' })).toContainText(
      'Полировка кузова',
    )
    await page.getByRole('button', { name: 'Добавить услугу' }).click()
    const serviceDialog = page.getByRole('dialog', { name: 'Новая услуга' })
    await serviceDialog.getByLabel('Название услуги').fill('Защитная плёнка')
    await serviceDialog.getByLabel('Цена от').fill('50 000')
    await serviceDialog.getByLabel('Цена до').fill('90 000')
    await serviceDialog.getByRole('button', { name: 'Добавить услугу' }).click()
    await expect(page.getByRole('table', { name: 'Услуги организации' })).toContainText(
      '50 000–90 000 ₽',
    )
    await expectNoAxeViolations(page)

    const row = page.getByRole('row', { name: /Защитная плёнка/ })
    await row.getByRole('button', { name: 'Отключить' }).click()
    await page
      .getByRole('dialog', { name: 'Отключить услугу?' })
      .getByRole('button', { name: 'Отключить' })
      .click()
    await expect(row).toContainText('Отключена')
    await row.getByRole('button', { name: 'Включить' }).click()
    await expect(row).toContainText('Активна')
    await page.getByRole('button', { name: /Отключённые/ }).click()
    await expect(page.getByText('В этом фильтре услуг нет.')).toBeVisible()
  })

  test('онбординг возобновляется с шага, который назвал сервер', async ({ page }) => {
    await page.goto('/onboarding')
    // У организации есть точка, но нет графика на всю неделю и есть услуга: сервер ведёт к источнику.
    await expect(page).toHaveURL(/\/onboarding\/channel$/)
    await expect(page.getByRole('heading', { name: 'Источник сообщений' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Шаги настройки' })).toContainText('Точка и график')
    await expect(page.getByRole('link', { name: 'Перейти к подключению' })).toHaveAttribute(
      'href',
      '/integrations',
    )
    // Шаги слева видны на широком экране; на телефоне колонка скрыта, содержимое остаётся.
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await expect(page.getByRole('navigation', { name: 'Шаги начала работы' })).toBeVisible()
    }
    await expectNoAxeViolations(page)
    await page.getByRole('link', { name: 'Назад' }).click()
    await expect(page).toHaveURL(/\/onboarding\/services$/)
    await expect(page.getByRole('list', { name: 'Добавленные услуги' })).toContainText(
      'Полировка кузова',
    )
    await page.getByRole('link', { name: 'Назад' }).click()
    await expect(page).toHaveURL(/\/onboarding\/location$/)
    await expect(page.getByRole('heading', { name: 'График точки' })).toBeVisible()
    await page.getByRole('button', { name: 'Сохранить график' }).click()
    await expect(page.getByText('График сохранён.')).toBeVisible()
    await page.getByRole('button', { name: 'Продолжить' }).click()
    await expect(page).toHaveURL(/\/onboarding\/services$/)
  })

  test('интеграции: подключение Telegram и webhook, проверка связи, отключение', async ({
    page,
  }) => {
    await page.goto('/integrations')
    await expect(page.getByRole('heading', { name: 'Интеграции' })).toBeVisible()
    await expect(page.getByText('Источников пока нет')).toBeVisible()
    await expectNoAxeViolations(page)

    // Telegram: токен проверяется по формату и уходит один раз.
    await page.getByRole('button', { name: 'Подключить источник' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Подключить источник' })
    await dialog.getByLabel('Название подключения').fill('Telegram · переписка клиентов')
    await dialog.getByLabel('Токен бота').fill('not-a-token')
    await dialog.getByRole('button', { name: 'Подключить' }).click()
    await expect(dialog.getByText('Токен бота имеет вид')).toBeVisible()
    // Отправка клавишей с клавиатуры страницы: форма исчезает сразу после
    // отправки, а действия Playwright над элементом (click, press) повторяются
    // при его исчезновении и могут зависнуть или отправить форму дважды.
    await dialog.getByLabel('Токен бота').fill('123456789:AAHf1234567890abcdefghijklmnop')
    await page.keyboard.press('Enter')
    await expect(dialog.getByText('Подключение создано')).toBeVisible()
    await expect(dialog.getByText('Секрет подписи webhook')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Готово' }).click()
    const list = page.getByRole('list', { name: 'Подключения' })
    // Карточки — прямые элементы списка: внутри есть вложенный список возможностей.
    const cards = list.locator(':scope > li')
    await expect(cards).toHaveCount(1)
    await expect(list).toContainText('Telegram · переписка клиентов')
    await expect(list).toContainText('Работает')

    // Webhook без своего секрета: секрет выпускает сервер и показывает один раз.
    await page.getByRole('button', { name: 'Подключить источник' }).click()
    await dialog.getByLabel('Источник').selectOption('GENERIC_WEBHOOK')
    await dialog.getByLabel('Название подключения').fill('CRM')
    await page.keyboard.press('Enter')
    await expect(dialog.getByTestId('webhook-secret')).toHaveText(
      'e2e-issued-secret-0123456789abcdef',
    )
    await expectNoAxeViolations(page)
    await dialog.getByRole('button', { name: 'Готово' }).click()
    await expect(cards).toHaveCount(2)

    // Проверка связи различает REMOTE и LOCAL.
    const telegramCard = list
      .getByRole('listitem')
      .filter({ hasText: 'Telegram · переписка клиентов' })
    await telegramCard.getByRole('button', { name: 'Проверить связь' }).click()
    await expect(telegramCard.getByRole('status')).toContainText('провайдер опрошен')
    const webhookCard = cards.filter({ hasText: 'CRM' })
    await webhookCard.getByRole('button', { name: 'Проверить связь' }).click()
    await expect(webhookCard.getByRole('status')).toContainText('сохранённое состояние')

    // Отключение с подтверждением: карточка остаётся как отключённая.
    await webhookCard.getByRole('button', { name: 'Отключить' }).click()
    const confirm = page.getByRole('dialog', { name: 'Отключить источник?' })
    await expect(confirm).toContainText('CRM · Webhook')
    await confirm.getByRole('button', { name: 'Отключить' }).click()
    await expect(webhookCard).toContainText('Отключён')
    await expect(webhookCard.getByRole('button', { name: 'Отключить' })).toHaveCount(0)

    // Шаг онбординга «Источник сообщений» закрыт подключением.
    await page.goto('/onboarding/channel')
    await expect(
      page
        .getByRole('list', { name: 'Шаги настройки' })
        .getByRole('listitem')
        .filter({ hasText: 'Источник сообщений' }),
    ).toContainText('готово')
    // Точка, услуга и источник есть: сервер считает обязательные шаги выполненными.
    await expect(page.getByText('Настройка завершена')).toBeVisible()
  })

  test('уведомления: личная привязка Telegram и настройки по типам рисков', async ({ page }) => {
    await page.goto('/settings/notifications')
    await expect(page.getByRole('heading', { name: 'Уведомления без лишнего шума' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Уведомления' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const telegram = page.getByRole('region', { name: 'Ваши уведомления в Telegram' })
    await expect(telegram).toContainText('Не подключены')
    const rows = page
      .getByRole('list', { name: 'Настройки по типам рисков' })
      .locator(':scope > li')
    await expect(rows).toHaveCount(5)
    await expectNoAxeViolations(page)

    // Telegram-канал без привязки предупреждает, но не запрещает сохранение.
    const row = rows.filter({ hasText: 'Обещание не выполнено' })
    await row.getByText('Обещание не выполнено', { exact: true }).click()
    await row.getByLabel('Личные уведомления в Telegram', { exact: true }).check()
    await expect(row.getByRole('status')).toContainText('Telegram не привязан')

    // Одноразовая ссылка открывается в новой вкладке без opener; проверка подтверждает привязку.
    await telegram.getByRole('button', { name: 'Подключить Telegram' }).click()
    const open = telegram.getByRole('link', { name: 'Открыть бота' })
    await expect(open).toHaveAttribute(
      'href',
      'https://t.me/lidradar_e2e_bot?start=e2e-one-time-token',
    )
    await expect(open).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(open).toHaveAttribute('target', '_blank')
    await expect(telegram).toContainText('Ссылка действует до')
    // До подтверждения в боте любая проверка честно отвечает «ещё не привязан».
    await telegram.getByRole('button', { name: 'Проверить привязку' }).click()
    await expect(telegram.getByRole('status')).toContainText('Привязка ещё не завершена')
    confirmTelegramLink(page)
    // Дальше без кликов: ограниченная автопроверка (раз в 5 с) сама увидит
    // подтверждение, а кнопка после этого исчезает — клик по ней был бы гонкой.
    await expect(telegram).toContainText('Подключены', { timeout: 15_000 })
    await expect(telegram).toContainText('Привязка активна')
    await expect(row.getByRole('status')).toHaveCount(0)

    // Полное тело PUT: сводка в 10:30 и тихие часы через полночь.
    await row.getByLabel('Как уведомлять', { exact: true }).selectOption('DIGEST')
    await row.getByLabel('Время сводки', { exact: true }).fill('10:30')
    await row.getByLabel('Не беспокоить ночью', { exact: true }).check()
    await row.getByLabel('Не беспокоить с', { exact: true }).fill('22:00')
    await row.getByLabel('До', { exact: true }).fill('07:00')
    await expect(row).toContainText('22:00–07:00, через полночь')
    const put = page.waitForRequest(
      (request) =>
        request.method() === 'PUT' &&
        request.url().includes('/notifications/preferences/PROMISE_NOT_FULFILLED'),
    )
    await row.getByRole('button', { name: 'Сохранить' }).click()
    expect((await put).postDataJSON()).toEqual({
      minimumSeverity: 'MEDIUM',
      deliveryMode: 'DIGEST',
      inAppEnabled: true,
      telegramEnabled: true,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      digestTime: '10:30',
    })
    await expect(row).toContainText('Настройка сохранена')
    await expect(row).toContainText('Настроено вами')
    await expect(row).toContainText('Сводкой раз в день')
    await expectNoAxeViolations(page)

    // Сброс возвращает серверное значение по умолчанию.
    await row.getByRole('button', { name: 'Вернуть по умолчанию' }).click()
    const confirm = page.getByRole('dialog', { name: 'Вернуть настройку по умолчанию?' })
    await confirm.getByRole('button', { name: 'Вернуть' }).click()
    await expect(row).toContainText('По умолчанию')
    await expect(row.getByRole('button', { name: 'Вернуть по умолчанию' })).toHaveCount(0)

    // Отключение личной привязки не трогает источники переписки.
    await telegram.getByRole('button', { name: 'Отключить' }).click()
    const unlink = page.getByRole('dialog', { name: 'Отключить личные уведомления?' })
    await unlink.getByRole('button', { name: 'Отключить' }).click()
    await expect(telegram).toContainText('Не подключены')

    // Та же карточка доступна из интеграций и на необязательном шаге онбординга.
    await page.goto('/integrations')
    await expect(page.getByRole('heading', { name: 'Ваши уведомления в Telegram' })).toBeVisible()
  })

  test('команда: участники, код приглашения, роли и отзыв доступа', async ({ page }) => {
    await page.goto('/settings/team')
    await expect(page.getByRole('heading', { name: 'Команда и доступ' })).toBeVisible()
    const rows = page.getByRole('table', { name: 'Участники компании' }).locator('tbody tr')
    await expect(rows).toHaveCount(3)
    const me = rows.filter({ hasText: 'Мария Владелец' })
    await expect(me).toContainText('вы')
    // Единственный активный владелец защищён на клиенте с пояснением.
    await expect(me.getByRole('button', { name: 'Сделать менеджером' })).toBeDisabled()
    await expect(me.getByRole('button', { name: 'Отозвать доступ' })).toBeDisabled()
    await expect(me).toContainText('Единственный активный владелец')
    const former = rows.filter({ hasText: 'Пётр Бывший-Длиннофамильный' })
    await expect(former).toContainText('Доступ отозван')
    await expect(former.getByRole('button')).toHaveCount(0)
    await expect(page.getByText('Приглашений пока нет')).toBeVisible()
    await expectNoAxeViolations(page)

    // Код показывается один раз и не появляется в списке приглашений.
    await page.getByRole('button', { name: 'Пригласить' }).click()
    const invite = page.getByRole('dialog', { name: 'Пригласить в команду' })
    await invite.getByLabel('Заметка для себя').fill('Для Ивана из второй студии')
    await invite.getByRole('button', { name: 'Выпустить код' }).click()
    await expect(invite.getByTestId('invitation-code')).toHaveText(INVITATION_CODE)
    await expect(invite).toContainText('показывается один раз')
    await expectNoAxeViolations(page)
    await invite.getByRole('button', { name: 'Готово' }).click()
    await expect(invite).toBeHidden()
    const invitations = page.getByRole('list', { name: 'Приглашения' })
    await expect(invitations.getByRole('listitem')).toHaveCount(1)
    await expect(invitations).toContainText('Ожидает')
    await expect(invitations).toContainText('Для Ивана из второй студии')
    await expect(page.getByText(INVITATION_CODE)).toHaveCount(0)

    // Второй владелец снимает защиту с первого.
    const anna = rows.filter({ hasText: 'Анна Смирнова' })
    await anna.getByRole('button', { name: 'Сделать владельцем' }).click()
    const promote = page.getByRole('dialog', { name: 'Сделать владельцем?' })
    await expect(promote).toContainText('Анна Смирнова (manager@example.test)')
    await promote.getByRole('button', { name: 'Подтвердить' }).click()
    await expect(anna).toContainText('Владелец')
    await expect(me.getByRole('button', { name: 'Сделать менеджером' })).toBeEnabled()

    // Гонка: сервер отвечает 409 — интерфейс не заявляет успех и перечитывает список.
    await anna.getByRole('button', { name: 'Сделать менеджером' }).click()
    failNextMemberCommand(page, 'LAST_OWNER')
    const demote = page.getByRole('dialog', { name: 'Сделать менеджером?' })
    await demote.getByRole('button', { name: 'Подтвердить' }).click()
    await expect(demote.getByRole('alert')).toContainText('Последний владелец')
    await demote.getByRole('button', { name: 'Отмена' }).click()
    await expect(anna).toContainText('Владелец')

    // Отзыв доступа: строка остаётся с пометкой, защита владельца возвращается.
    await anna.getByRole('button', { name: 'Отозвать доступ' }).click()
    const revoke = page.getByRole('dialog', { name: 'Отозвать доступ?' })
    await expect(revoke).toContainText('Анна Смирнова (manager@example.test)')
    await revoke.getByRole('button', { name: 'Отозвать доступ' }).click()
    await expect(anna).toContainText('Доступ отозван')
    await expect(anna.getByRole('button')).toHaveCount(0)
    await expect(me.getByRole('button', { name: 'Отозвать доступ' })).toBeDisabled()

    // Отзыв приглашения переводит его в историю без кнопки.
    await invitations.getByRole('button', { name: 'Отозвать' }).click()
    const revokeInvite = page.getByRole('dialog', { name: 'Отозвать приглашение?' })
    await revokeInvite.getByRole('button', { name: 'Отозвать' }).click()
    await expect(invitations).toContainText('Отозвано')
    await expect(invitations.getByRole('button', { name: 'Отозвать' })).toHaveCount(0)
    await expectNoAxeViolations(page)
  })

  test('аналитика: окно дат, сводка, точность и оплаты за один период', async ({ page }) => {
    await page.goto('/analytics')
    await expect(page.getByRole('heading', { name: 'От риска — к результату' })).toBeVisible()
    // Окно по умолчанию — 30 дней; подпись периода берётся из ответа сервера.
    await expect(page.getByTestId('analytics-period')).toContainText('Europe/Moscow')
    await expect(page.getByText('30 дн.')).toBeVisible()
    const cards = page.getByRole('list', { name: 'Главные показатели' }).getByRole('listitem')
    await expect(cards).toHaveCount(4)
    await expect(cards.nth(0)).toContainText('24')
    await expect(cards.nth(1)).toContainText('75\u00a0% найденных')
    await expect(cards.nth(3)).toContainText('43\u00a0000\u00a0₽')
    await expect(cards.nth(3)).toContainText('2 оплаты со связью с рисками')
    // График: по одному столбцу на каждую дату окна, без интерполяции.
    const chartRows = page
      .getByRole('table', { name: 'Возвращённая выручка по дням' })
      .locator('tbody tr')
    await expect(chartRows).toHaveCount(30)
    await expect(page.getByRole('figure', { name: /Возвращённая выручка по дням/ })).toBeVisible()
    // Точность: null — «Недостаточно данных», низкое покрытие помечено.
    const precisionRows = page
      .getByRole('table', { name: 'Точность сигналов по типам' })
      .locator('tbody tr')
    await expect(precisionRows).toHaveCount(5)
    await expect(precisionRows.filter({ hasText: 'Нет ответа клиенту' })).toContainText('80\u00a0%')
    const booking = precisionRows.filter({ hasText: 'Запись не подтверждена' })
    await expect(booking).toContainText('Недостаточно данных')
    await expect(booking).toContainText('низкое покрытие')
    // Оплаты: курсорная подгрузка, ссылка на риск у возвращённой выручки.
    const payments = page.getByRole('table', { name: 'Подтверждённые оплаты' }).locator('tbody tr')
    await expect(payments).toHaveCount(1)
    await expect(payments.first().getByRole('link')).toHaveAttribute('href', `/risks/${RISK_ID}`)
    // Вторая страница ждётся по ответу с курсором: под нагрузкой WebKit отвечает медленнее.
    const secondPage = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/analytics/payments') &&
        response.url().includes('cursor=page-2'),
    )
    await page.getByRole('button', { name: 'Показать ещё' }).click()
    await secondPage
    await expect(payments).toHaveCount(2)
    await expect(payments.nth(1)).toContainText('Ольга Кузнецова')
    await expect(page.getByRole('button', { name: 'Показать ещё' })).toHaveCount(0)
    await expectNoAxeViolations(page)

    // Неверное окно не уходит на сервер и объясняется на месте.
    await page.getByLabel('Начало периода').fill('2026-09-30')
    await page.getByLabel('Конец периода').fill('2026-09-01')
    await expect(page.getByRole('alert')).toContainText('Дата начала позже даты окончания')
    await expect(page.getByText('Исправьте период, чтобы увидеть показатели.')).toBeVisible()

    // Пресет «7 дней» пишет даты в адрес; ряд снова по одной точке на дату.
    const weekly = page.waitForResponse(
      (response) => response.url().includes('/api/v1/analytics/summary') && response.ok(),
    )
    await page.getByRole('button', { name: '7 дней' }).click()
    await weekly
    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/)
    await expect(chartRows).toHaveCount(7)
    await expect(page.getByText('7 дн.')).toBeVisible()
  })

  test('данные и согласие: выдача, повтор и отзыв с честным текстом', async ({ page }) => {
    await page.goto('/settings/privacy')
    await expect(page.getByRole('heading', { name: 'Данные и согласие на обучение' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Данные' })).toHaveAttribute('aria-current', 'page')
    const card = page.getByRole('region', { name: 'Согласие на использование данных в наборах' })
    await expect(card).toContainText('Не дано')
    await expect(card).toContainText('используются только для работы сервиса')
    await expectNoAxeViolations(page)

    // Выдача с подтверждением: аудит показывает время и автора.
    await card.getByRole('button', { name: 'Дать согласие' }).click()
    const grant = page.getByRole('dialog', { name: 'Дать согласие на использование данных?' })
    await expect(grant).toContainText('можно отозвать в любой момент')
    await grant.getByRole('button', { name: 'Дать согласие' }).click()
    await expect(card).toContainText('Действует')
    await expect(card).toContainText('Согласие выдано')
    await expect(card.getByTestId('consent-audit')).toContainText('вы')
    await expect(card.getByRole('button', { name: 'Дать согласие' })).toHaveCount(0)

    // Отзыв: текст не обещает удаления истории, запись остаётся с датой отзыва.
    await card.getByRole('button', { name: 'Отозвать согласие' }).click()
    const revoke = page.getByRole('dialog', { name: 'Отозвать согласие?' })
    await expect(revoke).toContainText('история выдач остаётся в аудите')
    await revoke.getByRole('button', { name: 'Отозвать' }).click()
    await expect(card).toContainText('Не дано')
    await expect(card.getByTestId('consent-audit')).toContainText('Отозвано')
    await expect(card.getByRole('button', { name: 'Дать согласие' })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('без права администратора раздел закрыт нейтральным экраном', async ({ page }) => {
    const adminRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/admin/') && !request.url().endsWith('/admin/me')) {
        adminRequests.push(request.url())
      }
    })
    await page.goto('/admin/dead-letters')
    await expect(page.getByText('Раздел недоступен')).toBeVisible()
    await expect(page.getByText('Мёртвые письма')).toHaveCount(0)
    expect(adminRequests).toEqual([])
    await page.goto('/radar')
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Администрирование' })).toHaveCount(0)
  })

  test('этапы сделки: только разрешённые цели, конфликт при гонке и закрытие с подтверждением', async ({
    page,
  }) => {
    await page.goto(`/risks/${RISK_ID}`)
    const context = page.getByRole('region', { name: 'Переписка и сделка' })
    await expect(context.getByTestId('opportunity-stage')).toHaveText('Новая')
    const timeline = context.getByRole('list', { name: 'История этапов' })
    await expect(timeline.getByRole('listitem')).toHaveCount(1)
    await expect(timeline).toContainText('Создана как «Новая»')
    await expect(timeline).toContainText('Правило')

    // Назад, тот же этап и преждевременный выигрыш не предлагаются.
    const select = context.getByLabel('Перевести на этап')
    const values = await select
      .locator('option')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
      )
    expect(values).toEqual([
      'ENGAGED',
      'QUALIFYING',
      'PRICE_SENT',
      'WAITING_CUSTOMER',
      'WAITING_BUSINESS',
      'BOOKING_INTENT',
      'BOOKED',
      'LOST',
    ])
    await select.selectOption('ENGAGED')
    await context.getByRole('button', { name: 'Перевести' }).click()
    await expect(context.getByTestId('opportunity-stage')).toHaveText('В диалоге')
    await expect(timeline.getByRole('listitem')).toHaveCount(2)
    await expect(timeline.getByRole('listitem').first()).toContainText('Новая → В диалоге')
    await expect(timeline.getByRole('listitem').first()).toContainText('Вручную')

    // Гонка: сервер уже перевёл сделку дальше. Либо интерфейс успевает отправить
    // устаревший этап и получает 409 с объяснением, либо сигнал потока уже
    // перечитал сделку и сбросил выбор — в обоих случаях состояние сходится к серверному.
    setOpportunityStage(page, 'BOOKED')
    await select.selectOption('QUALIFYING')
    const transfer = context.getByRole('button', { name: 'Перевести' })
    if (await transfer.isEnabled()) await transfer.click()
    // Итог одинаков: этап перечитан с сервера, а текст конфликта проверяет unit-тест.
    await expect(context.getByTestId('opportunity-stage')).toHaveText('Записан')
    await expect(timeline).toContainText('AI')
    const afterConflict = await select
      .locator('option')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
      )
    expect(afterConflict).toEqual(['WON', 'LOST'])

    // Закрытие требует подтверждения с последствиями; после него — только архив.
    await select.selectOption('LOST')
    await context.getByRole('button', { name: 'Перевести' }).click()
    const confirm = page.getByRole('dialog', { name: 'Перевести сделку в «Потеряна»?' })
    await expect(confirm).toContainText('вернуть её в работу нельзя')
    await confirm.getByRole('button', { name: 'Перевести' }).click()
    await expect(context.getByTestId('opportunity-stage')).toHaveText('Потеряна')
    const closed = await select
      .locator('option')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
      )
    expect(closed).toEqual(['ARCHIVED'])
    await expectNoAxeViolations(page)
  })

  test('закрытие риска требует подтверждения и делает карточку только для чтения', async ({
    page,
  }) => {
    await page.goto(`/risks/${RISK_ID}`)
    await page.getByRole('button', { name: 'Закрыть риск' }).click()
    const dialog = page.getByRole('dialog', { name: 'Закрыть риск?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Отмена' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('button', { name: 'Записать действие' })).toBeVisible()

    await page.getByRole('button', { name: 'Закрыть риск' }).click()
    await page
      .getByRole('dialog', { name: 'Закрыть риск?' })
      .getByRole('button', { name: 'Закрыть риск' })
      .click()
    await expect(page.getByText('Риск закрыт: история доступна только для чтения.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Записать действие' })).toHaveCount(0)
    await expect(page.getByText('Закрыт', { exact: true }).first()).toBeVisible()
  })

  test('неверный идентификатор риска даёт нейтральное «не найдено»', async ({ page }) => {
    await page.goto('/risks/not-a-uuid')
    await expect(page.getByRole('heading', { name: 'Риск не найден' })).toBeVisible()
    await page.getByRole('link', { name: 'Вернуться в Radar' }).click()
    await expect(page).toHaveURL(/\/radar$/)
  })

  test('гостевые страницы недоступны, выход возвращает на вход', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/radar$/)
    // На телефоне кнопка выхода живёт в меню; на десктопе — в боковой панели.
    const menu = page.getByRole('button', { name: 'Меню' })
    if (await menu.isVisible()) await menu.click()
    await page.getByRole('button', { name: 'Выйти' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole('heading', { name: 'Войдите в своё рабочее пространство' }),
    ).toBeVisible()
  })
})

test.describe('менеджер организации', () => {
  test.beforeEach(async ({ page }) => mockOwner(page, { role: 'MANAGER' }))

  test('настройки открываются на личных уведомлениях без разделов владельца', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/settings\/notifications$/)
    await expect(
      page.getByRole('navigation', { name: 'Разделы настроек' }).getByRole('link'),
    ).toHaveText(['Уведомления', 'Данные'])
    await expect(page.getByRole('region', { name: 'Ваши уведомления в Telegram' })).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'Настройки по типам рисков' }).locator(':scope > li'),
    ).toHaveCount(5)
    await expectNoAxeViolations(page)
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      const sections = page.getByRole('navigation', { name: 'Разделы' })
      await expect(sections.getByRole('link', { name: 'Настройки' })).toBeVisible()
      await expect(sections.getByRole('link', { name: 'Интеграции' })).toHaveCount(0)
    }
    // Согласие менеджер читает, но не меняет.
    await page.getByRole('link', { name: 'Данные' }).click()
    await expect(page).toHaveURL(/\/settings\/privacy$/)
    await expect(page.getByText('Не дано')).toBeVisible()
    await expect(page.getByTestId('consent-readonly')).toContainText('может владелец')
    await expect(page.getByRole('button', { name: 'Дать согласие' })).toHaveCount(0)

    // Прямой переход в разделы владельца показывает отказ, а не пустой экран.
    await page.goto('/settings/company')
    await expect(page.getByText('Раздел недоступен')).toBeVisible()
    await page.goto('/analytics')
    await expect(page.getByText('Раздел недоступен')).toBeVisible()
  })
})

test.describe('новый сотрудник', () => {
  test.beforeEach(async ({ page }) => mockOwner(page, { role: 'MANAGER', joinByInvitation: true }))

  test('принимает код приглашения и попадает в организацию', async ({ page }) => {
    await page.goto('/radar')
    // Без членств guard ведёт к созданию организации; оттуда есть путь к коду.
    await expect(page).toHaveURL(/\/onboarding\/company$/)
    await page.getByRole('link', { name: 'Принять приглашение' }).click()
    await expect(page).toHaveURL(/\/invitations\/accept$/)
    await expectNoAxeViolations(page)

    const code = page.getByLabel('Код приглашения')
    await code.fill('short')
    await page.keyboard.press('Enter')
    await expect(page.getByText('Код состоит из 43 символов')).toBeVisible()
    await code.fill(USED_INVITATION_CODE)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alert')).toContainText('Приглашение уже использовано')
    // Пробелы вокруг вставленного кода не мешают.
    await code.fill(`  ${INVITATION_CODE}  `)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Вы в команде' })).toBeVisible()
    await expect(page.getByText(/Организация «Студия «Блик»» добавлена/)).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: 'Открыть рабочее пространство' }).click()
    await expect(page).toHaveURL(/\/radar$/)
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
  })
})

test.describe('администратор платформы', () => {
  test.beforeEach(async ({ page }) => mockOwner(page, { platformAdmin: true }))

  test('обзор, каталоги и мёртвые письма с командами восстановления', async ({ page }) => {
    await page.goto('/radar')
    // На телефоне ссылка живёт в модальном меню, на десктопе — в боковой панели.
    if ((page.viewportSize()?.width ?? 0) < 768) {
      await page.getByRole('button', { name: 'Меню' }).click()
    }
    await page.getByRole('link', { name: 'Администрирование' }).first().click()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByTestId('dead-unhandled')).toHaveText('4')
    await expect(page.getByTestId('snapshot-time')).toBeVisible()
    await expectNoAxeViolations(page)
    // Макетов у раздела нет: снимок обзора — часть отчёта о работе.
    await page.screenshot({ path: 'test-results/mock-admin-overview.png', fullPage: true })

    await page.getByRole('link', { name: 'Организации' }).click()
    const organizations = page.getByRole('table', { name: 'Организации' }).locator('tbody tr')
    await expect(organizations).toHaveCount(2)
    await expect(organizations.nth(1)).toContainText('Приостановлена')

    await page.getByRole('link', { name: 'Задания', exact: true }).click()
    await expect(page.getByRole('table', { name: 'Задания' }).locator('tbody tr')).toHaveCount(2)
    await page.getByLabel('Статус').selectOption('DEAD')
    await expect(page).toHaveURL(/status=DEAD/)
    await expect(page.getByRole('table', { name: 'Задания' }).locator('tbody tr')).toHaveCount(1)

    // Мёртвые письма: команда подтверждается с типом, объектом и организацией.
    await page.getByRole('link', { name: 'Мёртвые письма' }).click()
    const deadJobs = page.getByRole('list', { name: 'Мёртвые задания' }).getByRole('listitem')
    await expect(deadJobs).toHaveCount(1)
    await page.screenshot({ path: 'test-results/mock-admin-dead-letters.png', fullPage: true })
    await deadJobs.first().getByRole('button', { name: 'Повторить' }).click()
    const confirm = page.getByRole('dialog', { name: 'Повторить: задание?' })
    await expect(confirm).toContainText(ADMIN_IDS.deadJob)
    await expect(confirm).toContainText(TENANT_ID)
    await confirm.getByRole('button', { name: 'Повторить' }).click()
    await expect(page.getByText('Мёртвых заданий нет')).toBeVisible()

    // Гонка: 409 объясняет, что объект уже изменился, успех не заявляется.
    await page.getByRole('tab', { name: /Событие outbox/ }).click()
    const deadEvents = page.getByRole('list', { name: 'Мёртвые события' }).getByRole('listitem')
    await expect(deadEvents).toHaveCount(1)
    failNextAdminCommand(page)
    await deadEvents.first().getByRole('button', { name: 'Отложить' }).click()
    const discard = page.getByRole('dialog', { name: 'Отложить: событие outbox?' })
    await discard.getByRole('button', { name: 'Отложить' }).click()
    await expect(discard.getByRole('alert')).toContainText('Состояние уже изменилось')
    await discard.getByRole('button', { name: 'Отмена' }).click()
    await expect(deadEvents).toHaveCount(1)
    await deadEvents.first().getByRole('button', { name: 'Отложить' }).click()
    await page
      .getByRole('dialog', { name: 'Отложить: событие outbox?' })
      .getByRole('button', { name: 'Отложить' })
      .click()
    await expect(page.getByText('Мёртвых событий нет')).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('AI, потребление, трассировка и администраторы показывают только метаданные', async ({
    page,
  }) => {
    await page.goto('/admin/ai')
    await expect(page.getByRole('list', { name: 'AI-узлы' }).getByRole('listitem')).toHaveCount(2)
    await expect(page.getByRole('table', { name: 'Прогоны' }).locator('tbody tr')).toHaveCount(2)
    await page.getByLabel('Организация (UUID)').nth(1).fill(TENANT_ID)
    await page.getByLabel('Переписка (UUID)').fill(CONVERSATION_ID)
    await page.getByRole('button', { name: 'Показать' }).click()
    const summary = page.getByTestId('conversation-summary')
    await expect(summary).toContainText('service_interest')
    // Значение факта показано как текст: разметка внутри не исполняется.
    await expect(summary).toContainText('<script>alert(1)</script>')
    await expect(summary).toContainText('слабый')

    await page.goto('/admin/usage')
    await expect(
      page.getByRole('table', { name: 'Потребление по организациям' }).locator('tbody tr'),
    ).toHaveCount(1)
    await page.getByLabel('Начало (UTC)').fill('2026-09-30')
    await page.getByLabel('Конец (UTC)').fill('2026-09-01')
    await expect(page.getByRole('alert')).toContainText('Дата начала позже даты окончания')

    await page.goto('/admin/trace')
    await page.getByLabel('Организация (UUID)').fill(TENANT_ID)
    await page.getByLabel('Сообщение (UUID)').fill(TENANT_ID)
    await page.getByRole('button', { name: 'Построить трассу' }).click()
    await expect(page.getByText('Сообщение не найдено')).toBeVisible()
    await page.getByLabel('Сообщение (UUID)').fill(ADMIN_IDS.message)
    await page.getByRole('button', { name: 'Построить трассу' }).click()
    await expect(page.getByRole('heading', { name: 'Бизнес-артефакты' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Риски' }).getByRole('listitem')).toHaveCount(1)
    await expect(page.getByRole('list', { name: 'Выручка' })).toContainText('31\u00a0000\u00a0₽')
    await expectNoAxeViolations(page)

    await page.goto('/admin/admins')
    const admins = page
      .getByRole('list', { name: 'Администраторы платформы' })
      .getByRole('listitem')
    await expect(admins).toHaveCount(2)
    await page.getByLabel('Электронная почта').fill('night@example.test')
    await page.getByRole('button', { name: 'Выдать право' }).click()
    await expect(page.getByText('Право выдано: night@example.test')).toBeVisible()
    await expect(admins).toHaveCount(3)
    const other = admins.filter({ hasText: 'Дежурный инженер' })
    await other.getByRole('button', { name: 'Отозвать' }).click()
    const revoke = page.getByRole('dialog', { name: 'Отозвать право администратора?' })
    await expect(revoke).toContainText('ops@example.test')
    await revoke.getByRole('button', { name: 'Отозвать' }).click()
    await expect(other).toContainText('Отозвано')
    await expect(other.getByRole('button', { name: 'Отозвать' })).toHaveCount(0)
  })
})
