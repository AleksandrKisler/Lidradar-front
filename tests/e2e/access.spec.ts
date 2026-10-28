import { expect, test, type Page, type Route } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { INVITATION_CODE, USED_INVITATION_CODE } from './fixtures/api'

/**
 * Доступ (F03): регистрация по коду приглашения — US-M01-01/02/04. Проверяется в браузере
 * на mock-API: форма, негативные проверки до запроса, ответы сервера, блокировка и успех.
 */

function json(route: Route, status: number, body: unknown, headers: Record<string, string> = {}) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'X-Request-ID': 'e2e-request', ...headers },
    body: JSON.stringify(body),
  })
}
const failure = (code: string, message = '') => ({ error: { code, message, traceId: 'e2e-trace' } })

const NEW_USER = {
  canCreateOrganization: true,
  user: {
    id: '01990000-0000-7000-8000-000000000f01',
    email: 'maria@example.test',
    displayName: 'Мария',
    status: 'ACTIVE',
    emailVerifiedAt: null,
    deletionDueAt: null,
    createdAt: '2026-10-28T09:00:00Z',
    updatedAt: '2026-10-28T09:00:00Z',
  },
  memberships: [],
}

interface RegisterMock {
  bodies: Array<Record<string, unknown>>
  /** После успешной регистрации `/auth/me` отвечает новым пользователем. */
  registered: boolean
}

/** Гость; `POST /auth/register` отвечает по сценарию, режим регистрации — по приглашениям. */
async function mockRegistration(
  page: Page,
  respond: (body: Record<string, unknown>, route: Route) => Promise<void> | void,
): Promise<RegisterMock> {
  const state: RegisterMock = { bodies: [], registered: false }
  await page.route('**/api/v1/auth/me', (route) =>
    state.registered ? json(route, 200, NEW_USER) : json(route, 401, failure('UNAUTHENTICATED')),
  )
  await page.route('**/api/v1/auth/registration', (route) => json(route, 200, { mode: 'invite' }))
  await page.route('**/api/v1/auth/register', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    state.bodies.push(body)
    await respond(body, route)
  })
  return state
}

async function fill(
  page: Page,
  values: { code?: string; name?: string; email?: string; password?: string },
) {
  if (values.code !== undefined) await page.getByLabel('Код приглашения').fill(values.code)
  if (values.name !== undefined) await page.getByLabel('Имя').fill(values.name)
  if (values.email !== undefined) await page.getByLabel('Электронная почта').fill(values.email)
  if (values.password !== undefined) {
    await page.getByLabel('Пароль', { exact: true }).fill(values.password)
  }
}

const submit = (page: Page) => page.getByRole('button', { name: 'Создать аккаунт' })

