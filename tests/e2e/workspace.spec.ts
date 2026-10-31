import { expect, test, type Locator, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  CONVERSATION_ID,
  mockGuest,
  mockOwner,
  OPPORTUNITY_ID,
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

/** Разделы настроек: вкладки на десктопе, подписанный выбор раздела на планшете и телефоне. */
async function openSettingsSection(page: Page, name: string) {
  const select = page.getByLabel('Раздел настроек')
  if (await select.isVisible()) await select.selectOption({ label: name })
  else {
    await page
      .getByRole('navigation', { name: 'Разделы настроек' })
      .getByRole('link', { name })
      .click()
  }
}

async function expectSettingsSection(page: Page, name: string) {
  const select = page.getByLabel('Раздел настроек')
  if (await select.isVisible()) await expect(select.locator('option:checked')).toHaveText(name)
  else {
    await expect(
      page.getByRole('navigation', { name: 'Разделы настроек' }).getByRole('link', { name }),
    ).toHaveAttribute('aria-current', 'page')
  }
}

test.describe('гость', () => {
  test.beforeEach(async ({ page }) => mockGuest(page))

  test('защищённый адрес ведёт на вход с путём возврата', async ({ page }) => {
    await page.goto('/radar?severity=HIGH')
    await expect(page).toHaveURL(/\/login\?redirect=\/radar\?severity=HIGH$/)
    await expect(page.getByRole('heading', { name: 'Вход в LidRadar' })).toBeVisible()
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
    // Состояние потока — в доступном имени кнопки обновления и красной точке (Figma 256:2511).
    await expect(
      page.getByRole('button', { name: /Обновить Radar.*Автообновление недоступно/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('status').filter({ hasText: 'Автообновление недоступно' }),
    ).toHaveCount(1)
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
    // Название организации видно в контексте страницы при любой ширине (дизайн v2).
    await expect(page.getByText('Студия «Блик»').filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByText('47 000 ₽')).toBeVisible()
    await expect(page.getByText('12 000 ₽')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Дмитрий Соколов' })).toHaveCount(2)
    await expectNoAxeViolations(page)

    // До 1024 px фильтры лежат в окне «Фильтры» (Figma 630:8248), от 1024 — в панели над лентой.
    const narrow = (page.viewportSize()?.width ?? 0) < 1024
    if (narrow) {
      await page.getByRole('button', { name: 'Фильтры' }).click()
      await page.getByRole('dialog').getByLabel('Важность').selectOption('CRITICAL')
      await page.getByRole('button', { name: 'Готово' }).click()
    } else {
      await page.getByLabel('Важность').selectOption('CRITICAL')
    }
    await expect(page).toHaveURL(/severity=CRITICAL/)
    await expect(page.getByRole('heading', { name: 'Дмитрий Соколов' })).toHaveCount(1)

    // Представление ленты переключается без перезагрузки: список и плитки показывают ту же карточку.
    // На телефоне переключателя нет (Figma 630:7247), лента остаётся в сохранённом виде.
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await page.getByRole('button', { name: 'Список' }).click()
      await expect(page.getByRole('button', { name: 'Список' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await expect(page.getByRole('heading', { name: 'Дмитрий Соколов' })).toHaveCount(1)
      await page.getByRole('button', { name: 'Плитки' }).click()
    } else {
      await expect(page.getByRole('group', { name: 'Представление' })).toHaveCount(0)
    }
    await expect(page.getByRole('link', { name: /Разобрать риск: Дмитрий Соколов/ })).toBeVisible()
    expect(
      risksRequests.some((url) => url.includes('severity=CRITICAL') && url.includes('active=true')),
    ).toBe(true)

    // Каждый tenant-scoped запрос несёт заголовок выбранной организации.
    expect(tenantHeaders.length).toBeGreaterThan(0)
    expect(new Set(tenantHeaders)).toEqual(new Set([TENANT_ID]))
  })

  test('вкладки статуса фильтруют ленту без чисел и сохраняются в адресе', async ({ page }) => {
    const feedRequests: string[] = []
    const summaryRequests: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (/\/api\/v1\/risks\?/.test(url)) feedRequests.push(url)
      if (url.includes('/api/v1/radar')) summaryRequests.push(url)
    })
    // Источник подключён: пустая вкладка говорит о вкладке, а не о подключении.
    await page.route('**/api/v1/organization/onboarding', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          complete: true,
          nextStep: null,
          steps: [{ key: 'CHANNEL', required: true, done: true }],
          facts: {
            activeLocations: 1,
            locationsWithSchedule: 1,
            activeServices: 1,
            connections: 1,
            liveConnections: 1,
            telegramLinked: false,
          },
          computedAt: '2026-10-23T12:00:00Z',
        }),
      }),
    )
    await page.goto('/radar')
    const group = page.getByRole('group', { name: 'Статус рисков' }).filter({ visible: true })
    await expect(group.getByRole('button', { name: 'Все риски' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // Чисел у вкладок нет: сводка не отдаёт разбивку по статусам.
    await expect(group).not.toContainText(/\d/)
    await expect(page.getByRole('heading', { name: 'Дмитрий Соколов' })).toHaveCount(2)
    expect(feedRequests.at(-1)).toContain('active=true')
    expect(feedRequests.at(-1)).not.toContain('status=')

    await expect(page.getByRole('heading', { name: 'Требуют внимания' })).toContainText('· 2')
    await group.getByRole('button', { name: 'Новые' }).click()
    await expect(page).toHaveURL(/status=OPEN/)
    // Число из сводки относится ко всем активным рискам: на вкладке в заголовке его нет.
    await expect(page.getByRole('heading', { name: 'Требуют внимания' })).not.toContainText('·')
    await expect(page.getByText('Это все риски этой вкладки по выбранным фильтрам.')).toBeVisible()
    await expect(group.getByRole('button', { name: 'Новые' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect.poll(() => feedRequests.at(-1)).toContain('status=OPEN')
    expect(feedRequests.at(-1)).not.toContain('active=')

    await group.getByRole('button', { name: 'В работе' }).click()
    await expect(page).toHaveURL(/status=ACKNOWLEDGED/)
    await expect
      .poll(() => feedRequests.at(-1))
      .toMatch(/status=ACKNOWLEDGED&status=ACTED|status=ACTED&status=ACKNOWLEDGED/)
    expect(feedRequests.at(-1)).not.toContain('active=')
    await expect(page.getByText('Нет рисков в работе')).toBeVisible()
    await expect(page.getByText('Сейчас всё под контролем')).toHaveCount(0)

    // Перезагрузка сохраняет вкладку, фильтры её не сбрасывают.
    await page.reload()
    await expect(
      page
        .getByRole('group', { name: 'Статус рисков' })
        .filter({ visible: true })
        .getByRole('button', { name: 'В работе' }),
    ).toHaveAttribute('aria-pressed', 'true')
    const narrow = (page.viewportSize()?.width ?? 0) < 1024
    if (narrow) {
      await page.getByRole('button', { name: 'Фильтры' }).click()
      await page.getByRole('dialog').getByLabel('Важность').selectOption('CRITICAL')
      await page.getByRole('button', { name: 'Готово' }).click()
    } else {
      await page.getByLabel('Важность').selectOption('CRITICAL')
    }
    await expect(page).toHaveURL(/status=ACKNOWLEDGED/)
    await expect(page).toHaveURL(/severity=CRITICAL/)

    // Сводка статус не получает.
    expect(summaryRequests.every((url) => !url.includes('status='))).toBe(true)

    // Возврат на «Все риски» убирает параметр и снова запрашивает active=true.
    await page
      .getByRole('group', { name: 'Статус рисков' })
      .filter({ visible: true })
      .getByRole('button', { name: 'Все риски' })
      .click()
    await expect(page).not.toHaveURL(/status=/)
    await expect.poll(() => feedRequests.at(-1)).toContain('active=true')
  })

  test('Telegram в меню: статус подключения не показывается ни по какому агрегату', async ({
    page,
  }) => {
    // Агрегат liveConnections считает и источники в ERROR, telegramLinked — личные уведомления:
    // ни то ни другое не доказывает исправность конкретного источника переписки.
    await mockOwner(page, { events: 'unavailable' })
    await page.route('**/api/v1/organization/onboarding', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          complete: true,
          nextStep: null,
          steps: [{ key: 'CHANNEL', required: true, done: true }],
          facts: {
            activeLocations: 1,
            locationsWithSchedule: 1,
            activeServices: 1,
            connections: 1,
            liveConnections: 1,
            telegramLinked: true,
          },
          computedAt: '2026-10-23T12:00:00Z',
        }),
      })
    })
    await page.goto('/radar')
    if ((page.viewportSize()?.width ?? 0) < 1024) {
      await page.getByRole('button', { name: 'Меню' }).click()
    }
    await expect(page.getByText('1 точка').filter({ visible: true })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Telegram' })).toHaveCount(0)
    await expect(page.getByText('Подключён', { exact: true })).toHaveCount(0)
    // Путь к управлению источниками остаётся в навигации.
    await expect(
      page.getByRole('link', { name: 'Интеграции', exact: true }).filter({ visible: true }),
    ).toBeVisible()
  })

  test('Radar на телефоне: фильтры в окне, список показывает те же карточки, меню открывается', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/radar')
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
    // Боковая колонка скрыта: разделы открываются в меню, а «Фильтры» — в отдельном окне.
    await expect(page.getByRole('navigation', { name: 'Разделы' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Меню' }).click()
    await expect(
      page.getByRole('dialog').getByRole('navigation', { name: 'Разделы' }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.getByRole('button', { name: 'Фильтры' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Важность').selectOption('CRITICAL')
    await dialog.getByRole('button', { name: 'Готово' }).click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/severity=CRITICAL/)
    // На телефоне список — те же карточки (Figma 630:7726), поэтому переключателя нет (630:7247):
    // ни горизонтальной прокрутки, ни потери ссылки.
    await expect(page.getByRole('group', { name: 'Представление' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Список' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Разобрать риск: Дмитрий Соколов/ })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  })

  test('окна UiDialog: Tab и Option+Tab не выводят фокус из меню, фильтров и формы приглашения', async ({
    page,
    browserName,
  }) => {
    // Codex-R2, пункт 2: в WebKit Tab пропускает кнопки и ссылки (их обходит Option+Tab), и без
    // собственного обхода фокус уходил из окна за подложку.
    const keys = (browserName === 'webkit' ? ['Tab', 'Alt+Tab'] : ['Tab']).flatMap((tab) => [
      tab,
      `Shift+${tab}`,
    ])
    async function expectTabCycle(dialog: Locator, presses: number): Promise<void> {
      for (const key of keys) {
        for (let index = 0; index < presses; index += 1) {
          await page.keyboard.press(key)
          const inside = await dialog.evaluate((element) =>
            element.contains(document.activeElement),
          )
          expect(inside, `${key} №${index + 1}`).toBe(true)
        }
      }
    }
    /** Открывает окно с клавиатуры: так возврат фокуса проверяется одинаково во всех движках. */
    async function openWithKeyboard(trigger: Locator): Promise<void> {
      await trigger.focus()
      await page.keyboard.press('Enter')
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/radar')
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()

    const menuButton = page.getByRole('button', { name: 'Меню' })
    await openWithKeyboard(menuButton)
    const menu = page.getByRole('dialog', { name: 'Меню' })
    await expect(menu).toBeVisible()
    await expectTabCycle(menu, 12)
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(menuButton).toBeFocused()

    const filtersButton = page.getByRole('button', { name: 'Фильтры' })
    await openWithKeyboard(filtersButton)
    const filters = page.getByRole('dialog', { name: 'Фильтры' })
    await expect(filters).toBeVisible()
    await expectTabCycle(filters, 8)
    await page.keyboard.press('Escape')
    await expect(filters).toBeHidden()
    await expect(filtersButton).toBeFocused()

    // Форма с полями и кнопками нижней панели.
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/settings/team')
    await expect(page.getByRole('heading', { name: 'Команда и доступ' })).toBeVisible()
    const inviteButton = page.getByRole('button', { name: 'Пригласить' })
    await openWithKeyboard(inviteButton)
    const invite = page.getByRole('dialog', { name: 'Пригласить в команду' })
    await expect(invite).toBeVisible()
    await expectTabCycle(invite, 6)
    // Клик снаружи закрывает окно, пока нет отправки.
    await page.mouse.click(5, 5)
    await expect(invite).toBeHidden()
  })

  test('карточка риска: контекст, команды и история', async ({ page }) => {
    await page.goto('/radar?severity=CRITICAL')
    await page.getByRole('link', { name: 'Дмитрий Соколов' }).first().click()
    await expect(page).toHaveURL(new RegExp(`/risks/${RISK_ID}$`))
    // Дизайн v2: заголовок — тип риска, клиент — в подзаголовке.
    await expect(page.getByRole('heading', { level: 1, name: 'Нет ответа клиенту' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Почему это риск' })).toBeVisible()
    await expect(
      page.getByText('Бизнес не ответил клиенту в течение 60 рабочих минут').first(),
    ).toBeVisible()
    await expect(page.getByText('Действий пока нет.')).toBeVisible()
    await expectNoAxeViolations(page)

    // Команды: взять в работу, получить рекомендацию, записать действие и исход.
    await page.getByRole('button', { name: 'Взять в работу' }).click()
    await expect(page.getByRole('button', { name: 'Взять в работу' })).toHaveCount(0)
    await expect(page.getByText('В работе', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Получить рекомендацию' }).click()
    await expect(page.getByText('Ответьте клиенту и назовите цену.')).toBeVisible()

    await page.getByLabel('Что вы сделали').selectOption('CALL')
    await page.getByLabel('Заметка').first().fill('Договорились созвониться вечером')
    await page.getByRole('button', { name: 'Записать действие' }).click()
    await expect(page.getByText('Действие записано.')).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'История' }).getByText('Звонок клиенту'),
    ).toBeVisible()

    await page.getByLabel('Чем ответил клиент').selectOption('THINKING')
    await page.getByRole('button', { name: 'Записать исход' }).click()
    await expect(page.getByText('Исход записан.')).toBeVisible()
    await expect(page.getByRole('group', { name: 'Последний исход сделки' })).toContainText(
      'Думает',
    )
    await expect(page.getByRole('list', { name: 'История' }).getByText('Думает')).toHaveCount(0)
    await expectNoAxeViolations(page)

    // Возврат в Radar сохраняет фильтры, с которыми открыли карточку.
    await page.getByRole('main').getByRole('link', { name: 'К рискам', exact: true }).click()
    await expect(page).toHaveURL(/\/radar\?severity=CRITICAL$/)
  })

  test('карточка риска: порядок Tab совпадает с порядком секций, дубликатов нет, черновик переживает смену ширины', async ({
    page,
    browserName,
  }) => {
    type Stop = { name: string; radioGroup: string | null; x: number; y: number }
    const tabStops = async (key: 'Tab' | 'Shift+Tab', limit: number): Promise<Stop[]> => {
      const stops: Stop[] = []
      for (let index = 0; index < limit; index += 1) {
        await page.keyboard.press(key)
        const stop = await page.evaluate(() => {
          const element = document.activeElement as HTMLElement | null
          if (!element || !element.closest('main')) return null
          // Порядок секций важнее порядка внутри секции: формы в ней могут стоять рядом.
          let section: HTMLElement = element
          for (let node: HTMLElement | null = element; node; node = node.parentElement) {
            if (node.matches('section[aria-labelledby]')) section = node
          }
          const box = section.getBoundingClientRect()
          const name =
            element.getAttribute('aria-label') ||
            (element as HTMLInputElement).labels?.[0]?.textContent ||
            element.textContent ||
            element.id
          return {
            name: (name ?? '').trim().slice(0, 40),
            radioGroup: element.matches('input[type="radio"]')
              ? `native-radio:${(element as HTMLInputElement).name}`
              : null,
            x: box.left,
            y: box.top + scrollY,
          }
        })
        if (!stop) break
        stops.push(stop)
      }
      return stops
    }
    const sortedBy = (values: number[]) =>
      values.every((v, i) => i === 0 || v >= values[i - 1]! - 2)

    // Готовность после смены ширины — наблюдаемый признак, а не пауза. Событие смены ширины приходит
    // в браузер асинхронно после setViewportSize (особенно в WebKit/mobile), и только после него секции
    // переезжают между контейнерами. Пока они не переехали, Tab-обход описывает прежнюю раскладку.
    const resizeTo = async (width: number, height = 900) => {
      await page.setViewportSize({ width, height })
      const slot = width < 1024 ? 'flat' : 'left'
      await expect(
        page.locator(`[data-slot="${slot}"]`).getByRole('button', { name: 'Записать действие' }),
      ).toHaveCount(1)
    }
    const focusRefresh = async () => {
      const refresh = page.getByRole('button', { name: 'Обновить' })
      await refresh.focus()
      await expect(refresh).toBeFocused()
    }

    // Независимая native fixture определяет Tab policy текущего браузера/OS:
    // macOS WebKit может пропускать radio при обычном Tab целиком. Продукт
    // должен сохранять native policy, а не зависеть от платформы runner.
    await page.setContent(`
      <form>
        <input id="native-before">
        <input type="radio" name="native-verdict" value="first">
        <input type="radio" name="native-verdict" value="last">
        <input id="native-after">
      </form>
    `)
    await page.locator('#native-before').focus()
    await page.keyboard.press('Tab')
    const nativeEntry = await page.evaluate(() => {
      const active = document.activeElement as HTMLInputElement
      return active.type === 'radio' ? 'radio' : active.id
    })
    expect(['radio', 'native-after']).toContain(nativeEntry)
    const nativeRadioStops = nativeEntry === 'radio' ? 1 : 0

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/risks/${RISK_ID}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Нет ответа клиенту' })).toBeVisible()
    await resizeTo(1280)
    // Один экземпляр каждой формы при любой ширине.
    for (const width of [390, 834, 1023, 1024, 1280]) {
      await resizeTo(width)
      await expect(page.getByRole('button', { name: 'Записать действие' })).toHaveCount(1)
      await expect(page.getByRole('button', { name: 'Получить рекомендацию' })).toHaveCount(1)
      await expect(page.getByRole('button', { name: 'Закрыть риск…' })).toHaveCount(1)
    }

    for (const width of [390, 834, 1023, 1024, 1280]) {
      await resizeTo(width)
      const narrow = width < 1024
      await focusRefresh()
      const forward = await tabStops('Tab', 60)
      // WebKit по умолчанию не ставит Tab-фокус на кнопки и ссылки: остаются только поля форм.
      expect(forward.length, `${width}: в карточке есть управляемые элементы`).toBeGreaterThan(
        browserName === 'webkit' ? 3 : 8,
      )
      if (narrow) {
        // Один столбец: фокус идёт сверху вниз, как секции на экране.
        expect(
          sortedBy(forward.map((stop) => stop.y)),
          `${width}: Tab ${JSON.stringify(forward.map((s) => s.name))}`,
        ).toBe(true)
      } else {
        // Две колонки: внутри каждой — сверху вниз (левая — по самому левому краю).
        const leftEdge = Math.min(...forward.map((stop) => stop.x))
        // Порядок между колонками: левая целиком, затем правая, затем «Оценка сигнала» на всю ширину.
        const pattern = forward
          .map((stop) => (stop.x < leftEdge + 100 ? 'L' : 'R'))
          .join('')
          .replace(/(.)\1+/g, '$1')
        expect(pattern, `${width}: порядок колонок`).toBe('LRL')
        for (const column of [
          forward.filter((stop) => stop.x < leftEdge + 100),
          forward.filter((stop) => stop.x >= leftEdge + 100),
        ]) {
          expect(sortedBy(column.map((stop) => stop.y)), `${width}: колонка`).toBe(true)
        }
      }
      // Последнее нажатие Tab вышло за пределы main; Shift+Tab возвращает элементы в обратном порядке.
      expect(forward.length).toBeLessThan(60)
      // Shift+Tab начинается с того же места, откуда вышел прямой проход: после выхода из документа
      // страница снова получает фокус, и обратный проход стартует с первого элемента после main.
      const backward = await tabStops('Shift+Tab', forward.length)
      // Native unselected radio — один Tab-stop группы. Linux WebKit входит с конца
      // по Shift+Tab, macOS может входить с начала (W3C APG radio pattern, Note):
      // https://www.w3.org/WAI/ARIA/apg/patterns/radio/
      // Проверяем точный обратный порядок групп/остальных элементов и отдельно
      // единственный stop группы, первый radio вперёд и допустимый крайний назад.
      const radios = page.locator('input[type="radio"][name="verdict"]')
      await expect(radios).toHaveCount(2)
      await expect(page.locator('input[type="radio"][name="verdict"]:checked')).toHaveCount(0)
      const radioNames = await radios.evaluateAll((inputs) =>
        inputs.map((input) =>
          ((input as HTMLInputElement).labels?.[0]?.textContent ?? '').trim().slice(0, 40),
        ),
      )
      const forwardRadio = forward.filter((stop) => stop.radioGroup === 'native-radio:verdict')
      const backwardRadio = backward.filter((stop) => stop.radioGroup === 'native-radio:verdict')
      expect(forwardRadio).toHaveLength(nativeRadioStops)
      expect(backwardRadio).toHaveLength(nativeRadioStops)
      if (nativeRadioStops) {
        expect(forwardRadio[0]!.name).toBe(radioNames[0])
        expect(radioNames).toContain(backwardRadio[0]!.name)
      }
      const tabIdentity = (stop: Stop) => stop.radioGroup ?? stop.name
      expect(backward.map(tabIdentity)).toEqual(forward.map(tabIdentity).reverse())
    }

    // Черновик формы и состояние переживают смену раскладки.
    await resizeTo(1280)
    await page.getByLabel('Что вы сделали').selectOption('CALL')
    await page.getByLabel('Заметка').first().fill('Черновик заметки')
    await page.getByLabel('Заметка').first().focus()
    await resizeTo(390, 844)
    await expect(page.getByLabel('Заметка').first()).toHaveValue('Черновик заметки')
    await expect(page.getByLabel('Заметка').first()).toBeFocused()
    await expect(page.getByLabel('Что вы сделали')).toHaveValue('CALL')
    await resizeTo(1280)
    await expect(page.getByLabel('Заметка').first()).toHaveValue('Черновик заметки')
  })

  test('дерево доступности: даты карточки, порядок секций, подсказки заметок, выход с клавиатуры', async ({
    page,
  }) => {
    // Проверка по дереву доступности браузера; это не замена прохода с VoiceOver.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/radar')
    const card = page.getByRole('listitem').filter({ hasText: 'Дмитрий Соколов' }).first()
    const snapshot = await card.ariaSnapshot()
    expect(snapshot).toContain('Срок по правилу')
    expect(snapshot).toContain('Риск обнаружен')
    expect(snapshot).toMatch(/\d{4} · \d{2}:\d{2} МСК/)
    expect(snapshot).not.toContain('Ожидание с')
    await expect(card.getByRole('link', { name: 'Разобрать риск: Дмитрий Соколов' })).toBeVisible()

    await page.goto(`/risks/${RISK_ID}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Нет ответа клиенту' })).toBeVisible()
    // Порядок заголовков секций в дереве = порядок на узком экране.
    const headings = await page
      .getByRole('main')
      .getByRole('heading', { level: 2 })
      .allTextContents()
    expect(headings.map((text) => text.trim())).toEqual([
      'Почему это риск',
      'Переписка',
      'Рекомендация',
      'Работа по риску',
      'Потенциал сделки',
      'Этап сделки',
      'История',
      'Оценка сигнала',
    ])
    // Подсказка про заметки связана с полем, а не только нарисована рядом.
    for (const name of ['Заметка · необязательно']) {
      const notes = page.getByLabel(name)
      await expect(notes).toHaveCount(2)
      await expect(notes.first()).toHaveAccessibleDescription(
        'Повторный просмотр заметок пока недоступен',
      )
      await expect(notes.last()).toHaveAccessibleDescription(
        'Повторный просмотр заметок пока недоступен',
      )
    }
    await expect(page.getByRole('group', { name: 'Последний исход сделки' })).toContainText(
      'Исход не записан',
    )

    // Выход на телефоне — прежним путём через аккаунт (оболочка C, Figma 1048:9359): ссылка
    // аккаунта и «Выйти» на его странице срабатывают с клавиатуры.
    const account = page.getByRole('link', { name: 'Аккаунт, Мария Владелец' })
    await account.focus()
    await expect(account).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/account$/)
    const logout = page.getByRole('button', { name: 'Выйти' })
    await logout.focus()
    await expect(logout).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('«Выйти» в шапке Radar достижимо Tab и срабатывает с клавиатуры', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'WebKit не ставит Tab-фокус на кнопки по умолчанию')
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/radar')
    const logout = page.getByRole('button', { name: 'Выйти' })
    await logout.focus()
    await expect(logout).toBeFocused()
    // Шапка оболочки C (Figma 27:2809): обратным Tab от «Выйти» — «Настройки», затем «Аккаунт»;
    // прямым возвращаемся на кнопку.
    await page.keyboard.press('Shift+Tab')
    await expect(page.getByRole('link', { name: 'Настройки' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(page.getByRole('link', { name: /Аккаунт/ })).toBeFocused()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(logout).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('боковая панель залита на всю высоту экрана при прокрутке длинной страницы', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 700 })
    await page.goto(`/risks/${RISK_ID}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Нет ответа клиенту' })).toBeVisible()
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    expect(pageHeight).toBeGreaterThan(1500)
    // Панель — sticky на высоту окна: проверяем геометрию и то, что лежит в нижней левой точке окна.
    for (const y of [0, 600, pageHeight]) {
      await page.evaluate((top) => window.scrollTo(0, top), y)
      const box = await page.evaluate(() => {
        const aside = document.querySelector('aside')!
        const rect = aside.getBoundingClientRect()
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          inner: window.innerHeight,
          bg: getComputedStyle(aside).backgroundColor,
          // Альфа-канал фона независимо от формата записи цвета (rgb, oklab, color-mix…).
          alpha: (() => {
            const context = document.createElement('canvas').getContext('2d')!
            context.clearRect(0, 0, 1, 1)
            context.fillStyle = getComputedStyle(aside).backgroundColor
            context.fillRect(0, 0, 1, 1)
            return context.getImageData(0, 0, 1, 1).data[3]!
          })(),
          // Что реально лежит в левой нижней точке окна — сама панель.
          hit: document.elementFromPoint(20, window.innerHeight - 4)?.closest('aside') != null,
        }
      })
      expect(box.top, `scroll ${y}`).toBe(0)
      expect(box.bottom, `scroll ${y}`).toBeGreaterThanOrEqual(box.inner)
      expect(box.hit, `scroll ${y}: в нижней левой точке окна лежит панель`).toBe(true)
      // Панель действительно залита: фон полностью непрозрачный (альфа-канал = 255).
      expect(box.alpha, `scroll ${y}: ${box.bg}`).toBe(255)
    }
  })

  test('«В работе»: после записи действия карточка остаётся в группе, reload и back её сохраняют', async ({
    page,
  }) => {
    await page.goto(`/risks/${RISK_ID}`)
    await page.getByLabel('Что вы сделали').selectOption('CALL')
    await page.getByRole('button', { name: 'Записать действие' }).click()
    await expect(page.getByText('Действие записано.')).toBeVisible()

    await page.goto('/radar?status=ACKNOWLEDGED')
    const card = page.getByRole('link', { name: 'Дмитрий Соколов' }).first()
    await expect(card).toBeVisible()
    await page.reload()
    await expect(page.getByRole('link', { name: 'Дмитрий Соколов' }).first()).toBeVisible()

    await page.getByRole('link', { name: 'Дмитрий Соколов' }).first().click()
    await expect(page).toHaveURL(new RegExp(`/risks/${RISK_ID}$`))
    await page.goBack()
    await expect(page).toHaveURL(/status=ACKNOWLEDGED/)
    await expect(page.getByRole('link', { name: 'Дмитрий Соколов' }).first()).toBeVisible()
  })

  test('подтверждение оплаты: возвращённая выручка, конфликт при повторе и отдельная обычная оплата', async ({
    page,
  }) => {
    await page.goto(`/risks/${RISK_ID}`)
    // Доказательная цепочка: действие и исход «Оплатил».
    await page.getByLabel('Что вы сделали').selectOption('CALL')
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
    await expect(page.getByRole('region', { name: 'Потенциал сделки' })).toContainText('31 000 ₽')

    // Вторая оплата по возвращённой выручке: сервер отвечает 409. Повторить тот же платёж
    // нельзя: интерфейс просит сверить историю оплат и ничего не записывает.
    await page.getByRole('button', { name: 'Подтвердить оплату' }).click()
    await dialog.getByLabel('Сумма оплаты').fill('5 000')
    await dialog.getByLabel('Я подтверждаю, что оплата получена').check()
    await dialog.getByRole('button', { name: 'Подтвердить 5 000 ₽' }).click()
    const conflict = dialog.getByRole('alert')
    await expect(conflict).toContainText('Возвращённая выручка уже учтена')
    await expect(conflict).toContainText('Сверьте учтённую выручку в аналитике')
    await expect(conflict.getByRole('link', { name: 'Открыть аналитику' })).toBeVisible()
    await expect(dialog.getByRole('radio', { name: /Возвращённая выручка/ })).toBeChecked()
    await expect(
      dialog.getByRole('button', { name: 'Подтвердить как обычную оплату' }),
    ).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Подтвердить 5 000 ₽' })).toBeDisabled()
    await expectNoAxeViolations(page)
    await dialog.getByRole('button', { name: 'Отмена' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('region', { name: 'Потенциал сделки' })).toContainText('31 000 ₽')

    // Отдельный дополнительный платёж подтверждается в новой форме и по явному выбору связи.
    await page.getByRole('button', { name: 'Подтвердить оплату' }).click()
    await dialog.getByLabel('Сумма оплаты').fill('5 000')
    await dialog.getByRole('radio', { name: /Оплата без связи с риском/ }).check()
    await dialog.getByLabel('Я подтверждаю, что оплата получена').check()
    await dialog.getByRole('button', { name: 'Подтвердить 5 000 ₽' }).click()
    await expect(dialog.getByText('Оплата подтверждена')).toBeVisible()
    await expect(dialog.getByText('5 000 ₽ · Оплата без связи с риском')).toBeVisible()
    await dialog.getByRole('button', { name: 'Готово' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('region', { name: 'Потенциал сделки' })).toContainText('31 000 ₽')
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
    await expect(page.getByRole('region', { name: 'Этап сделки' })).toContainText('Потеряна')
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

  test('настройки: компания, точка, график и услуги', async ({ page, browserName }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/settings\/company$/)
    await expect(page.getByRole('heading', { name: 'Компания и график' })).toBeVisible()
    await expect(
      page.getByRole('status').filter({ hasText: /Настройка не завершена/ }),
    ).toHaveCount(0)
    await expectNoAxeViolations(page)

    // Название компании сохраняется без подтверждения, валюта — с предупреждением.
    await page.getByLabel('Название компании').fill('Студия «Блик» и партнёры')
    await page.getByRole('button', { name: 'Сохранить компанию' }).click()
    await expect(page.getByText('Настройки компании сохранены.')).toBeVisible()
    await page.getByLabel('Основная валюта').selectOption('KZT')
    await page.getByRole('button', { name: 'Сохранить компанию' }).click()
    const currencyDialog = page.getByRole('dialog', { name: 'Изменить валюту и часовой пояс?' })
    await expect(currencyDialog).toContainText('Новая валюта не пересчитывает прежние суммы')
    await currencyDialog.getByRole('button', { name: 'Оставить прежние' }).click()
    await expect(page.getByLabel('Основная валюта')).toHaveValue('RUB')

    // Новая точка через диалог появляется в списке.
    await page.getByRole('button', { name: 'Добавить точку' }).click()
    const locationDialog = page.getByRole('dialog', { name: 'Добавить точку' })
    await expect(locationDialog).toBeVisible()
    // Фокус не уходит за подложку ни по Tab, ни в WebKit по Option+Tab (кнопки и ссылки).
    const tabs = browserName === 'webkit' ? ['Tab', 'Alt+Tab'] : ['Tab']
    for (const key of tabs.flatMap((tab) => [tab, `Shift+${tab}`]))
      for (let index = 0; index < 10; index += 1) {
        await page.keyboard.press(key)
        expect(
          await locationDialog.evaluate((dialog) => dialog.contains(document.activeElement)),
          `${key} №${index + 1}`,
        ).toBe(true)
      }
    await locationDialog.getByLabel('Название точки').fill('Студия на Пресне')
    await locationDialog.getByLabel('Нет ответа, мин').fill('45')
    await locationDialog.getByRole('button', { name: 'Добавить точку' }).click()
    await expect(page.getByRole('list', { name: 'Список точек' })).toContainText('Студия на Пресне')
    // Порог 45 и «Активна» в списке; неактивность — через «Изменить точку».
    const created = page
      .getByRole('list', { name: 'Список точек' })
      .getByRole('listitem')
      .filter({ hasText: 'Студия на Пресне' })
    await expect(created).toContainText('Порог ответа: 45 рабочих минут')
    await expect(created).toContainText('Активна')
    await created.getByRole('button', { name: 'Изменить точку' }).click()
    const editDialog = page.getByRole('dialog', { name: 'Изменить точку' })
    await editDialog.getByLabel('Состояние точки').selectOption('inactive')
    await editDialog.getByRole('button', { name: 'Сохранить точку' }).click()
    await expect(created).toContainText('Неактивна')

    // Смена точки при несохранённом графике: «К редактированию» возвращает прежнюю точку и ввод.
    await page.locator('input[name="opens-1"]').fill('07:00')
    const scheduleLocation = page.locator('#schedule-location')
    const firstLocation = await scheduleLocation.inputValue()
    const switchPoint = page.getByRole('button', { name: /Студия на Пресне График/ })
    if (await switchPoint.isVisible()) await switchPoint.click()
    else await scheduleLocation.selectOption({ label: 'Студия на Пресне (неактивна)' })
    const switchDialog = page.getByRole('dialog', { name: 'Сохранить изменения графика?' })
    await switchDialog.getByRole('button', { name: 'К редактированию' }).click()
    await expect(scheduleLocation).toHaveValue(firstLocation)
    await expect(page.locator('input[name="opens-1"]')).toHaveValue('07:00')

    // График: воскресенье становится рабочим, неделя уходит одним запросом.
    const putHours = page.waitForRequest(
      (request) => request.method() === 'PUT' && request.url().includes('/business-hours'),
    )
    await page.getByLabel('Воскресенье', { exact: true }).check()
    await page.getByRole('button', { name: 'Сохранить график' }).click()
    const request = await putHours
    expect((request.postDataJSON() as { days: unknown[] }).days).toHaveLength(7)
    await expect(page.getByText('График сохранён.')).toBeVisible()

    // Несохранённый график защищён окном: «К редактированию» остаётся, «Продолжить без сохранения» уходит.
    await page.locator('input[name="opens-1"]').fill('08:00')
    await openSettingsSection(page, 'Услуги')
    const leaveDialog = page.getByRole('dialog', { name: 'Сохранить изменения графика?' })
    await expect(leaveDialog).toContainText('несохранённые изменения недельного расписания')
    await expectNoAxeViolations(page)
    await leaveDialog.getByRole('button', { name: 'К редактированию' }).click()
    await expect(leaveDialog).toHaveCount(0)
    await expect(page).toHaveURL(/\/settings\/company$/)
    await expect(page.locator('input[name="opens-1"]')).toHaveValue('08:00')
    await openSettingsSection(page, 'Услуги')
    await leaveDialog.getByRole('button', { name: 'Продолжить без сохранения' }).click()
    await expect(page).toHaveURL(/\/settings\/services$/)
    // Страница ушла вместе со слушателем: закрытие вкладки не спрашивает «Покинуть сайт?».
    const unloadPrevented = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    })
    expect(unloadPrevented).toBe(false)

    // Услуги: добавить, отключить с подтверждением, включить снова.
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
    // Ряд шагов показывает «Шаг 4 из 4»: пройденные шаги отмечены, текущий — «Источник сообщений».
    await expect(page.getByRole('navigation', { name: 'Шаги начала работы' })).toContainText(
      'Шаг 4 из 4',
    )
    // Обязательное подключение — главное действие страницы, а не ссылка в плашке.
    await expect(page.getByRole('button', { name: 'Подключить Telegram' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Перейти к подключению' })).toHaveCount(0)
    // Шаги слева видны на широком экране; на телефоне колонка скрыта, содержимое остаётся.
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      const steps = page.getByRole('navigation', { name: 'Шаги начала работы' })
      await expect(steps).toBeVisible()
      // Показаны четыре обязательных шага; необязательной привязки уведомлений в ряду нет.
      await expect(steps).toContainText('4')
      await expect(steps).not.toContainText('Уведомления в Telegram')
    }
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: 'Назад' }).click()
    await expect(page).toHaveURL(/\/onboarding\/services$/)
    await expect(page.getByRole('list', { name: 'Добавленные услуги' })).toContainText(
      'Полировка кузова',
    )
    await page.getByRole('button', { name: 'Назад' }).click()
    await expect(page).toHaveURL(/\/onboarding\/location$/)
    // US-M02-04: у точки без серверной недели — стандартный черновик и отдельное сохранение только PUT.
    await expect(page.getByRole('heading', { name: 'График · Студия на Тверской' })).toBeVisible()
    await expect(page.getByText('График точки ещё не сохранён')).toBeVisible()
    const next = page.getByRole('button', { name: 'Сохранить и продолжить' })
    await expect(next).toBeDisabled()
    await expectNoAxeViolations(page)
    const putHours = page.waitForRequest(
      (request) => request.method() === 'PUT' && request.url().includes('/business-hours'),
    )
    await page.getByRole('button', { name: 'Сохранить график' }).click()
    expect(((await putHours).postDataJSON() as { days: unknown[] }).days).toHaveLength(7)
    await expect(page.getByText('График точки ещё не сохранён')).toHaveCount(0)
    await expect(next).toBeEnabled()
    await next.click()
    await expect(page).toHaveURL(/\/onboarding\/services$/)
  })

  test('онбординг: график с ошибкой не пускает дальше и объясняет причину', async ({ page }) => {
    await page.goto('/onboarding/location')
    await expect(page.getByRole('heading', { name: 'График · Студия на Тверской' })).toBeVisible()
    await page.getByRole('button', { name: 'Сохранить график' }).click()
    const next = page.getByRole('button', { name: 'Сохранить и продолжить' })
    await expect(next).toBeEnabled()
    await page.getByLabel('Понедельник, начало').fill('21:00')
    await expect(page.getByText('Время окончания должно быть позже времени начала.')).toBeVisible()
    // Codex-R2 п.5: телефон называет точку (Figma phone-08), desktop и планшет — день.
    const phone = (page.viewportSize()?.width ?? 0) < 768
    await expect(page.locator('#location-step-hint')).toHaveText(
      phone
        ? 'Исправьте график: Студия на Тверской.'
        : 'Исправьте время в понедельник, чтобы продолжить.',
      { useInnerText: true },
    )
    await expect(next).toBeDisabled()
    await expect(page).toHaveURL(/\/onboarding\/location$/)
    // Копирование недоступно, пока у образца (первого рабочего дня) неверный интервал.
    const copy = page.getByRole('button', { name: 'Применить ко всем рабочим дням' })
    await expect(copy).toBeDisabled()
    // Одинаковое время для всех рабочих дней задаётся одним действием.
    await page.getByLabel('Понедельник, начало').fill('08:00')
    await page.getByLabel('Понедельник, окончание').fill('19:00')
    await copy.click()
    await expect(page.getByLabel('Суббота, начало')).toHaveValue('08:00')
    await expect(page.getByLabel('Пятница, окончание')).toHaveValue('19:00')
    await expect(next).toBeEnabled()
  })

  test('онбординг: источник подключается на шаге, а выход без него подписан честно', async ({
    page,
  }) => {
    await page.goto('/onboarding/channel')
    await expect(page.getByRole('heading', { name: 'Подключите Telegram' })).toBeVisible()
    // Иерархия: подключение — главное, уведомления тихие, выход без источника не главный.
    const connect = page.getByRole('button', { name: 'Подключить Telegram' })
    await expect(connect).toBeVisible()
    await expect(page.getByRole('button', { name: 'Уведомления в Telegram' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Перейти в Radar' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Подключу позже' })).toBeVisible()
    await expect(
      page.getByText('Без источника в LidRadar не появится ни одного риска.'),
    ).toBeVisible()
    await expectNoAxeViolations(page)

    // Подключение прямо на шаге: подсказка про токен рядом с полем.
    await connect.click()
    const dialog = page.getByRole('dialog', { name: 'Подключить Telegram' })
    await expect(dialog.getByRole('heading', { name: 'Где взять токен бота' })).toBeVisible()
    await expect(dialog.getByText('@BotFather').first()).toBeVisible()
    await expectNoAxeViolations(page)

    // Подробная инструкция открывается поверх формы и возвращает к ней, введённое сохраняется.
    await dialog.getByLabel('Название подключения').fill('Telegram · переписка клиентов')
    await dialog.getByRole('button', { name: 'Подробная инструкция со скриншотами' }).click()
    const guide = page.getByRole('dialog', { name: 'Подключение бота' })
    await expect(guide.getByRole('heading', { name: /Откройте Telegram/ })).toBeVisible()
    await expectNoAxeViolations(page)
    await guide.getByRole('button', { name: 'Вернуться к подключению' }).click()
    await expect(guide).toHaveCount(0)
    await expect(dialog.getByLabel('Название подключения')).toHaveValue(
      'Telegram · переписка клиентов',
    )
    await dialog.getByLabel('Название подключения').fill('Telegram · переписка клиентов')
    await dialog.getByLabel('Токен бота').fill('123456789:AAHf1234567890abcdefghijklmnop')
    await dialog.getByRole('button', { name: 'Подключить' }).click()
    await expect(dialog.getByText('Подключение создано')).toBeVisible()
    await expect(dialog.getByText('Последний шаг в Telegram')).toBeVisible()
    await dialog.getByRole('button', { name: 'Готово' }).click()

    // Страница перешла в состояние «источник подключён»: видны подключение и главная кнопка.
    await expect(page.getByRole('heading', { name: 'Telegram подключён' })).toBeVisible()
    // Кнопка подключения исчезла вместе с состоянием «источника нет»: фокус на заголовке нового состояния.
    await expect(page.getByRole('heading', { name: 'Telegram подключён' })).toBeFocused()
    await expect(page.getByText('Источник переписки · Telegram · переписка клиентов')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Перейти в Radar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Подключу позже' })).toHaveCount(0)
    await expect(page.getByText('Без источника в LidRadar не появится')).toHaveCount(0)
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: 'Перейти в Radar' }).click()
    await expect(page).toHaveURL(/\/radar$/)
  })

  test('«Подключу позже» → Radar с баннером → «Продолжить настройку» ведёт обратно на шаг 4', async ({
    page,
  }) => {
    await page.goto('/onboarding/channel')
    await page.getByRole('button', { name: 'Подключу позже' }).click()
    await expect(page).toHaveURL(/\/radar$/)
    const banner = page.getByRole('status').filter({ hasText: 'Настройка не завершена' })
    await expect(banner).toContainText('Следующий шаг — источник сообщений.')
    await banner.getByRole('link', { name: 'Продолжить настройку' }).click()
    await expect(page).toHaveURL(/\/onboarding\/channel$/)
    await expect(page.getByRole('heading', { name: 'Подключите Telegram' })).toBeVisible()
  })

  test('US-M02-04: прервали на шаге 2 → Radar с баннером → «Продолжить настройку» ведёт на шаг 2', async ({
    page,
  }) => {
    // Пройден только шаг «Компания»: точки ещё нет.
    await page.route('**/api/v1/organization/onboarding', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          complete: false,
          nextStep: 'LOCATION',
          steps: [
            { key: 'ORGANIZATION', required: true, done: true },
            { key: 'LOCATION', required: true, done: false },
            { key: 'SERVICES', required: true, done: false },
            { key: 'CHANNEL', required: true, done: false },
            { key: 'TELEGRAM_LINK', required: false, done: false },
          ],
          facts: {
            activeLocations: 0,
            locationsWithSchedule: 0,
            activeServices: 0,
            connections: 0,
            liveConnections: 0,
            telegramLinked: false,
          },
          computedAt: '2026-10-23T12:40:00Z',
        }),
      }),
    )
    await page.goto('/radar')
    const banner = page.getByRole('status').filter({ hasText: 'Настройка не завершена' })
    await expect(banner).toContainText('Следующий шаг — точка и график.')
    await banner.getByRole('link', { name: 'Продолжить настройку' }).click()
    await expect(page).toHaveURL(/\/onboarding\/location$/)
    await expect(page.getByText('Шаг 2 из 4')).toBeVisible()
    // Созданная организация не потерялась: шаг «Компания» остаётся пройденным.
    await expect(page.getByText('Компания выполнено')).toBeVisible()
  })

  test('Radar без источника не успокаивает, а ведёт к подключению', async ({ page }) => {
    await page.route('**/api/v1/risks**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], nextCursor: null }),
      }),
    )
    await page.goto('/radar')
    await expect(
      page.getByRole('heading', { name: 'Источник сообщений не подключён' }),
    ).toBeVisible()
    await expect(page.getByText('Сейчас всё под контролем')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Подключить Telegram' })).toHaveAttribute(
      'href',
      '/integrations',
    )
    await expectNoAxeViolations(page)

    // Из пустого радара сразу подключается Telegram, без выбора провайдера.
    await page.getByRole('link', { name: 'Подключить Telegram' }).click()
    await page.getByRole('button', { name: 'Подключить Telegram' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Подключить Telegram' })
    await expect(dialog.getByLabel('Источник', { exact: true })).toHaveCount(0)
    await expect(dialog).not.toContainText(/webhook|CRM|Для разработчика/i)
    await dialog.getByLabel('Название подключения').fill('Telegram · переписка клиентов')
    await dialog.getByLabel('Токен бота').fill('123456789:AAHf1234567890abcdefghijklmnop')
    await page.keyboard.press('Enter')
    await expect(dialog.getByText('Последний шаг в Telegram')).toBeVisible()
    await dialog.getByRole('button', { name: 'Готово' }).click()

    // С подключённым источником пустая лента снова говорит «всё под контролем».
    await page.goto('/radar')
    await expect(page.getByText('Сейчас всё под контролем')).toBeVisible()
    await expect(page.getByText('Источник сообщений не подключён')).toHaveCount(0)
  })

  test('интеграции: только Telegram, проверка связи и отключение', async ({ page }) => {
    await page.goto('/integrations')
    await expect(page.getByRole('heading', { name: 'Интеграции' })).toBeVisible()
    await expect(page.getByText('Источников пока нет')).toBeVisible()
    await expectNoAxeViolations(page)

    // Telegram: токен проверяется по формату и уходит один раз.
    await page.getByRole('button', { name: 'Подключить Telegram' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Подключить Telegram' })
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
    await expect(dialog.getByTestId('webhook-instructions')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Готово' }).click()
    const list = page.getByRole('list', { name: 'Подключения' })
    // Карточки — прямые элементы списка: внутри есть вложенный список возможностей.
    const cards = list.locator(':scope > li')
    await expect(cards).toHaveCount(1)
    await expect(list).toContainText('Telegram · переписка клиентов')
    await expect(list).toContainText('Работает')

    // Повторное открытие даёт чистую форму Telegram без других способов подключения.
    await page.getByRole('button', { name: 'Подключить Telegram' }).click()
    await expect(dialog.getByLabel('Токен бота')).toHaveValue('')
    await expect(dialog.getByLabel('Источник', { exact: true })).toHaveCount(0)
    await expect(dialog).not.toContainText(/webhook|CRM|Для разработчика/i)
    await dialog.getByLabel('Название подключения').fill('Telegram · вторая точка')
    await dialog.getByLabel('Токен бота').fill('987654321:AAHf1234567890abcdefghijklmnop')
    await expectNoAxeViolations(page)
    await page.keyboard.press('Enter')
    await expect(dialog.getByText('Подключение создано')).toBeVisible()
    await dialog.getByRole('button', { name: 'Готово' }).click()
    await expect(cards).toHaveCount(2)

    // Проверка связи опрашивает Telegram.
    const telegramCard = list
      .getByRole('listitem')
      .filter({ hasText: 'Telegram · переписка клиентов' })
    await telegramCard.getByRole('button', { name: 'Проверить связь' }).click()
    await expect(telegramCard.getByRole('status')).toContainText('провайдер опрошен')
    await page.reload()
    await expect(list).not.toContainText(/webhook|CRM|Для разработчика/i)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await expectNoAxeViolations(page)

    // Отключение с подтверждением: карточка остаётся как отключённая.
    const secondCard = cards.filter({ hasText: 'Telegram · вторая точка' })
    await secondCard.getByRole('button', { name: 'Отключить' }).click()
    const confirm = page.getByRole('dialog', { name: 'Отключить источник?' })
    await expect(confirm).toContainText('Telegram · вторая точка · Telegram · бизнес-бот')
    await confirm.getByRole('button', { name: 'Отключить' }).click()
    await expect(secondCard).toContainText('Отключён')
    await expect(secondCard.getByRole('button', { name: 'Отключить' })).toHaveCount(0)

    // Шаг онбординга «Источник сообщений» закрыт подключением.
    await page.goto('/onboarding/channel')
    // Источник подключён: карточка «Telegram подключён» и «Перейти в Radar» вместо «Подключу позже».
    await expect(page.getByRole('heading', { name: 'Telegram подключён' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Перейти в Radar' })).toBeVisible()
  })

  test('уведомления: личная привязка Telegram и настройки по типам рисков', async ({ page }) => {
    await page.goto('/settings/notifications')
    await expect(page.getByRole('heading', { name: 'Уведомления без лишнего шума' })).toBeVisible()
    await expectSettingsSection(page, 'Уведомления')
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
    await telegram.getByRole('button', { name: 'Подключить уведомления' }).click()
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

  test('команда: ряд выровнен по аватару, кнопки в линию, на телефоне без прокрутки', async ({
    page,
  }) => {
    const stableBoxes = async (targets: Locator[]) => {
      const handles = await Promise.all(targets.map((target) => target.elementHandle()))
      try {
        const { before, after } = await page.evaluate(async (elements) => {
          await document.fonts.ready
          const sample = () =>
            elements.map((element) => {
              if (!element?.isConnected) return null
              const box = element.getBoundingClientRect()
              if (!box.width || !box.height || getComputedStyle(element).visibility === 'hidden')
                return null
              return { x: box.x, y: box.y, width: box.width, height: box.height }
            })
          const before = sample()
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          )
          return { before, after: sample() }
        }, handles)
        expect(after).toEqual(before)
        expect(after.every((box) => box !== null)).toBe(true)
        return after.map((box) => box!)
      } finally {
        await Promise.all(handles.map((handle) => handle?.dispose()))
      }
    }
    // Широкая карточка — таблица: бейджи и кнопки на одной линии с центром аватара.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/settings/team')
    const rows = page.getByRole('table', { name: 'Участники компании' }).locator('tbody tr')
    await expect(rows).toHaveCount(3)
    for (const name of ['Мария Владелец', 'Анна Смирнова']) {
      const row = rows.filter({ hasText: name })
      const aligned = [
        row.getByText(/^(Владелец|Менеджер)$/),
        row.getByText('Активен', { exact: true }),
        row.getByRole('button').first(),
      ]
      const buttons = row.getByRole('button')
      await expect(buttons).toHaveCount(2)
      // Вся строка измеряется атомарно и остаётся стабильной два кадра.
      // Прежние пороги сохраняются для каждого бейджа и обеих кнопок.
      await expect(async () => {
        const boxes = await stableBoxes([
          row.locator('span.rounded-full').first(),
          ...aligned,
          buttons.nth(1),
        ])
        const centers = boxes.map((box) => box.y + box.height / 2)
        for (const center of centers.slice(1, 4)) {
          expect(Math.abs(center - centers[0]!)).toBeLessThanOrEqual(2)
        }
        expect(Math.abs(centers[3]! - centers[4]!)).toBeLessThan(1)
      }).toPass({ timeout: 5000 })
    }
    // Правый край действий совпадает с правым краем «Пригласить» над таблицей.
    const invite = page.getByRole('button', { name: 'Пригласить' })
    const lastAction = rows.filter({ hasText: 'Анна Смирнова' }).getByRole('button').last()
    await expect(async () => {
      const [inviteBox, actionBox] = await stableBoxes([invite, lastAction])
      expect(
        Math.abs(inviteBox!.x + inviteBox!.width - actionBox!.x - actionBox!.width),
      ).toBeLessThanOrEqual(1)
    }).toPass({ timeout: 5000 })
    await expectNoAxeViolations(page)

    // Телефон: блоки вместо таблицы, страница не прокручивается вбок, кнопки целиком на экране.
    await page.setViewportSize({ width: 375, height: 800 })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true)
    const annaButtons = rows.filter({ hasText: 'Анна Смирнова' }).getByRole('button')
    await expect(annaButtons).toHaveCount(2)
    await expect(async () => {
      const boxes = await stableBoxes([annaButtons.nth(0), annaButtons.nth(1)])
      for (const box of boxes) {
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(375)
      }
    }).toPass({ timeout: 5000 })
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
    await expectSettingsSection(page, 'Данные')
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
    await page.goto('/account')
    await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Администрирование' })).toHaveCount(0)
  })

  test('этапы сделки: только разрешённые цели, конфликт при гонке и закрытие с подтверждением', async ({
    page,
  }) => {
    await page.goto(`/risks/${RISK_ID}`)
    const context = page.getByRole('region', { name: 'Этап сделки' })
    await expect(context.getByTestId('opportunity-stage')).toHaveText('Новая')
    // Этапы входят в общую историю рядом с обнаружением риска (Figma 212:2623).
    const timeline = page.getByRole('region', { name: 'История' }).getByRole('list', {
      name: 'История',
    })
    await expect(timeline.getByRole('listitem')).toHaveCount(2)
    await expect(timeline).toContainText('Сделка создана · Новая')
    await expect(timeline).toContainText('Правило')

    // Назад, тот же этап и преждевременный выигрыш не предлагаются.
    const select = context.getByLabel('Новый этап')
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
    await context.getByRole('button', { name: 'Изменить этап' }).click()
    await expect(context.getByTestId('opportunity-stage')).toHaveText('В диалоге')
    await expect(timeline.getByRole('listitem')).toHaveCount(3)
    await expect(timeline.getByRole('listitem').first()).toContainText('Этап: Новая → В диалоге')
    await expect(timeline.getByRole('listitem').first()).toContainText('Вручную')

    // Гонка: сервер уже перевёл сделку дальше, а интерфейс ещё не перечитал её. Перечитывание
    // сделки удерживается, пока запрещённый переход не отправлен и не отклонён сервером: так
    // проверяются условия гонки, а не угадывается порядок событий.
    let releaseReread!: () => void
    const rereadGate = new Promise<void>((resolve) => (releaseReread = resolve))
    let heldReads = 0
    await page.route(`**/api/v1/opportunities/${OPPORTUNITY_ID}`, async (route) => {
      if (route.request().method() === 'GET') {
        heldReads += 1
        await rereadGate
      }
      await route.fallback()
    })
    const patchResponses: { stage: string; status: number }[] = []
    // Ошибка команды показывается только после перечитывания: удержание снимается сразу после ответа сервера.
    page.on('response', (response) => {
      const request = response.request()
      if (request.method() !== 'PATCH' || !request.url().includes(OPPORTUNITY_ID)) return
      patchResponses.push({
        stage: (request.postDataJSON() as { stage: string }).stage,
        status: response.status(),
      })
      releaseReread()
    })
    setOpportunityStage(page, 'BOOKED')
    // Перечитывание уже идёт (запрос удержан), но интерфейс ещё показывает прежний этап и прежний список.
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect.poll(() => heldReads).toBeGreaterThan(0)
    await expect(context.getByTestId('opportunity-stage')).toHaveText('В диалоге')
    await select.selectOption('QUALIFYING')
    await context.getByRole('button', { name: 'Изменить этап' }).click()
    // Сервер отклонил устаревший переход, интерфейс объяснил это и не выдал успех.
    await expect(context.getByRole('alert')).toContainText('Этап уже изменился')
    expect(patchResponses.filter((entry) => entry.stage === 'QUALIFYING')).toEqual([
      { stage: 'QUALIFYING', status: 409 },
    ])
    // Серверное состояние актуально, лишних ошибок нет, интерфейс работоспособен.
    await expect(context.getByTestId('opportunity-stage')).toHaveText('Записан')
    await expect(timeline).toContainText('AI')
    await expect(select).toHaveValue('')
    await expect(context.getByRole('button', { name: 'Изменить этап' })).toBeDisabled()
    // С момента сдвига сервера отправлен ровно один запрещённый переход, других записей нет.
    expect(patchResponses).toEqual([{ stage: 'QUALIFYING', status: 409 }])
    const afterConflict = await select
      .locator('option')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
      )
    expect(afterConflict).toEqual(['WON', 'LOST'])

    // Закрытие требует подтверждения с последствиями; после него — только архив.
    await select.selectOption('LOST')
    await context.getByRole('button', { name: 'Изменить этап' }).click()
    const confirm = page.getByRole('dialog', { name: 'Перевести сделку в «Потеряна»?' })
    await expect(confirm).toContainText('вернуть её в работу нельзя')
    await confirm.getByRole('button', { name: 'Изменить этап' }).click()
    await expect(context.getByTestId('opportunity-stage')).toHaveText('Потеряна')
    const closed = await select
      .locator('option')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
      )
    expect(closed).toEqual(['ARCHIVED'])
    await expectNoAxeViolations(page)
  })

  test('выбор этапа: перечитывание при том же этапе сохраняет выбор, смена этапа объясняется, недопустимое не уходит', async ({
    page,
  }) => {
    // Здесь нет повторов выбора и клика: каждый шаг выполняется один раз и обязан сойтись сам.
    let stageWrites = 0
    page.on('request', (request) => {
      if (!new URL(request.url()).pathname.endsWith(`/opportunities/${OPPORTUNITY_ID}`)) return
      if (request.method() === 'PATCH') stageWrites += 1
    })
    // Перечитывание вызывается событием online и считается выполненным по ПОЛУЧЕННОМУ ответу сделки.
    const reread = async () => {
      const answer = page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname.endsWith(`/opportunities/${OPPORTUNITY_ID}`),
      )
      await page.evaluate(() => window.dispatchEvent(new Event('online')))
      await answer
      // Дать интерфейсу применить пришедшие данные.
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
      )
    }

    await page.goto(`/risks/${RISK_ID}`)
    const context = page.getByRole('region', { name: 'Этап сделки' })
    await expect(context.getByTestId('opportunity-stage')).toHaveText('Новая')
    const select = context.getByLabel('Новый этап')
    const transfer = context.getByRole('button', { name: 'Изменить этап' })

    // 1. Выбор переживает фоновое перечитывание при неизменном серверном этапе.
    await select.selectOption('QUALIFYING')
    await expect(transfer).toBeEnabled()
    await reread()
    await expect(context.getByTestId('opportunity-stage')).toHaveText('Новая')
    await expect(select).toHaveValue('QUALIFYING')
    await expect(transfer).toBeEnabled()
    await expect(context.getByText('выбор сброшен')).toHaveCount(0)

    // 2. Сервер перевёл сделку: переходы обновились, выбор сброшен с объяснением.
    setOpportunityStage(page, 'BOOKED')
    await reread()
    await expect(context.getByTestId('opportunity-stage')).toHaveText('Записан')
    await expect(select).toHaveValue('')
    await expect(transfer).toBeDisabled()
    await expect(context.getByRole('status').filter({ hasText: 'выбор сброшен' })).toContainText(
      '«Записан»',
    )
    const values = await select
      .locator('option')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
      )
    expect(values).toEqual(['WON', 'LOST'])

    // 3. Недопустимый теперь переход не предлагается (список выше) и отправить нечем.
    await expect(select.locator('option[value="QUALIFYING"]')).toHaveCount(0)
    await expect(transfer).toBeDisabled()
    expect(stageWrites).toBe(0)
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
    // На десктопе «Выйти» — в шапке Radar; на телефоне — на странице аккаунта (оболочка C).
    const logout = page.getByRole('button', { name: 'Выйти' })
    if (!(await logout.isVisible())) {
      await page
        .getByRole('link', { name: /^Аккаунт/ })
        .filter({ visible: true })
        .click()
      await expect(page).toHaveURL(/\/account$/)
    }
    await page.getByRole('button', { name: 'Выйти' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Вход в LidRadar' })).toBeVisible()
  })
})

test.describe('менеджер организации', () => {
  test.beforeEach(async ({ page }) => mockOwner(page, { role: 'MANAGER' }))

  test('настройки открываются на личных уведомлениях без разделов владельца', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/settings\/notifications$/)
    const sectionSelect = page.getByLabel('Раздел настроек')
    await expect(
      (await sectionSelect.isVisible())
        ? sectionSelect.locator('option')
        : page.getByRole('navigation', { name: 'Разделы настроек' }).getByRole('link'),
    ).toHaveText(['Уведомления', 'Данные', 'Аккаунт'])
    await expect(page.getByRole('region', { name: 'Ваши уведомления в Telegram' })).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'Настройки по типам рисков' }).locator(':scope > li'),
    ).toHaveCount(5)
    await expectNoAxeViolations(page)
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      const sections = page.getByRole('navigation', { name: 'Разделы' })
      await expect(page.getByRole('link', { name: 'Настройки', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      )
      await expect(sections.getByRole('link', { name: 'Интеграции' })).toHaveCount(0)
    }
    // Согласие менеджер читает, но не меняет.
    await openSettingsSection(page, 'Данные')
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
    // Без членств и права создавать организацию guard ведёт сразу к приглашению.
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
    // Форма исчезла вместе с полем: фокус на заголовке результата.
    await expect(page.getByRole('heading', { name: 'Вы в команде' })).toBeFocused()
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
    // Оболочка C не добавляет новых входов: администрирование — прежним путём через «Аккаунт».
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
    await page
      .getByRole('link', { name: /^Аккаунт/ })
      .filter({ visible: true })
      .click()
    await expect(page).toHaveURL(/\/account$/)
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

/**
 * Оболочка C Radar (ТЗ RADAR-LAYOUT, AC-RADAR-LAYOUT-01–16): размещение действий по ширинам,
 * меню-панель и сохранённое представление ленты. Геометрию в пикселях сверяет визуальная
 * съёмка; здесь — поведение, доступные имена и размеры областей нажатия.
 */
test.describe('оболочка Radar C', () => {
  test.beforeEach(async ({ page }) => mockOwner(page))

  test('сводка: суммы выровнены при разной длине подписей, заголовок не сливается с пояснением', async ({
    page,
  }) => {
    await page.route('**/api/v1/radar**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          openRisks: 12,
          criticalRisks: 3,
          potentialRevenue: '281000.00',
          confirmedRecoveredRevenue: '74000.00',
          opportunitiesAtRisk: 12,
          opportunitiesWithUnknownAmount: 2,
        }),
      }),
    )
    for (const width of [320, 344, 360, 375, 390, 834, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto('/radar')
      const summary = page.getByRole('region', { name: 'Сводка', exact: true })
      await expect(summary.getByText('За всё время', { exact: true })).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      const values = summary.getByRole('listitem').locator('p:nth-child(2)')
      const potential = (await values.nth(1).boundingBox())!
      const recovered = (await values.nth(2).boundingBox())!
      expect(Math.abs(potential.y - recovered.y)).toBeLessThanOrEqual(1)
      for (const value of [values.nth(1), values.nth(2)]) {
        const geometry = await value.evaluate((element) => {
          const column = element.closest('li')!.getBoundingClientRect()
          const range = document.createRange()
          // Только видимое число, не отдельный маркер неизвестной суммы или sr-only пояснение.
          range.selectNode(element.firstChild!)
          return {
            column: { left: column.left, right: column.right },
            text: [...range.getClientRects()].map((rect) => ({
              left: rect.left,
              right: rect.right,
            })),
          }
        })
        for (const rect of geometry.text) {
          expect(rect.left).toBeGreaterThanOrEqual(geometry.column.left)
          expect(rect.right).toBeLessThanOrEqual(geometry.column.right)
        }
      }
      if (width === 1440) {
        expect((await summary.getByRole('list').boundingBox())!.height).toBe(136)
      }
      if (width >= 768) {
        const title = (await page
          .getByRole('heading', { name: 'Radar', exact: true })
          .boundingBox())!
        const subtitle = (await page
          .getByText('Риски в переписке, которым нужно ваше внимание', { exact: true })
          .boundingBox())!
        expect(subtitle.y).toBeGreaterThanOrEqual(title.y + title.height)
      }
    }
  })

  test('desktop: разделы и рабочее пространство в колонке, аккаунт и выход — в шапке', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/radar')
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
    const aside = page.locator('aside')
    const sections = aside.getByRole('navigation', { name: 'Разделы' })
    await expect(sections.getByRole('link')).toHaveText([
      'Radar',
      'Диалоги',
      'Аналитика',
      'Интеграции',
    ])
    await expect(sections.getByRole('link', { name: 'Radar' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // Профиль, роль, настройки и выход из колонки убраны: они в шапке (Figma 27:2766).
    for (const name of ['Настройки', 'Аккаунт', 'Выйти', 'Администрирование']) {
      await expect(aside.getByRole('link', { name })).toHaveCount(0)
      await expect(aside.getByRole('button', { name })).toHaveCount(0)
    }
    await expect(aside.getByText('Владелец', { exact: true })).toHaveCount(0)
    // Рабочее пространство закреплено внизу с отступом 24 px.
    const workspace = aside.getByText('Рабочее пространство', { exact: true })
    await expect(aside.getByText('Студия «Блик»')).toBeVisible()
    const bottom = await workspace.evaluate((element) => {
      const block = element.closest('aside > div')!.getBoundingClientRect()
      return window.innerHeight - block.bottom
    })
    expect(bottom).toBe(24)

    const main = page.getByRole('main')
    // Контекст — один раз, в шапке оболочки; дата — в поясе организации.
    const context = main.getByText(/Студия «Блик»\s+\/\s+Все точки/)
    await expect(context).toHaveCount(1)
    await expect(context.locator('..').getByText(/\d{4} · \d{2}:\d{2} МСК/)).toBeVisible()
    await expect(main.getByText('Мария Владелец', { exact: true })).toBeVisible()
    const settings = main.getByRole('link', { name: 'Настройки' })
    await expect(settings).toHaveAttribute('title', 'Настройки')
    for (const target of [settings, main.getByRole('link', { name: /^Аккаунт/ })]) {
      const box = (await target.boundingBox())!
      expect(box.height).toBe(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
    }
    const logout = main.getByRole('button', { name: 'Выйти' })
    expect((await logout.boundingBox())!.height).toBe(44)
    await expect(page.getByRole('button', { name: 'Выйти' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Меню' })).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    // Деталь риска: та же оболочка, Radar остаётся выбранным, «К рискам» и обновление на месте.
    await page
      .getByRole('link', { name: /Разобрать риск: Дмитрий Соколов/ })
      .first()
      .click()
    await expect(page.getByRole('heading', { level: 1, name: 'Нет ответа клиенту' })).toBeVisible()
    await expect(sections.getByRole('link', { name: 'Radar' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(main.getByRole('button', { name: 'Выйти' })).toBeVisible()
    await expect(main.getByRole('link', { name: 'К рискам' })).toBeVisible()
    await expect(main.getByRole('button', { name: 'Обновить' })).toBeVisible()
    await expectNoAxeViolations(page)

    await main.getByRole('link', { name: 'Настройки' }).click()
    await expect(page).toHaveURL(/\/settings/)
  })

  test('планшет: шапка с именем и аккаунтом, контекст отдельной строкой, меню-панель 360 px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 834, height: 1194 })
    await page.goto('/radar')
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
    const appBar = page
      .locator('header')
      .filter({ has: page.getByRole('button', { name: 'Меню' }) })
    expect((await appBar.boundingBox())!.height).toBe(72)
    await expect(appBar.getByText('Мария Владелец', { exact: true })).toBeVisible()
    await expect(appBar.getByRole('link', { name: /^Аккаунт/ })).toBeVisible()
    await expect(appBar.getByRole('link', { name: 'Настройки' })).toBeVisible()
    // Выход — на странице аккаунта, без дубля в шапке.
    await expect(page.getByRole('button', { name: 'Выйти' })).toHaveCount(0)
    await expect(page.getByRole('main').getByText(/Студия «Блик»\s+\/\s+Все точки/)).toBeVisible()
    await expect(page.getByRole('group', { name: 'Представление' })).toBeVisible()

    const trigger = page.getByRole('button', { name: 'Меню' })
    // Клавиатурой: WebKit не переводит фокус на кнопку по клику, возвращать было бы некуда.
    await trigger.press('Enter')
    const menu = page.getByRole('dialog', { name: 'Меню' })
    await expect(menu).toBeVisible()
    expect((await menu.boundingBox())!.width).toBe(360)
    const rows = menu.getByRole('navigation', { name: 'Разделы' }).getByRole('link')
    await expect(rows).toHaveCount(4)
    for (const row of await rows.all()) expect((await row.boundingBox())!.height).toBe(52)
    await expect(menu.getByText('Рабочее пространство', { exact: true })).toBeVisible()
    // Фон не прокручивается под открытым меню.
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden')
    // Клик по подложке закрывает меню, фокус возвращается на кнопку.
    await page.mouse.click(700, 600)
    await expect(menu).toBeHidden()
    await expect(trigger).toBeFocused()

    // Escape тоже закрывает и возвращает фокус; фон снова прокручивается.
    await trigger.press('Enter')
    await expect(menu).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(trigger).toBeFocused()
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden')

    await trigger.click()
    await menu.getByRole('link', { name: 'Диалоги' }).click()
    await expect(page).toHaveURL(/\/conversations$/)
    await expect(menu).toBeHidden()
  })

  test('телефон: инициалы из имени, доступное имя аккаунта, нет переключателя вида', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/radar')
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
    const account = page.getByRole('link', { name: 'Аккаунт, Мария Владелец' })
    await expect(account).toHaveText('МВ')
    const settings = page.getByRole('link', { name: 'Настройки' })
    for (const target of [account, settings, page.getByRole('button', { name: 'Меню' })]) {
      const box = (await target.boundingBox())!
      expect([box.width, box.height]).toEqual([44, 44])
    }
    await expect(
      page.getByText('Мария Владелец', { exact: true }).filter({ visible: true }),
    ).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Представление' })).toHaveCount(0)
    // Сортировка, фильтры и вкладки статуса остаются.
    await expect(page.getByText('Сначала важные ↓')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Фильтры' })).toBeVisible()
    await expect(
      page.getByRole('group', { name: 'Статус рисков' }).getByRole('button', { name: 'Новые' }),
    ).toBeVisible()
    await account.click()
    await expect(page).toHaveURL(/\/account$/)
  })

  test('сохранённое представление «Список» переживает телефонную ширину', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/radar')
    await page.getByRole('button', { name: 'Список' }).click()
    await expect(page.getByRole('button', { name: 'Список' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('group', { name: 'Представление' })).toHaveCount(0)
    const card = page.getByRole('link', { name: /Разобрать риск: Дмитрий Соколов/ }).first()
    await expect(card).toBeVisible()
    await page.reload()
    await expect(card).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('lidradar.radar.view'))).toBe('list')
    await page.setViewportSize({ width: 834, height: 1194 })
    await expect(page.getByRole('button', { name: 'Список' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('320 px: меню не шире окна, крестик и рабочее пространство доступны', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto(`/risks/${RISK_ID}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Нет ответа клиенту' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Меню' }).click()
    const menu = page.getByRole('dialog', { name: 'Меню' })
    const box = (await menu.boundingBox())!
    expect(box.x).toBe(0)
    expect(box.width).toBeLessThanOrEqual(320)
    const close = menu.getByRole('button', { name: 'Закрыть' })
    await expect(close).toBeInViewport()
    await menu.getByText('Рабочее пространство', { exact: true }).scrollIntoViewIfNeeded()
    await expect(menu.getByText('Рабочее пространство', { exact: true })).toBeInViewport()
    await close.click()
    await expect(menu).toBeHidden()
  })

  test('дата появляется только с часовым поясом организации; ошибка — не дата UTC', async ({
    page,
  }) => {
    await page.route('**/api/v1/organization', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL', message: '', traceId: 't' } }),
      }),
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/radar')
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
    const context = page.getByRole('main').getByText(/Студия «Блик»\s+\/\s+Все точки/)
    await expect(context).toBeVisible()
    // Строка контекста без даты; даты карточек рисков сюда не относятся.
    await expect(context.locator('..').getByText(/\d{4} · \d{2}:\d{2}/)).toHaveCount(0)
    await expect(context.locator('..').getByText(/UTC/)).toHaveCount(0)
  })
})
