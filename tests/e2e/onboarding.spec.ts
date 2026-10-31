import { expect, test, type Page, type Route } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { TENANT_ID, mockOwner } from './fixtures/api'

/**
 * Мастер «Начало работы», шаг 1 «Компания» (US-M02-01) у нового владельца без организации.
 * Backend замокан: ответы повторяют контракт `/auth/me` и `POST /organizations`.
 */

const USER = {
  id: '01990000-0000-7000-8000-000000000f01',
  email: 'owner@example.test',
  displayName: 'Мария Владелец',
  status: 'ACTIVE',
  emailVerifiedAt: '2026-09-01T09:00:00Z',
  deletionDueAt: null,
  createdAt: '2026-09-01T09:00:00Z',
  updatedAt: '2026-09-01T09:00:00Z',
}
const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** Новый владелец: организации нет, право создать есть; после создания членство появляется в `/auth/me`. */
async function mockNewOwner(page: Page): Promise<{ created: () => number }> {
  await mockOwner(page)
  let created = 0
  await page.route('**/api/v1/auth/me', (route) =>
    json(route, 200, {
      user: USER,
      canCreateOrganization: created === 0,
      memberships:
        created === 0
          ? []
          : [{ tenantId: TENANT_ID, organizationName: 'QA Иванов', role: 'OWNER' }],
    }),
  )
  await page.route('**/api/v1/organizations', async (route) => {
    created += 1
    await new Promise((resolve) => setTimeout(resolve, 200))
    return json(route, 201, {
      id: TENANT_ID,
      name: 'QA Иванов',
      defaultTimezone: 'Europe/Moscow',
      defaultCurrency: 'RUB',
      status: 'ACTIVE',
      createdAt: '2026-10-28T09:00:00Z',
      updatedAt: '2026-10-28T09:00:00Z',
    })
  })
  return { created: () => created }
}