test.describe('регистрация по коду приглашения', () => {
  test('страница по макету: подзаголовок, код обязателен, пустой код не уходит на сервер', async ({
    page,
  }) => {
    const state = await mockRegistration(page, (_body, route) => json(route, 201, {}))
    await page.goto('/register')
    await expect(page.getByRole('heading', { level: 1, name: 'Создать аккаунт' })).toBeVisible()
    await expect(
      page.getByText('Регистрация по приглашению: введите код, который вам передали.'),
    ).toBeVisible()
    await expect(page.getByLabel('Код приглашения')).toBeVisible()
    await expect(page.getByText('Не меньше 12 символов.')).toBeVisible()
    // Ссылки на документы открываются в новой вкладке.
    for (const name of ['Пользовательское соглашение', 'Политикой обработки персональных данных']) {
      await expect(page.getByTestId('register-legal').getByRole('link', { name })).toHaveAttribute(
        'target',
        '_blank',
      )
    }
    await fill(page, { name: 'Мария', email: 'maria@example.test', password: 'very-secure-pass' })
    await submit(page).click()
    await expect(page.getByText('Для регистрации нужен код приглашения')).toBeVisible()
    // Клиентская ошибка: фокус на поле, которое нужно исправить.
    await expect(page.getByLabel('Код приглашения')).toBeFocused()
    expect(state.bodies).toHaveLength(0)
    // Ошибка заменяет подсказку поля и объявлена у поля.
    await expect(page.getByLabel('Код приглашения')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('43 символа. Код платформы выдаёт оператор')).toHaveCount(0)
  })

  test('негативные проверки до запроса: пароль 11 символов, адрес без @, имя не длиннее 200, код неверного формата', async ({
    page,
  }) => {
    const state = await mockRegistration(page, (_body, route) => json(route, 201, {}))
    await page.goto('/register')
    const valid = {
      code: INVITATION_CODE,
      name: 'Мария',
      email: 'maria@example.test',
      password: 'very-secure-pass',
    }
    await fill(page, { ...valid, password: '12345678901' })
    await submit(page).click()
    await expect(page.getByText('Не меньше 12 символов', { exact: true })).toBeVisible()
    await fill(page, { ...valid, email: 'maria.example.test' })
    await submit(page).click()
    await expect(page.getByLabel('Электронная почта')).toHaveAttribute('aria-invalid', 'true')
    // Имя: поле не принимает 201-ю букву (maxlength), схема отдельно отвергает 201 в unit-тесте формы.
    await fill(page, { ...valid, name: 'я'.repeat(201) })
    await expect(page.getByLabel('Имя')).toHaveValue('я'.repeat(200))
    await fill(page, { ...valid, code: 'LDR-2026' })
    await submit(page).click()
    await expect(page.getByText('Код состоит из 43 символов')).toBeVisible()
    expect(state.bodies).toHaveLength(0)
  })

  test('ответы сервера: код не подходит, адрес занят — у нужных полей', async ({ page }) => {
    await mockRegistration(page, (body, route) =>
      body.inviteCode === USED_INVITATION_CODE
        ? json(route, 403, failure('INVITATION_INVALID'))
        : json(route, 409, failure('EMAIL_ALREADY_REGISTERED')),
    )
    await page.goto('/register')
    await fill(page, {
      code: USED_INVITATION_CODE,
      name: 'Мария',
      email: 'maria@example.test',
      password: 'very-secure-pass',
    })
    await submit(page).click()
    await expect(
      page.getByText(
        'Код не подходит: он неверен, просрочен, уже использован или отозван. Попросите новый.',
      ),
    ).toBeVisible()
    await expect(page.getByLabel('Код приглашения')).toHaveAttribute('aria-invalid', 'true')
    await fill(page, { code: INVITATION_CODE })
    await submit(page).click()
    await expect(
      page.getByText('Этот адрес уже зарегистрирован. Войдите или используйте другой.'),
    ).toBeVisible()
    await expect(page.getByLabel('Электронная почта')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Код приглашения')).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('защита от подбора: кнопка неактивна с отсчётом, сообщение для скринридера один раз', async ({
    page,
  }) => {
    await mockRegistration(page, (_body, route) =>
      json(route, 429, failure('RATE_LIMITED'), { 'Retry-After': '30' }),
    )
    await page.goto('/register')
    await fill(page, {
      code: INVITATION_CODE,
      name: 'Мария',
      email: 'maria@example.test',
      password: 'very-secure-pass',
    })
    await submit(page).click()
    const blocked = page.getByRole('button', { name: /Создать аккаунт через \d+ с/ })
    await expect(blocked).toBeDisabled()
    await expect(
      page.getByRole('status').filter({ hasText: 'Регистрация временно недоступна' }),
    ).toHaveCount(1)
  })

  test('успех: запрос с нормализованным кодом, отправка блокирует поля, затем переход на создание организации', async ({
    page,
  }) => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const state = await mockRegistration(page, async (_body, route) => {
      await gate
      state.registered = true
      await json(route, 201, { user: NEW_USER.user })
    })
    await page.goto('/register')
    await fill(page, {
      code: `  ${INVITATION_CODE.slice(0, 20)}\n${INVITATION_CODE.slice(20)} `,
      name: 'Мария',
      email: 'maria@example.test',
      password: 'very-secure-pass',
    })
    await submit(page).click()
    // Пока запрос идёт: кнопка занята, поля заблокированы, имя кнопки сохранено.
    await expect(page.locator('button[aria-busy="true"]')).toContainText('Создаём аккаунт…')
    await expect(page.getByRole('button', { name: 'Создать аккаунт' })).toBeDisabled()
    await expect(page.getByLabel('Имя')).toBeDisabled()
    release()
    await expect(page).toHaveURL(/\/onboarding\/company$/)
    expect(state.bodies).toEqual([
      {
        inviteCode: INVITATION_CODE,
        displayName: 'Мария',
        email: 'maria@example.test',
        password: 'very-secure-pass',
      },
    ])
  })

  test('после «адрес занят» фокус на поле почты, затем тот же код уходит с другим адресом', async ({
    page,
  }) => {
    const state = await mockRegistration(page, async (body, route) => {
      if (body.email === 'busy@example.test')
        return json(route, 409, failure('EMAIL_ALREADY_REGISTERED'))
      state.registered = true
      return json(route, 201, { user: NEW_USER.user })
    })
    await page.goto('/register')
    await fill(page, {
      code: INVITATION_CODE,
      name: 'Мария',
      email: 'busy@example.test',
      password: 'very-secure-pass',
    })
    await page.getByLabel('Пароль', { exact: true }).press('Enter')
    await expect(page.getByText('Этот адрес уже зарегистрирован')).toBeVisible()
    // Фокус на поле с ошибкой: клавиатурный пользователь продолжает с него.
    await expect(page.getByLabel('Электронная почта')).toBeFocused()
    // Код и пароль остались в форме: исправляется только адрес.
    await expect(page.getByLabel('Код приглашения')).toHaveValue(INVITATION_CODE)
    await fill(page, { email: 'free@example.test' })
    await submit(page).click()
    await expect(page).toHaveURL(/\/onboarding\/company$/)
    expect(state.bodies.map((body) => [body.email, body.inviteCode])).toEqual([
      ['busy@example.test', INVITATION_CODE],
      ['free@example.test', INVITATION_CODE],
    ])
  })

  test('блокировка после 429 переживает перезагрузку страницы', async ({ page }) => {
    await mockRegistration(page, (_body, route) =>
      json(route, 429, failure('RATE_LIMITED'), { 'Retry-After': '60' }),
    )
    await page.goto('/register')
    await fill(page, {
      code: INVITATION_CODE,
      name: 'Мария',
      email: 'maria@example.test',
      password: 'very-secure-pass',
    })
    await submit(page).click()
    await expect(page.getByRole('button', { name: /Создать аккаунт через \d+ с/ })).toBeDisabled()
    await page.reload()
    await expect(page.getByRole('button', { name: /Создать аккаунт через \d+ с/ })).toBeDisabled()
  })

  test('форма доступна: нет нарушений axe, ссылка из письма подставляет код и убирает его из адреса', async ({
    page,
  }) => {
    await mockRegistration(page, (_body, route) => json(route, 201, {}))
    await page.goto(`/register?code=${INVITATION_CODE}`)
    await expect(page.getByLabel('Код приглашения')).toHaveValue(INVITATION_CODE)
    await expect(page).not.toHaveURL(/code=/)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})

test.describe('вход', () => {
  test('после неверного пароля фокус возвращается к полю пароля (поля были заблокированы на время запроса)', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/me', (route) => json(route, 401, failure('UNAUTHENTICATED')))
    await page.route('**/api/v1/auth/login', (route) =>
      json(route, 401, failure('INVALID_CREDENTIALS')),
    )
    await page.goto('/login')
    await page.getByLabel('Электронная почта').fill('owner@example.test')
    await page.getByLabel('Пароль', { exact: true }).fill('wrong-pass-12')
    await page.getByLabel('Пароль', { exact: true }).press('Enter')
    await expect(page.getByText('Не удалось войти')).toBeVisible()
    await expect(page.getByLabel('Пароль', { exact: true })).toBeFocused()
  })
})

/** Восстановление пароля и подтверждение почты (F03, S2): US-M01-05 и US-M01-06. */
const TOKEN = 'T'.repeat(43)

async function guest(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, 401, failure('UNAUTHENTICATED')))
}

test.describe('восстановление пароля', () => {
  test('страница по макету; адрес без @ не уходит; зарегистрированный и нет — один ответ «Проверьте почту»', async ({
    page,
  }) => {
    await guest(page)
    const requests: unknown[] = []
    await page.route('**/api/v1/auth/password/forgot', (route) => {
      requests.push(route.request().postDataJSON())
      return route.fulfill({ status: 204 })
    })
    await page.goto('/forgot-password')
    await expect(page.getByRole('heading', { level: 1, name: 'Восстановить пароль' })).toBeVisible()
    await expect(
      page.getByText(
        'Укажите почту. Если адрес зарегистрирован, мы отправим ссылку для нового пароля.',
      ),
    ).toBeVisible()
    await page.getByLabel('Электронная почта').fill('not-an-address')
    await page.getByRole('button', { name: 'Отправить ссылку' }).click()
    await expect(page.getByLabel('Электронная почта')).toHaveAttribute('aria-invalid', 'true')
    expect(requests).toHaveLength(0)
    // Любой корректный адрес получает один и тот же ответ: страница не раскрывает, есть ли учётная запись.
    for (const email of ['owner@example.test', 'nobody@example.test']) {
      await page.getByLabel('Электронная почта').fill(email)
      await page.getByRole('button', { name: 'Отправить ссылку' }).click()
      const done = page.getByTestId('reset-requested')
      await expect(done).toContainText('Проверьте почту')
      await expect(done).toContainText('Ссылка действует 60 минут')
      await expect(done).toContainText(email)
      await page.getByRole('button', { name: 'Ввести другой адрес' }).click()
    }
    expect(requests).toEqual([{ email: 'owner@example.test' }, { email: 'nobody@example.test' }])
    await expect(page.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login')
  })

  test('нет связи: «Не удалось отправить письмо» и фокус на поле почты', async ({ page }) => {
    await guest(page)
    await page.route('**/api/v1/auth/password/forgot', (route) => route.abort('failed'))
    await page.goto('/forgot-password')
    await page.getByLabel('Электронная почта').fill('owner@example.test')
    await page.getByLabel('Электронная почта').press('Enter')
    await expect(page.getByText('Не удалось отправить письмо')).toBeVisible()
    await expect(page.getByText('Проверьте подключение и попробуйте ещё раз.')).toBeVisible()
    await expect(page.getByLabel('Электронная почта')).toBeFocused()
    await expect(page.getByLabel('Электронная почта')).toHaveValue('owner@example.test')
  })

  test('предел писем: кнопка с обратным отсчётом переживает перезагрузку', async ({ page }) => {
    await guest(page)
    await page.route('**/api/v1/auth/password/forgot', (route) =>
      json(route, 429, failure('RATE_LIMITED'), { 'Retry-After': '120' }),
    )
    await page.goto('/forgot-password')
    await page.getByLabel('Электронная почта').fill('owner@example.test')
    await page.getByRole('button', { name: 'Отправить ссылку' }).click()
    await expect(page.getByRole('button', { name: /Повторить через/ })).toBeDisabled()
    await page.reload()
    await expect(page.getByRole('button', { name: /Повторить через/ })).toBeDisabled()
  })
})

test.describe('новый пароль по ссылке', () => {
  test('токен убирается из адреса; несовпадение паролей — у второго поля; успех ведёт на вход с «Пароль изменён»', async ({
    page,
  }) => {
    await guest(page)
    const bodies: unknown[] = []
    await page.route('**/api/v1/auth/password/reset', (route) => {
      bodies.push(route.request().postDataJSON())
      return route.fulfill({ status: 204 })
    })
    await page.goto(`/reset-password#token=${TOKEN}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Новый пароль' })).toBeVisible()
    await expect(page).not.toHaveURL(/token=/)
    await page.getByLabel('Новый пароль').fill('another-secure-password')
    await page.getByLabel('Повторите пароль').fill('another-secure-passwor')
    await page.getByRole('button', { name: 'Сменить пароль' }).click()
    await expect(page.getByText('Пароли не совпадают')).toBeVisible()
    await expect(page.getByLabel('Повторите пароль')).toBeFocused()
    expect(bodies).toHaveLength(0)
    await page.getByLabel('Повторите пароль').fill('another-secure-password')
    await page.getByRole('button', { name: 'Сменить пароль' }).click()
    await expect(page).toHaveURL(/\/login\?reset=done/)
    await expect(page.getByText('Пароль изменён')).toBeVisible()
    await expect(page.getByText('На всех устройствах вы вышли из аккаунта.')).toBeVisible()
    expect(bodies).toEqual([{ token: TOKEN, newPassword: 'another-secure-password' }])
  })

  test('недействительная ссылка: без токена и отклонённая сервером; ведёт к запросу нового письма', async ({
    page,
  }) => {
    await guest(page)
    await page.goto('/reset-password')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Ссылка недействительна' }),
    ).toBeVisible()
    await expect(page.getByTestId('reset-link-invalid')).toContainText('Ссылка устарела')
    await expect(page.getByRole('link', { name: 'Вернуться ко входу' })).toHaveAttribute(
      'href',
      '/login',
    )
    await page.route('**/api/v1/auth/password/reset', (route) =>
      json(route, 400, failure('RESET_TOKEN_INVALID')),
    )
    // Ссылка из письма открывается новой загрузкой страницы, а не сменой фрагмента.
    await page.goto(`/reset-password#token=${TOKEN}`)
    await page.reload()
    await page.getByLabel('Новый пароль').fill('another-secure-password')
    await page.getByLabel('Повторите пароль').fill('another-secure-password')
    await page.getByRole('button', { name: 'Сменить пароль' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Ссылка недействительна' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Запросить новую ссылку' }).click()
    await expect(page).toHaveURL(/\/forgot-password$/)
  })
})

test.describe('новый пароль при открытой сессии: исходы после подтверждённого сброса', () => {
  async function submitNewPassword(page: Page) {
    await page.goto(`/reset-password#token=${TOKEN}`)
    await page.getByLabel('Новый пароль').fill('another-secure-password')
    await page.getByLabel('Повторите пароль').fill('another-secure-password')
    await page.getByRole('button', { name: 'Сменить пароль' }).click()
  }

  test('/auth/me вернул 401: сессия и кэш очищены, открывается вход с «Пароль изменён», а не Radar', async ({
    page,
  }) => {
    let ended = false
    await page.route('**/api/v1/auth/me', (route) =>
      ended ? json(route, 401, failure('UNAUTHENTICATED')) : json(route, 200, NEW_USER),
    )
    await page.route('**/api/v1/auth/password/reset', (route) => {
      ended = true
      return route.fulfill({ status: 204 })
    })
    await submitNewPassword(page)
    await expect(page).toHaveURL(/\/login\?reset=done/)
    await expect(page.getByText('Пароль изменён')).toBeVisible()
    await expect(page.getByText('На всех устройствах вы вышли из аккаунта.')).toBeVisible()
  })

  test('/auth/me вернул действующую сессию: результат виден, сессия сохранена, автоматического выхода нет', async ({
    page,
  }) => {
    let resets = 0
    await page.route('**/api/v1/auth/me', (route) => json(route, 200, NEW_USER))
    await page.route('**/api/v1/auth/password/reset', (route) => {
      resets += 1
      return route.fulfill({ status: 204 })
    })
    await submitNewPassword(page)
    const done = page.getByTestId('reset-done-signed-in')
    await expect(done).toContainText('Пароль изменён')
    // Форма размонтирована: фокус на заголовке результата, а не на удалённой кнопке.
    await expect(page.getByRole('heading', { level: 1, name: 'Пароль изменён' })).toBeFocused()
    await expect(done).toContainText(
      'Пароль по ссылке успешно изменён. В этом браузере вы вошли как maria@example.test.',
    )
    // Гостевой вход не перехватил результат, переходов нет.
    await expect(page).toHaveURL(/\/reset-password$/)
    await expect(page.getByRole('button', { name: 'Продолжить работу' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Выйти и войти в другой аккаунт' })).toBeVisible()
    expect(resets).toBe(1)
    await page.getByRole('button', { name: 'Продолжить работу' }).click()
    await expect(page).toHaveURL(/\/onboarding\/company$/) // текущий аккаунт без организации
  })

  const LONG_EMAIL = 'longlocallonglocallonglocallonglocallonglocallonglocallonglocal@example.test'

  for (const width of [320, 390, 834, 1440]) {
    test(`длинный адрес переносится внутри карточки без прокрутки страницы (${width} px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.route('**/api/v1/auth/me', (route) =>
        json(route, 200, {
          ...NEW_USER,
          user: { ...NEW_USER.user, email: LONG_EMAIL },
        }),
      )
      await page.route('**/api/v1/auth/password/reset', (route) => route.fulfill({ status: 204 }))
      await submitNewPassword(page)
      const description = page.getByTestId('auth-card-description')
      await expect(description).toContainText(LONG_EMAIL)
      await expect(page.getByRole('heading', { level: 1, name: 'Пароль изменён' })).toBeFocused()
      const geometry = await page.evaluate(() => {
        const text = document.querySelector('[data-testid="auth-card-description"]')!
        const card = text.closest('[data-slot="card"]') ?? text.parentElement!.parentElement!
        const t = text.getBoundingClientRect()
        const c = card.getBoundingClientRect()
        return {
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
          textRight: t.right,
          cardRight: c.right,
          textLeft: t.left,
          cardLeft: c.left,
        }
      })
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.client)
      expect(geometry.textRight).toBeLessThanOrEqual(geometry.cardRight)
      expect(geometry.textLeft).toBeGreaterThanOrEqual(geometry.cardLeft)
      await expect(page.getByRole('button', { name: 'Продолжить работу' })).toBeInViewport()
      await expect(
        page.getByRole('button', { name: 'Выйти и войти в другой аккаунт' }),
      ).toBeVisible()
      // Подпись не шире своей кнопки: узкий экран переносит её, а не выпускает за рамку.
      for (const name of ['Продолжить работу', 'Выйти и войти в другой аккаунт']) {
        const button = page.getByRole('button', { name })
        const overflow = await button.evaluate((el) => el.scrollWidth - el.clientWidth)
        expect(overflow, name).toBeLessThanOrEqual(0)
      }
      await page.screenshot({
        path: `artifacts/frontend-v2/F03/actual/reset-long-email-${width}.png`,
        fullPage: true,
      })
    })
  }

  test('«Выйти и войти в другой аккаунт»: существующий выход, затем вход', async ({ page }) => {
    let loggedOut = false
    await page.route('**/api/v1/auth/me', (route) =>
      loggedOut ? json(route, 401, failure('UNAUTHENTICATED')) : json(route, 200, NEW_USER),
    )
    await page.route('**/api/v1/auth/logout', (route) => {
      loggedOut = true
      return route.fulfill({ status: 204 })
    })
    await page.route('**/api/v1/auth/password/reset', (route) => route.fulfill({ status: 204 }))
    await submitNewPassword(page)
    await page.getByRole('button', { name: 'Выйти и войти в другой аккаунт' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Вход в LidRadar' })).toBeVisible()
  })

  test('перечитать сессию не удалось: успех сохраняется, сессия завершена локально, вход говорит об этом отдельным текстом', async ({
    page,
  }) => {
    let resets = 0
    let reset = false
    await page.route('**/api/v1/auth/me', (route) =>
      reset ? json(route, 500, failure('INTERNAL_ERROR')) : json(route, 200, NEW_USER),
    )
    await page.route('**/api/v1/auth/password/reset', (route) => {
      resets += 1
      reset = true
      return route.fulfill({ status: 204 })
    })
    await submitNewPassword(page)
    await expect(page).toHaveURL(/\/login\?reset=local/)
    await expect(page.getByText('Пароль изменён')).toBeVisible()
    await expect(page.getByText('завершили её здесь локально')).toBeVisible()
    // Отзыв сессии сервером здесь не утверждается.
    await expect(page.getByText('На всех устройствах вы вышли из аккаунта.')).toHaveCount(0)
    expect(resets).toBe(1)
  })

  test('нет ответа на сам сброс: результат неизвестен — без заявлений об успехе и об отсутствии изменений', async ({
    page,
  }) => {
    let resets = 0
    await page.route('**/api/v1/auth/me', (route) => json(route, 200, NEW_USER))
    await page.route('**/api/v1/auth/password/reset', (route) => {
      resets += 1
      return route.abort('failed')
    })
    await submitNewPassword(page)
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Результат неизвестен')
    await expect(alert).toContainText('Пароль мог измениться, а мог остаться прежним')
    await expect(alert).not.toContainText(/не изменены|успешно/)
    await expect(page.getByTestId('reset-done-signed-in')).toHaveCount(0)
    await expect(page).toHaveURL(/\/reset-password$/)
    expect(resets).toBe(1)
  })
})

test.describe('подтверждение почты по ссылке', () => {
  test('гость: «Почта подтверждена», токен убран из адреса, кнопка «Войти»', async ({ page }) => {
    await guest(page)
    const bodies: unknown[] = []
    await page.route('**/api/v1/auth/email/verify', (route) => {
      bodies.push(route.request().postDataJSON())
      return route.fulfill({ status: 204 })
    })
    await page.goto(`/verify-email#token=${TOKEN}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Почта подтверждена' })).toBeVisible()
    await expect(page).not.toHaveURL(/token=/)
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(page).toHaveURL(/\/login/)
    expect(bodies).toEqual([{ token: TOKEN }])
  })

  test('недействительная ссылка объясняется; нет связи — «Нет соединения» и «Повторить проверку»', async ({
    page,
  }) => {
    await guest(page)
    await page.goto('/verify-email')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Ссылка недействительна' }),
    ).toBeVisible()
    await expect(
      page.getByText('Войдите и запросите новое письмо в разделе «Настройки → Аккаунт».'),
    ).toBeVisible()
    let online = false
    await page.route('**/api/v1/auth/email/verify', (route) =>
      online ? route.fulfill({ status: 204 }) : route.abort('failed'),
    )
    await page.goto(`/verify-email#token=${TOKEN}`)
    await page.reload()
    await expect(page.getByText('Нет соединения')).toBeVisible()
    await expect(
      page.getByText('Не удалось связаться с сервером. Проверьте подключение.'),
    ).toBeVisible()
    online = true
    await page.getByRole('button', { name: 'Повторить проверку' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Почта подтверждена' })).toBeVisible()
  })
})