test.describe('шаг 1 «Компания» (US-M02-01)', () => {
  test('экран по макету: прогресс, поля, подсказки; пустое название не отправляется', async ({
    page,
  }) => {
    const state = await mockNewOwner(page)
    await page.goto('/onboarding/company')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Расскажите о компании' }),
    ).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Шаги начала работы' })).toContainText(
      'Шаг 1 из 4',
    )
    await expect(page.getByLabel('Название компании')).toBeVisible()
    await expect(page.getByLabel('Часовой пояс')).toBeVisible()
    await expect(page.getByLabel('Основная валюта')).toBeVisible()
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations).toEqual([])

    await page.getByRole('button', { name: 'Создать компанию' }).click()
    await expect(page.getByText('Введите название компании.')).toBeVisible()
    await expect(page.getByLabel('Название компании')).toBeFocused()
    expect(state.created()).toBe(0)
  })

  test('название из 201 символа, набранное с клавиатуры, не обрезается: «Слишком длинное название»', async ({
    page,
  }) => {
    const state = await mockNewOwner(page)
    await page.goto('/onboarding/company')
    const name = page.getByLabel('Название компании')
    await name.pressSequentially('я'.repeat(201))
    await page.getByRole('button', { name: 'Создать компанию' }).click()
    await expect(page.getByText('Слишком длинное название')).toBeVisible()
    expect(state.created()).toBe(0)
  })

  test('на телефоне каждый шаг ряда читается с названием и состоянием', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockNewOwner(page)
    await page.goto('/onboarding/company')
    const steps = page.getByRole('navigation', { name: 'Шаги начала работы' }).getByRole('listitem')
    await expect(steps).toHaveCount(4)
    await expect(steps.nth(0)).toContainText('Компания')
    await expect(steps.nth(0)).toContainText('текущий шаг')
    await expect(steps.nth(3)).toContainText('Источник сообщений')
  })

  test('создание: «Создаём компанию…», одна организация при двойном нажатии, переход к шагу 2 с галочкой у шага 1', async ({
    page,
  }) => {
    const state = await mockNewOwner(page)
    await page.goto('/onboarding/company')
    await page.getByLabel('Название компании').fill('QA Иванов')
    const button = page.getByRole('button', { name: 'Создать компанию' })
    await button.dblclick()
    await expect(page.getByText('Создаём компанию…')).toBeVisible()
    await expect(page).toHaveURL(/\/onboarding\/location$/)
    expect(state.created()).toBe(1)
    // В ряду шагов шаг «Компания» выполнен.
    const steps = page.getByRole('navigation', { name: 'Шаги начала работы' })
    await expect(steps.getByRole('listitem').first()).toContainText('выполнено')
  })

  for (const width of [320, 390, 834, 1440]) {
    test(`страница не прокручивается по горизонтали (${width} px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await mockNewOwner(page)
      await page.goto('/onboarding/company')
      await expect(page.getByLabel('Название компании')).toBeVisible()
      await page.getByLabel('Название компании').fill('Очень'.repeat(33))
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
      await expect(page.getByRole('button', { name: 'Создать компанию' })).toBeInViewport()
    })
  }
})

test.describe('шаг 2 «Точки и графики» (US-M02-04)', () => {
  for (const width of [320, 344, 360, 375, 390, 768, 834, 1024, 1440]) {
    test(`Codex-R4 / AC-22: подпись кнопки внутри границ во всех состояниях (${width} px)`, async ({
      page,
      browserName,
      browser,
    }, info) => {
      await page.setViewportSize({ width, height: width === 834 ? 1194 : width < 768 ? 844 : 1000 })
      await page.clock.setFixedTime(new Date('2026-10-30T09:00:00Z'))
      await mockOwner(page)
      const writes: string[] = []
      page.on('request', (request) => {
        if (
          ['POST', 'PUT', 'PATCH'].includes(request.method()) &&
          request.url().includes('/locations')
        )
          writes.push(request.method())
      })
      await page.goto('/onboarding/location')
      await page.getByRole('button', { name: 'Сохранить график', exact: true }).click()
      const next = page.getByTestId('location-continue')
      const back = page.getByRole('button', { name: 'Назад', exact: true })
      const states: object[] = []
      let initialSize: { width: number; height: number } | undefined
      const check = async (state: string) => {
        await page.evaluate(() => document.fonts.ready)
        await next.scrollIntoViewIfNeeded()
        const geometry = await next.evaluate((element) => {
          const box = element.getBoundingClientRect()
          const rectangles = []
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent?.trim() || node.parentElement?.closest('.sr-only')) continue
            const range = document.createRange()
            range.selectNodeContents(node)
            for (const rect of range.getClientRects()) {
              if (rect.width > 0 && rect.height > 0)
                rectangles.push({
                  left: rect.left,
                  right: rect.right,
                  top: rect.top,
                  bottom: rect.bottom,
                })
            }
          }
          return {
            button: {
              left: box.left,
              right: box.right,
              top: box.top,
              bottom: box.bottom,
              width: box.width,
              height: box.height,
            },
            text: rectangles,
            icons: [...element.querySelectorAll('svg')].map((icon) => {
              const rect = icon.getBoundingClientRect()
              return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
            }),
            fontSize: getComputedStyle(element).fontSize,
            viewport: { width: innerWidth, height: innerHeight },
          }
        })
        expect(geometry.text.length).toBeGreaterThan(0)
        for (const text of [...geometry.text, ...geometry.icons]) {
          expect(text.left).toBeGreaterThanOrEqual(geometry.button.left - 1)
          expect(text.right).toBeLessThanOrEqual(geometry.button.right + 1)
          expect(text.top).toBeGreaterThanOrEqual(geometry.button.top - 1)
          expect(text.bottom).toBeLessThanOrEqual(geometry.button.bottom + 1)
        }
        for (const icon of geometry.icons)
          expect(icon.right).toBeLessThanOrEqual(
            Math.min(...geometry.text.map((rect) => rect.left)),
          )
        expect(geometry.button.top).toBeGreaterThanOrEqual(0)
        expect(geometry.button.bottom).toBeLessThanOrEqual(geometry.viewport.height)
        const previous = (await back.boundingBox())!
        expect(previous.x + previous.width).toBeLessThanOrEqual(geometry.button.left)
        expect(geometry.button.height).toBe(46)
        if (initialSize) {
          expect(geometry.button.width).toBe(initialSize.width)
          expect(geometry.button.height).toBe(initialSize.height)
        } else initialSize = geometry.button
        await page.mouse.move(0, 0)
        await page.evaluate(
          () => document.activeElement instanceof HTMLElement && document.activeElement.blur(),
        )
        const image = info.outputPath(`footer-${width}-${state}.png`)
        await page.screenshot({ path: image })
        await info.attach(`footer-${state}`, { path: image, contentType: 'image/png' })
        states.push({ state, image, ...geometry })
      }
      await expect(next).toBeEnabled()
      await check('enabled')
      await page.locator('input[name="opens-1"]').fill('20:00')
      await page.locator('input[name="closes-1"]').fill('09:00')
      await expect(next).toBeDisabled()
      await check('disabled')
      await page.locator('input[name="opens-1"]').fill('11:00')
      await page.locator('input[name="closes-1"]').fill('19:00')
      let release!: () => void
      const held = new Promise<void>((resolve) => (release = resolve))
      const hoursUrl = '**/api/v1/locations/*/business-hours'
      await page.route(hoursUrl, async (route) => {
        await held
        await json(route, 400, {
          error: { code: 'VALIDATION_ERROR', message: '', traceId: 'footer-test' },
        })
      })
      await next.click()
      await expect(next).toHaveAttribute('aria-busy', 'true')
      await expect(back).toBeDisabled()
      await check('saving')
      release()
      await expect(next).toHaveText('Повторить сохранение')
      await expect(next).toBeEnabled()
      await check('retry')
      await page.unroute(hoursUrl)
      await next.click()
      await expect(page).toHaveURL(/\/onboarding\/services$/)
      expect(writes).toEqual(['PUT', 'PUT', 'PUT'])
      await info.attach('footer-geometry', {
        body: JSON.stringify(
          {
            width,
            browserName,
            browserVersion: browser.version(),
            project: info.project.name,
            environment: await page.evaluate(() => ({
              locale: navigator.language,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              dpr: devicePixelRatio,
            })),
            clock: '2026-10-30T09:00:00Z',
            states,
          },
          null,
          2,
        ),
        contentType: 'application/json',
      })
    })
  }

  test('восстановление default, создание POST → PUT, черновики по точкам, ошибка другой точки, переход к услугам', async ({
    page,
  }) => {
    // Сценарий раскладки desktop/tablet (карточки точек) — и в проекте mobile.
    await page.setViewportSize({ width: 1440, height: 1000 })
    await mockOwner(page)
    const writes: string[] = []
    page.on('request', (request) => {
      if (
        ['POST', 'PUT', 'PATCH'].includes(request.method()) &&
        request.url().includes('/locations')
      )
        writes.push(`${request.method()} ${new URL(request.url()).pathname}`)
    })
    await page.goto('/onboarding/location')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Точки и графики работы' }),
    ).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Шаги начала работы' })).toContainText(
      'Шаг 2 из 4',
    )
    // У точки без серверной недели — стандартный черновик 10:00–19:00 и повтор только PUT.
    await expect(page.locator('#hours-title')).toHaveText('График · Студия на Тверской')
    await expect(page.locator('input[name="opens-1"]')).toHaveValue('10:00')
    await expect(page.getByText('График точки ещё не сохранён')).toBeVisible()
    const next = page.getByTestId('location-continue')
    await expect(next).toBeDisabled()
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations).toEqual([])
    await page.getByRole('button', { name: 'Сохранить график' }).click()
    await expect(next).toBeEnabled()

    // Плюс → «Добавить точку» → одна новая точка, выбрана, неделя сохранена.
    await page.getByRole('button', { name: 'Добавить точку' }).click()
    const dialog = page.getByRole('dialog', { name: 'Добавить точку' })
    await dialog.getByLabel('Название точки').fill('Студия на Арбате')
    await dialog.getByRole('button', { name: 'Добавить точку' }).dblclick()
    await expect(dialog).toBeHidden()
    await expect(page.locator('#hours-title')).toHaveText('График · Студия на Арбате')
    await expect(page.getByTestId('location-card')).toHaveCount(2)
    await expect(next).toBeEnabled()
    expect(writes.filter((item) => item === 'POST /api/v1/locations')).toHaveLength(1)

    // Неверный интервал второй точки: переключение разрешено, ошибка остаётся у неё.
    await page.locator('input[name="opens-1"]').fill('20:00')
    await page.locator('input[name="closes-1"]').fill('09:00')
    await expect(page.getByText('Время окончания должно быть позже времени начала.')).toBeVisible()
    await expect(page.locator('input[name="opens-1"]')).toHaveAttribute('aria-invalid', 'true')
    const cards = page.getByTestId('location-card')
    await cards.filter({ hasText: 'Студия на Тверской' }).click()
    await expect(page.locator('input[name="opens-1"]')).toHaveValue('10:00')
    await expect(cards.filter({ hasText: 'Студия на Арбате' })).toContainText(
      'График заполнен неверно',
    )
    await expect(page.locator('#location-step-hint')).toHaveText(
      'Исправьте график: Студия на Арбате.',
    )
    await expect(next).toBeDisabled()
    // Клавиатура: выбор карточки Enter.
    await cards.filter({ hasText: 'Студия на Арбате' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('input[name="opens-1"]')).toHaveValue('20:00')
    await page.locator('input[name="opens-1"]').fill('08:00')
    await expect(next).toBeEnabled()

    await next.click()
    await expect(page).toHaveURL(/\/onboarding\/services$/)
    // POST один, PUT — инициализации и одна изменённая неделя; подтверждённые не повторяются.
    expect(writes.filter((item) => item.startsWith('POST'))).toHaveLength(1)
    expect(writes.filter((item) => item.startsWith('PUT'))).toHaveLength(3)
  })

  test('Codex-R2 п.3 / AC-04: пустое название — ошибка по клику и по Enter без POST, затем точка создаётся', async ({
    page,
  }) => {
    await mockOwner(page)
    const posts: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/locations')
        posts.push(request.url())
    })
    await page.goto('/onboarding/location')
    await page.getByRole('button', { name: 'Добавить точку' }).click()
    const create = page.getByRole('dialog', { name: 'Добавить точку' })
    const submit = create.getByRole('button', { name: 'Добавить точку' })
    const name = create.getByLabel('Название точки')
    // Кнопка доступна и до ввода не выглядит недоступной (не серая и не прозрачная).
    await expect(submit).toBeEnabled()
    const look = await submit.evaluate((element) => {
      const style = getComputedStyle(element)
      return { opacity: style.opacity, cursor: style.cursor }
    })
    expect(look).toEqual({ opacity: '1', cursor: expect.not.stringMatching('not-allowed') })

    await submit.click()
    await expect(create.getByText('Введите название точки.')).toBeVisible()
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await name.focus()
    await page.keyboard.press('Enter')
    await expect(create.getByText('Введите название точки.')).toBeVisible()
    await expect(submit).toBeEnabled()
    expect(posts).toHaveLength(0)

    await name.fill('Студия на Арбате')
    await page.keyboard.press('Enter')
    await expect(create).toBeHidden()
    await expect(page.locator('#hours-title')).toHaveText('График · Студия на Арбате')
    expect(posts).toHaveLength(1)
  })

  test('«Назад» ведёт к компании; модалка изменения возвращает на тот же шаг', async ({ page }) => {
    await mockOwner(page)
    await page.goto('/onboarding/location')
    await page.getByRole('button', { name: 'Изменить точку «Студия на Тверской»' }).click()
    const dialog = page.getByRole('dialog', { name: 'Изменить точку' })
    await expect(dialog.getByLabel('Состояние точки')).toBeVisible()
    await dialog.getByRole('button', { name: 'Отмена' }).click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/onboarding\/location$/)
    await page.getByRole('button', { name: 'Назад' }).click()
    await expect(page).toHaveURL(/\/onboarding\/company$/)
  })

  /**
   * Клавиша перехода фокуса: WebKit, как Safari без «полного доступа с клавиатуры», по Tab
   * обходит только поля, а кнопки и ссылки — по Option+Tab.
   */
  const tabKey = (browserName: string) => (browserName === 'webkit' ? 'Alt+Tab' : 'Tab')

  /** Фокус внутри открытого окна: Tab и Shift+Tab не выводят его наружу. */
  async function expectFocusTrapped(
    page: Page,
    browserName: string,
    name: string,
    presses = 14,
  ): Promise<void> {
    // В WebKit проверяются оба способа: обычный Tab (только поля) и Option+Tab (все элементы).
    const tabs = browserName === 'webkit' ? ['Tab', 'Alt+Tab'] : ['Tab']
    for (const key of tabs.flatMap((tab) => [tab, `Shift+${tab}`])) {
      for (let index = 0; index < presses; index += 1) {
        await page.keyboard.press(key)
        const inside = await page.evaluate(
          (title) =>
            [...document.querySelectorAll('[role="dialog"]')].some(
              (dialog) =>
                dialog.getAttribute('aria-labelledby') !== null &&
                document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent ===
                  title &&
                dialog.contains(document.activeElement),
            ),
          name,
        )
        expect(inside, `${key} №${index + 1}: фокус внутри «${name}»`).toBe(true)
      }
    }
  }

  test('AC-23: клавиатура — окна держат и возвращают фокус, создание точки и выбор без мыши', async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await mockOwner(page)
    await page.goto('/onboarding/location')
    const add = page.getByRole('button', { name: 'Добавить точку' })
    await expect(add).toBeEnabled()

    // «Добавить точку»: Enter открывает окно, фокус заперт в нём, Escape возвращает его на плюс.
    await add.focus()
    await page.keyboard.press('Enter')
    const create = page.getByRole('dialog', { name: 'Добавить точку' })
    await expect(create).toBeVisible()
    await expectFocusTrapped(page, browserName, 'Добавить точку')
    await page.keyboard.press('Escape')
    await expect(create).toBeHidden()
    await expect(add).toBeFocused()

    // Карандаш: то же для «Изменить точку».
    const pencil = page.getByRole('button', { name: 'Изменить точку «Студия на Тверской»' })
    await pencil.focus()
    await page.keyboard.press('Enter')
    const edit = page.getByRole('dialog', { name: 'Изменить точку' })
    await expect(edit).toBeVisible()
    await expectFocusTrapped(page, browserName, 'Изменить точку')
    await page.keyboard.press('Escape')
    await expect(edit).toBeHidden()
    await expect(pencil).toBeFocused()

    // Создание только клавиатурой: ввод названия и Enter на кнопке окна.
    await add.focus()
    await page.keyboard.press('Enter')
    await expect(create.getByLabel('Название точки')).toBeVisible()
    await create.getByLabel('Название точки').focus()
    await page.keyboard.type('Студия на Арбате')
    await create.getByRole('button', { name: 'Добавить точку' }).focus()
    await page.keyboard.press('Enter')
    await expect(create).toBeHidden()
    await expect(page.locator('#hours-title')).toHaveText('График · Студия на Арбате')

    // Выбор точки и правка часов с клавиатуры.
    const cards = page.getByTestId('location-card')
    await cards.filter({ hasText: 'Студия на Тверской' }).focus()
    await page.keyboard.press('Space')
    await expect(page.locator('#hours-title')).toHaveText('График · Студия на Тверской')
    await expect(cards.filter({ hasText: 'Студия на Тверской' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // Tab от выбранной карточки доходит до её карандаша.
    await page.keyboard.press(tabKey(browserName))
    await expect(pencil).toBeFocused()
  })

  test('AC-23: на телефоне селектор точки и карандаш доступны с клавиатуры', async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockOwner(page)
    await page.goto('/onboarding/location')
    await page.getByRole('button', { name: 'Добавить точку' }).click()
    const create = page.getByRole('dialog', { name: 'Добавить точку' })
    await create.getByLabel('Название точки').fill('Студия на Арбате')
    await create.getByRole('button', { name: 'Добавить точку' }).click()
    await expect(create).toBeHidden()
    await expect(page.locator('#hours-title')).toHaveText('График · Студия на Арбате')

    const select = page.getByRole('combobox', { name: 'Точка' })
    await expect(select).toBeVisible()
    // Селектор — нативный <select>: клавиатура и вспомогательные технологии платформы. Он в
    // порядке Tab сразу после плюса; выбор платформенным событием change меняет график,
    // фокус остаётся на селекте. Системное меню Chromium/macOS автоматизацией не нажимается.
    expect(await select.evaluate((element) => element.tagName)).toBe('SELECT')
    await page.getByRole('button', { name: 'Добавить точку' }).focus()
    await page.keyboard.press(tabKey(browserName))
    await expect(select).toBeFocused()
    await select.selectOption({ label: 'Студия на Тверской' })
    await expect(page.locator('#hours-title')).toHaveText('График · Студия на Тверской')
    await expect(select).toBeFocused()

    // Tab от селектора — карандаш выбранной точки; окно держит и возвращает фокус.
    await page.keyboard.press(tabKey(browserName))
    const pencil = page.getByRole('button', { name: 'Изменить точку «Студия на Тверской»' })
    await expect(pencil).toBeFocused()
    await page.keyboard.press('Enter')
    const edit = page.getByRole('dialog', { name: 'Изменить точку' })
    await expect(edit).toBeVisible()
    await expectFocusTrapped(page, browserName, 'Изменить точку')
    await page.keyboard.press('Escape')
    await expect(edit).toBeHidden()
    await expect(pencil).toBeFocused()
  })

  for (const width of [320, 390, 834, 1024, 1440]) {
    test(`без горизонтальной прокрутки и с длинным названием (${width} px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await mockOwner(page)
      await page.goto('/onboarding/location')
      await page
        .getByRole('button', { name: /Изменить точку/ })
        .first()
        .waitFor()
      await page.getByRole('button', { name: 'Добавить точку' }).click()
      const dialog = page.getByRole('dialog', { name: 'Добавить точку' })
      await dialog.getByLabel('Название точки').fill('Студия '.repeat(28).trim())
      await dialog.getByRole('button', { name: 'Добавить точку' }).click()
      await expect(dialog).toBeHidden()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
      if (width < 768) {
        await expect(page.getByTestId('location-card').first()).toBeHidden()
        await expect(page.locator('select[name="location"]')).toBeVisible()
        await expect(page.getByTestId('location-continue')).toBeInViewport()
      } else {
        const box = await page.getByTestId('location-card').first().boundingBox()
        expect(box?.height).toBe(76)
        expect(box?.width).toBe(width >= 1024 ? 272 : 248)
      }
    })
  }
})
