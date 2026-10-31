import { readFile } from 'node:fs/promises'
import { relative } from 'node:path'
import { expect, test, type Locator, type Page, type Route, type TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { TENANT_ID, mockOwner } from './fixtures/api'

/** Evidence принадлежит конкретному test/project/retry, а не историческому раунду. */
async function captureRunEvidence(page: Page, info: TestInfo, filename: string): Promise<void> {
  const path = info.outputPath(filename)
  // Защита срабатывает до screenshot, если сюда вернётся hardcoded historical path.
  expect(relative(info.outputDir, path)).toBe(filename)
  await page.screenshot({ path, fullPage: true })
  // Проверяется реально созданный PNG: guard не должен проверять неиспользуемую переменную.
  expect((await readFile(path)).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  await info.attach(filename, { path, contentType: 'image/png' })
}

/**
 * Доступ (F03). Регистрация US-M01-01 (A/B2/B3/C) и нейтральный отказ US-M01-02 — на сборке
 * с mock-API: обе ссылки входа, режим текущего входа, проверка кода, контекст вкладки, отправка,
 * восстановление исхода, переходы по существующим guard-ам, адаптивы и нижняя строка desktop.
 * Коды, адреса и пароли синтетические; реальные письма и приглашения не используются. Mock не
 * доказывает поведение сервера и БД (T29–T31 — отдельный реальный контур).
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

/* ---------- US-M01-01 · Регистрация A/B/C ---------- */

/** Синтетические коды: ровно 43 символа base64url, смешанный регистр. */
const synthetic = (prefix: string) => prefix.padEnd(43, 'a')
const CODE = synthetic('SynValid-Code_')
const OTHER_CODE = synthetic('SynOther-Code_')
const EMPLOYEE_CODE = synthetic('SynEmployee-Code_')
/** Четыре причины непригодности: сервер отвечает одинаковым 403 без раскрытия причины. */
const REJECTED_CODES = {
  неизвестный: synthetic('SynUnknown_'),
  просроченный: synthetic('SynExpired_'),
  отозванный: synthetic('SynRevoked_'),
  использованный: synthetic('SynUsed_'),
}
const PASSWORD = 'synthetic-pass-12'
const CONTEXT_KEY = 'lidradar.registration.invitation'

interface AccessState {
  mode: 'open' | 'invite_only'
  /** Задержка ответа режима (ожидание каркаса). */
  modeGate: Promise<void> | null
  /** Ответить 500 на ближайшие N запросов режима. */
  modeFailures: number
  modeRequests: number
  checks: string[]
  check: (code: string, route: Route) => Promise<void>
  registers: Array<Record<string, unknown>>
  register: (body: Record<string, unknown>, route: Route) => Promise<void>
  registered: boolean
  /** Ответ `/auth/me` после регистрации; `null` — гость. */
  me: Record<string, unknown> | null
  meFailures: number
  meRequests: number
  /** Все запросы API: метод и путь. */
  api: string[]
}

/** Гость с mock регистрации. Владелец/радар — из общих фикстур для переходов после успеха. */
async function mockAccess(page: Page, init: Partial<AccessState> = {}): Promise<AccessState> {
  await mockOwner(page)
  const state: AccessState = {
    mode: 'open',
    modeGate: null,
    modeFailures: 0,
    modeRequests: 0,
    checks: [],
    check: async (code, route) => {
      if ([CODE, OTHER_CODE, EMPLOYEE_CODE].includes(code)) return route.fulfill({ status: 204 })
      return json(route, 403, failure('INVITATION_INVALID'))
    },
    registers: [],
    register: async (body, route) => {
      state.registered = true
      state.me =
        body.inviteCode === EMPLOYEE_CODE
          ? {
              ...NEW_USER,
              canCreateOrganization: false,
              memberships: [
                { tenantId: TENANT_ID, organizationName: 'Студия «Блик»', role: 'MANAGER' },
              ],
            }
          : NEW_USER
      return json(route, 201, { user: NEW_USER.user })
    },
    registered: false,
    me: null,
    meFailures: 0,
    meRequests: 0,
    api: [],
    ...init,
  }
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/')) state.api.push(`${request.method()} ${url.pathname}`)
  })
  await page.route('**/api/v1/auth/me', (route) => {
    state.meRequests++
    if (state.registered && state.meFailures > 0) {
      state.meFailures--
      return json(route, 500, failure('INTERNAL_ERROR'))
    }
    if (state.registered && state.me) return json(route, 200, state.me)
    return json(route, 401, failure('UNAUTHENTICATED'))
  })
  await page.route('**/api/v1/auth/registration', async (route) => {
    state.modeRequests++
    if (state.modeGate) await state.modeGate
    if (state.modeFailures > 0) {
      state.modeFailures--
      return json(route, 500, failure('INTERNAL_ERROR'))
    }
    return json(route, 200, { mode: state.mode })
  })
  await page.route('**/api/v1/auth/registration/invitation/check', async (route) => {
    const { code } = route.request().postDataJSON() as { code: string }
    state.checks.push(code)
    try {
      await state.check(code, route)
    } catch {
      // Запрос отменён клиентом (уход со страницы): ответа уже никто не ждёт.
    }
  })
  await page.route('**/api/v1/auth/register', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    state.registers.push(body)
    try {
      await state.register(body, route)
    } catch {
      // Отменённый запрос.
    }
  })
  await page.route('**/api/v1/auth/logout', (route) => {
    state.registered = false
    state.me = null
    return route.fulfill({ status: 204 })
  })
  return state
}

function gate(): { promise: Promise<void>; open: () => void } {
  let open!: () => void
  const promise = new Promise<void>((resolve) => (open = resolve))
  return { promise, open }
}

const codeInput = (page: Page) => page.getByLabel('Код приглашения')
const codeMessage = (page: Page) => page.getByTestId('invitation-code-message')
const checkAction = (page: Page) => page.getByRole('button', { name: 'Проверить код' })
const submitButton = (page: Page) => page.getByRole('button', { name: /Создать аккаунт/ })
const heading = (page: Page) => page.getByRole('heading', { level: 1 })

async function fillAccount(
  page: Page,
  values: { name?: string; email?: string; password?: string } = {},
): Promise<void> {
  await page.getByLabel('Имя').fill(values.name ?? 'Мария')
  await page.getByLabel('Электронная почта').fill(values.email ?? 'maria@example.test')
  await page.getByLabel('Пароль', { exact: true }).fill(values.password ?? PASSWORD)
}

/** B2 → B3 вводом проверенного кода. */
async function passInvitation(page: Page, code = CODE): Promise<void> {
  await codeInput(page).fill(code)
  await expect(
    page.getByText('Приглашение проверено. Заполните данные для создания аккаунта.'),
  ).toBeVisible()
}

async function storedContext(page: Page): Promise<string | null> {
  return page.evaluate((key) => sessionStorage.getItem(key), CONTEXT_KEY)
}

async function box(locator: Locator) {
  const value = await locator.boundingBox()
  if (!value) throw new Error('элемент не отображается')
  return value
}

const center = (value: { x: number; y: number; width: number; height: number }) => ({
  x: value.x + value.width / 2,
  y: value.y + value.height / 2,
})

test.describe('US-M01-01 · вход и выбор сценария (T01, T02)', () => {
  test('T01: две ссылки входа; A/C по ответу режима; приглашение в обоих режимах без запроса режима', async ({
    page,
  }) => {
    const state = await mockAccess(page, { mode: 'open' })
    await page.goto('/login')
    const register = page.getByRole('navigation', { name: 'Регистрация' })
    await expect(register.getByRole('link', { name: 'Создать аккаунт' })).toHaveAttribute(
      'href',
      '/register',
    )
    await expect(register.getByRole('link', { name: 'У меня есть приглашение' })).toHaveAttribute(
      'href',
      '/register?flow=invite',
    )
    await register.getByRole('link', { name: 'Создать аккаунт' }).click()
    await expect(page).toHaveURL(/\/register$/)
    await expect(
      page.getByText('Заполните имя, электронную почту и пароль, чтобы создать аккаунт.'),
    ).toBeVisible()
    await expect(page.getByText('Регистрация закрыта')).toHaveCount(0)

    state.mode = 'invite_only'
    await page.goto('/login')
    await page.getByRole('link', { name: 'Создать аккаунт' }).click()
    await expect(page.getByText('Регистрация закрыта')).toBeVisible()
    await expect(page.getByLabel('Имя')).toBeDisabled()

    for (const mode of ['open', 'invite_only'] as const) {
      state.mode = mode
      await page.goto('/login')
      const before = state.modeRequests
      await page.getByRole('link', { name: 'У меня есть приглашение' }).click()
      await expect(page).toHaveURL(/\/register\?flow=invite$/)
      await expect(heading(page)).toHaveText('Регистрация по приглашению')
      await passInvitation(page)
      expect(state.modeRequests).toBe(before)
      // Следующий режим проверяем с новым явным B2, без proof предыдущего прогона.
      await page.getByRole('button', { name: 'Использовать другое приглашение' }).click()
    }
  })

  test('T01/B14: возврат через вход перепроверяет контекст, сохраняет TTL и очищает пароль', async ({
    page,
  }) => {
    const state = await mockAccess(page)
    await page.goto('/register?flow=invite')
    await passInvitation(page)
    await fillAccount(page)
    const initial = await storedContext(page)
    await page.getByRole('link', { name: 'Войти', exact: true }).click()
    await page.getByRole('link', { name: 'У меня есть приглашение' }).click()
    await expect(page.getByLabel('Имя')).toBeVisible()
    expect(state.checks).toEqual([CODE, CODE])
    expect(await storedContext(page)).toBe(initial)
    await expect(page.getByLabel('Пароль', { exact: true })).toHaveValue('')
    await page.getByRole('link', { name: 'Войти', exact: true }).click()
    await page.getByRole('link', { name: 'Создать аккаунт' }).click()
    await expect(page.getByLabel('Имя')).toBeVisible()
    expect(await storedContext(page)).toBeNull()
    await expect(page.getByRole('button', { name: 'Использовать другое приглашение' })).toHaveCount(
      0,
    )
    expect(state.registers).toHaveLength(0)
  })

  test('T02: каркас до свежего ответа режима; прежний open не открывает A; сбой — повтор; B2 доступен', async ({
    page,
  }) => {
    const state = await mockAccess(page, { mode: 'open' })
    await page.goto('/register')
    await expect(page.getByLabel('Имя')).toBeEnabled()
    // Режим закрыли; новый вход на страницу ждёт свежего ответа, прежний open не используется.
    const wait = gate()
    state.mode = 'invite_only'
    state.modeGate = wait.promise
    await page.getByRole('link', { name: 'Войти' }).click()
    await page.getByRole('link', { name: 'Создать аккаунт' }).click()
    await expect(page.getByText('Загружаем форму регистрации…')).toBeVisible()
    await expect(page.getByLabel('Имя')).toHaveCount(0)
    await expect(submitButton(page)).toHaveCount(0)
    wait.open()
    state.modeGate = null
    await expect(page.getByText('Регистрация закрыта')).toBeVisible()

    // Сбой режима — служебная ошибка с ручным повтором, без автоматических повторов.
    state.mode = 'open'
    state.modeFailures = 1
    const before = state.modeRequests
    await page.goto('/register')
    await expect(page.getByText('Не удалось загрузить форму регистрации')).toBeVisible()
    expect(state.modeRequests).toBe(before + 1)
    await page.getByRole('button', { name: 'Повторить' }).click()
    await expect(page.getByLabel('Имя')).toBeEnabled()
    expect(state.modeRequests).toBe(before + 2)

    // При недоступном режиме приглашение всё равно доступно.
    state.modeFailures = 1
    await page.goto('/register')
    await expect(page.getByText('Не удалось загрузить форму регистрации')).toBeVisible()
    await page.getByRole('link', { name: 'Использовать код приглашения' }).click()
    await expect(page).toHaveURL(/\/register\?flow=invite$/)
    await passInvitation(page)
  })

  test('T02: таймаут режима не оставляет бесконечный каркас', async ({ page }) => {
    await page.clock.install()
    const state = await mockAccess(page, { modeGate: new Promise(() => {}) })
    await page.goto('/register')
    await expect(page.getByText('Загружаем форму регистрации…')).toBeVisible()
    await expect.poll(() => state.modeRequests).toBe(1)
    await page.clock.fastForward(16_000)
    await expect(page.getByText('Не удалось загрузить форму регистрации')).toBeVisible()
  })
})

test.describe('US-M01-01 · общая форма A/B3 и закрытая C (T03–T08)', () => {
  test('T03: A и B3 — одни поля без кода, разные пояснения и ссылки', async ({ page }) => {
    await mockAccess(page, { mode: 'open' })
    await page.goto('/register')
    const fields = async () =>
      page
        .locator('form input')
        .evaluateAll((inputs) => inputs.map((input) => input.getAttribute('name')))
    await expect.poll(fields).toEqual(['name', 'email', 'new-password'])
    await expect(page.getByRole('link', { name: 'Использовать код приглашения' })).toBeVisible()
    await expect(
      page.getByText('Приглашение проверено. Заполните данные для создания аккаунта.', {
        exact: true,
      }),
    ).toHaveCount(0)
    await page.goto('/register?flow=invite')
    await passInvitation(page)
    await expect.poll(fields).toEqual(['name', 'email', 'new-password'])
    await expect(
      page.getByRole('button', { name: 'Использовать другое приглашение' }),
    ).toBeVisible()
    await expect(page.getByText('Заполните имя, электронную почту и пароль')).toHaveCount(0)
    await expect(codeInput(page)).toHaveCount(0)
  })

  test('T04: проверки до запроса — имя, пароль 11, почта без @ с точным текстом', async ({
    page,
  }) => {
    const state = await mockAccess(page, { mode: 'open' })
    await page.goto('/register')
    await submitButton(page).click()
    await expect(page.getByText('Введите имя')).toBeVisible()
    await expect(page.getByLabel('Имя')).toBeFocused()
    await fillAccount(page, { password: '12345678901' })
    await submitButton(page).click()
    await expect(page.getByText('Не меньше 12 символов', { exact: true })).toBeVisible()
    await fillAccount(page, { email: 'maria.example.test' })
    await submitButton(page).click()
    await expect(page.getByText('Введите корректный адрес электронной почты.')).toBeVisible()
    await expect(page.getByLabel('Электронная почта')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Электронная почта')).toBeFocused()
    // Поле не принимает 201-ю букву; 200 — допустимое имя.
    await page.getByLabel('Имя').fill('я'.repeat(201))
    await expect(page.getByLabel('Имя')).toHaveValue('я'.repeat(200))
    expect(state.registers).toHaveLength(0)
  })

  test('T05: A без приглашения — аккаунт, сессия, шаг «Расскажите о компании»; организация не создаётся', async ({
    page,
  }) => {
    const state = await mockAccess(page, { mode: 'open' })
    await page.goto('/register')
    await fillAccount(page)
    await submitButton(page).click()
    await expect(page).toHaveURL(/\/onboarding\/company$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Расскажите о компании' }),
    ).toBeVisible()
    expect(state.registers).toEqual([
      { email: 'maria@example.test', displayName: 'Мария', password: PASSWORD },
    ])
    expect(state.api.filter((call) => call === 'POST /api/v1/organizations')).toEqual([])
    expect(state.checks).toEqual([])
  })

  test('T06: A → B2 и C → B2 без пароля и подтверждения; B3 → другое приглашение; Назад/Вперёд', async ({
    page,
  }) => {
    const state = await mockAccess(page, { mode: 'open' })
    await page.goto('/register')
    await fillAccount(page)
    await page.getByRole('link', { name: 'Использовать код приглашения' }).click()
    await expect(page).toHaveURL(/\/register\?flow=invite$/)
    await expect(codeInput(page)).toHaveValue('')
    await expect(codeInput(page)).toBeFocused()
    await passInvitation(page)
    // Имя и почта могут остаться в памяти страницы, пароль в другой сценарий не переносится.
    await expect(page.getByLabel('Пароль', { exact: true })).toHaveValue('')
    await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Использовать другое приглашение' }).click()
    await expect(codeInput(page)).toHaveValue('')
    expect(await storedContext(page)).toBeNull()
    await passInvitation(page, OTHER_CODE)
    await expect(page.getByLabel('Пароль', { exact: true })).toHaveValue('')
    expect(state.checks).toEqual([CODE, OTHER_CODE])

    // Назад — к A: контекст приглашения очищен; Вперёд — к пустому B2, без прежнего подтверждения.
    await page.goBack()
    await expect(page).toHaveURL(/\/register$/)
    await expect(page.getByText('Заполните имя, электронную почту и пароль')).toBeVisible()
    expect(await storedContext(page)).toBeNull()
    await page.goForward()
    await expect(page).toHaveURL(/\/register\?flow=invite$/)
    await expect(codeInput(page)).toHaveValue('')

    state.mode = 'invite_only'
    await page.goto('/register')
    await page.getByRole('link', { name: 'Использовать код приглашения' }).click()
    await expect(codeInput(page)).toHaveValue('')
  })

  test('T07: C — warning над карточкой, всё отключено, Enter и клик не отправляют; вход, правовые и приглашение активны', async ({
    page,
  }) => {
    const state = await mockAccess(page, { mode: 'invite_only' })
    await page.goto('/register')
    const warning = page.getByRole('alert').filter({ hasText: 'Регистрация закрыта' })
    await expect(warning).toContainText('Доступ только по приглашению.')
    const card = page.locator('.rounded-card').filter({ has: heading(page) })
    expect((await box(warning)).y + (await box(warning)).height).toBeLessThan((await box(card)).y)
    for (const label of ['Имя', 'Электронная почта'])
      await expect(page.getByLabel(label)).toBeDisabled()
    await expect(page.getByLabel('Пароль', { exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Показать пароль' })).toBeDisabled()
    await expect(submitButton(page)).toBeDisabled()
    await submitButton(page).click({ force: true })
    await page.keyboard.press('Enter')
    await expect(page.getByText('Заполните имя')).toHaveCount(0)
    await expect(
      page.getByText('Приглашение проверено. Заполните данные для создания аккаунта.', {
        exact: true,
      }),
    ).toHaveCount(0)
    expect(state.registers).toHaveLength(0)
    for (const link of await page.getByTestId('register-legal').getByRole('link').all()) {
      await expect(link).toHaveAttribute('target', '_blank')
    }
    await expect(page.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login')
    // Клавиатура: из ссылки приглашения Tab ведёт дальше, а не в отключённые поля.
    await page.getByRole('link', { name: 'Использовать код приглашения' }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/register\?flow=invite$/)
  })

  test('T08: режим закрылся до отправки A — INVITATION_REQUIRED, свежий режим, C; без кода повторить нельзя', async ({
    page,
  }) => {
    const state = await mockAccess(page, { mode: 'open' })
    state.register = async (_body, route) => {
      state.mode = 'invite_only'
      await json(route, 403, failure('INVITATION_REQUIRED'))
    }
    await page.goto('/register')
    await fillAccount(page)
    const before = state.modeRequests
    await submitButton(page).click()
    await expect(page.getByText('Регистрация закрыта')).toBeVisible()
    expect(state.modeRequests).toBe(before + 1)
    await expect(submitButton(page)).toBeDisabled()
    await page.keyboard.press('Enter')
    expect(state.registers).toHaveLength(1)
    await page.getByRole('link', { name: 'Использовать код приглашения' }).click()
    await expect(codeInput(page)).toBeVisible()
  })
})

test.describe('US-M01-01 · шаг кода B2 (T09–T16)', () => {
  test('T09: поле 46 px с одной рамкой 1 px, действие 44/36/20 по центру, имя и подсказки; кнопки снизу нет', async ({
    page,
  }) => {
    await mockAccess(page)
    await page.goto('/register?flow=invite')
    const input = codeInput(page)
    await expect(input).toHaveAttribute('placeholder', 'Вставьте код приглашения')
    await expect(page.getByText('43 символа. Скопируйте и вставьте код целиком.')).toBeVisible()
    await expect(page.getByText('Код проверится автоматически после ввода.')).toBeVisible()
    const field = await box(input)
    expect(field.height).toBe(46)
    expect(
      await input.evaluate(
        (el) => (el.parentElement as HTMLElement).getBoundingClientRect().height,
      ),
    ).toBe(46)
    const borders = await input.evaluate((el) => {
      const style = getComputedStyle(el)
      return [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ]
    })
    expect(borders).toEqual(['1px', '1px', '1px', '1px'])
    const hit = await box(checkAction(page))
    const face = await box(page.getByTestId('invitation-check-face'))
    const icon = await box(page.getByTestId('invitation-check-icon'))
    expect([hit.width, hit.height]).toEqual([44, 44])
    expect([face.width, face.height]).toEqual([36, 36])
    expect([icon.width, icon.height]).toEqual([20, 20])
    for (const inner of [face, icon]) {
      expect(Math.abs(center(inner).x - center(hit).x)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(center(inner).y - center(hit).y)).toBeLessThanOrEqual(0.5)
    }
    expect(Math.abs(center(hit).y - center(field).y)).toBeLessThanOrEqual(0.5)
    // Видимая кнопка в 5 px от правого края поля; у обёртки нет второй рамки.
    expect(Math.round(field.x + field.width - (face.x + face.width))).toBe(5)
    await expect(page.getByTestId('invitation-check-face')).toHaveCSS('border-top-width', '0px')
    const form = page.locator('form').filter({ has: input })
    await expect(form.getByRole('button')).toHaveCount(1)
  })

  test('T10: пустое, 42, 44, кириллица и недопустимый знак — без запроса; пробелы убираются без смены регистра', async ({
    page,
  }) => {
    const state = await mockAccess(page)
    await page.goto('/register?flow=invite')
    await codeInput(page).press('Enter')
    await expect(codeMessage(page).getByText('Для регистрации нужен код приглашения')).toBeVisible()
    const format = codeMessage(page).getByText(
      'Код состоит из 43 символов: латиница, цифры, «-» и «_»',
    )
    for (const value of [
      CODE.slice(0, 42),
      `${CODE}a`,
      `${CODE.slice(0, 42)}ж`,
      `${CODE.slice(0, 42)}+`,
    ]) {
      await codeInput(page).fill(value)
      await checkAction(page).click()
      await expect(format).toBeVisible()
      await expect(codeInput(page)).toHaveAttribute('aria-invalid', 'true')
      // Стрелка остаётся синей: это ошибка формата, а не отказ кода.
      await expect(page.getByTestId('invitation-check-face')).toHaveCSS(
        'background-color',
        'rgb(0, 113, 227)',
      )
    }
    expect(state.checks).toEqual([])
    await codeInput(page).fill(` ${CODE.slice(0, 21)} ${CODE.slice(21)} `)
    await expect(
      page.getByText('Приглашение проверено. Заполните данные для создания аккаунта.', {
        exact: true,
      }),
    ).toBeVisible()
    expect(state.checks).toEqual([CODE])
  })

  test('T11: вставка полного кода — одна проверка; Enter до таймера не создаёт дубль', async ({
    page,
  }) => {
    const state = await mockAccess(page)
    const hold = gate()
    state.check = async (_code, route) => {
      await hold.promise
      await route.fulfill({ status: 204 })
    }
    await page.goto('/register?flow=invite')
    await codeInput(page).fill(CODE)
    await codeInput(page).press('Enter')
    await codeInput(page).press('Enter')
    await expect(checkAction(page)).toHaveAttribute('aria-disabled', 'true')
    // Playwright click ждёт enabled и мог отправить уже новый запрос после timeout.
    // Здесь проверяем именно защиту обработчика от повторного действия во время запроса.
    await checkAction(page).evaluate((button: HTMLButtonElement) => button.click())
    await expect(codeMessage(page).getByText('Проверяем код приглашения…')).toBeVisible()
    hold.open()
    await expect(
      page.getByText('Приглашение проверено. Заполните данные для создания аккаунта.', {
        exact: true,
      }),
    ).toBeVisible()
    expect(state.checks).toEqual([CODE])
  })

  test('T12: ожидание ответа — поле и действие недоступны, код сохранён, индикатор 20 px по центру; затем B3 без кода', async ({
    page,
  }) => {
    const state = await mockAccess(page)
    const hold = gate()
    state.check = async (_code, route) => {
      await hold.promise
      await route.fulfill({ status: 204 })
    }
    await page.goto('/register?flow=invite')
    await expect(codeInput(page)).toBeVisible()
    const meBefore = state.meRequests
    await codeInput(page).fill(CODE)
    await expect(codeMessage(page).getByText('Проверяем код приглашения…')).toBeVisible()
    await expect(codeMessage(page).getByText('Это займёт несколько секунд.')).toBeVisible()
    await expect(codeInput(page)).toHaveValue(CODE)
    await expect(codeInput(page)).not.toBeEditable()
    await expect(codeInput(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(checkAction(page)).toHaveAttribute('aria-busy', 'true')
    await expect(checkAction(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(codeInput(page)).toBeFocused()
    const face = await box(page.getByTestId('invitation-check-face'))
    const spinner = await box(page.getByTestId('invitation-check-icon'))
    expect([spinner.width, spinner.height]).toEqual([20, 20])
    // Сам индикатор 20×20, а не прежние 16 px (рамка выше не вращается).
    await expect(page.getByTestId('invitation-check-spinner')).toHaveCSS('width', '20px')
    await expect(page.getByTestId('invitation-check-spinner')).toHaveCSS('height', '20px')
    expect(Math.abs(center(spinner).x - center(face).x)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(center(spinner).y - center(face).y)).toBeLessThanOrEqual(0.5)
    hold.open()
    await expect(page).toHaveURL(/\/register\?flow=invite$/)
    await expect(page.getByLabel('Имя')).toBeFocused()
    await expect(codeInput(page)).toHaveCount(0)
    // Предварительная проверка не создаёт и не загружает сессию (AC-B10, фронтовая часть).
    expect(state.meRequests).toBe(meBefore)
    expect(state.api.filter((call) => call.includes('/auth/register'))).toEqual([])
  })

  test('T13: все четыре причины отказа — один вид: красная граница, текст, красная кнопка с «!»; правка — снова синяя стрелка', async ({
    page,
  }) => {
    const state = await mockAccess(page)
    await page.goto('/register?flow=invite')
    for (const [reason, code] of Object.entries(REJECTED_CODES)) {
      await codeInput(page).fill(code)
      await expect(codeMessage(page).getByText('Код приглашения не подошёл'), reason).toBeVisible()
      await expect(codeInput(page)).toHaveValue(code)
      await expect(codeInput(page)).toHaveAttribute('aria-invalid', 'true')
      await expect(codeInput(page)).toHaveCSS('border-top-color', 'rgb(210, 42, 37)')
      await expect(page.getByTestId('invitation-check-face')).toHaveCSS(
        'background-color',
        'rgb(210, 42, 37)',
      )
      await expect(codeInput(page)).toBeEditable()
      await codeInput(page).press('End')
      await codeInput(page).press('Backspace')
      await expect(codeMessage(page).getByText('Код приглашения не подошёл')).toHaveCount(0)
      await expect(page.getByTestId('invitation-check-face')).toHaveCSS(
        'background-color',
        'rgb(0, 113, 227)',
      )
    }
    expect(state.checks).toEqual(Object.values(REJECTED_CODES))
  })

  test('T14: 400, Origin, неожиданный 401, 404, 500 и обрыв сети — служебный сбой без «!», без B3 и без ухода на вход', async ({
    page,
  }) => {
    const state = await mockAccess(page)
    const responses: Array<[string, (route: Route) => Promise<void>]> = [
      ['400', (route) => json(route, 400, failure('INVALID_ARGUMENT'))],
      ['403 Origin', (route) => json(route, 403, failure('ORIGIN_NOT_ALLOWED'))],
      ['401', (route) => json(route, 401, failure('UNAUTHENTICATED'))],
      ['404', (route) => json(route, 404, failure('ROUTE_NOT_FOUND'))],
      ['500', (route) => json(route, 500, failure('INTERNAL_ERROR'))],
      ['сеть', (route) => route.abort('internetdisconnected')],
    ]
    await page.goto('/register?flow=invite')
    for (const [name, respond] of responses) {
      state.check = async (_code, route) => respond(route)
      await codeInput(page).fill('')
      await codeInput(page).fill(CODE)
      await expect(
        codeMessage(page).getByText('Не удалось проверить код. Попробуйте ещё раз.'),
        name,
      ).toBeVisible()
      await expect(codeMessage(page).getByText('Код приглашения не подошёл')).toHaveCount(0)
      await expect(page.getByTestId('invitation-check-face')).toHaveCSS(
        'background-color',
        'rgb(0, 113, 227)',
      )
      await expect(codeInput(page)).toHaveValue(CODE)
      await expect(codeInput(page)).toBeEditable()
      await expect(page).toHaveURL(/\/register\?flow=invite$/)
    }
    // Ручной повтор тем же действием.
    state.check = async (_code, route) => route.fulfill({ status: 204 })
    await checkAction(page).click()
    await expect(
      page.getByText('Приглашение проверено. Заполните данные для создания аккаунта.', {
        exact: true,
      }),
    ).toBeVisible()
  })

  test('T15: 429 — отсчёт по Retry-After, другой код не обходит, по окончании без автозапроса', async ({
    page,
  }) => {
    await page.clock.install()
    const state = await mockAccess(page)
    state.check = async (_code, route) =>
      json(route, 429, failure('RATE_LIMITED'), { 'Retry-After': '30' })
    await page.goto('/register?flow=invite')
    await codeInput(page).fill(CODE)
    await expect(
      codeMessage(page).getByText('Слишком много проверок. Повторите через 30 с.'),
    ).toBeVisible()
    await expect(checkAction(page)).toHaveAttribute('aria-disabled', 'true')
    state.check = async (_code, route) => route.fulfill({ status: 204 })
    await codeInput(page).fill(OTHER_CODE)
    await page.clock.fastForward(1_000)
    await codeInput(page).press('Enter')
    expect(state.checks).toEqual([CODE])
    await page.clock.fastForward(30_000)
    await expect(page.getByText('43 символа. Скопируйте и вставьте код целиком.')).toBeVisible()
    expect(state.checks).toEqual([CODE])
    await checkAction(page).click()
    await expect(
      page.getByText('Приглашение проверено. Заполните данные для создания аккаунта.', {
        exact: true,
      }),
    ).toBeVisible()
    expect(state.checks).toEqual([CODE, OTHER_CODE])
  })

  test('T15: 429 без корректного Retry-After — 60 с; ожидание переживает перезагрузку', async ({
    page,
  }) => {
    const state = await mockAccess(page)
    state.check = async (_code, route) =>
      json(route, 429, failure('RATE_LIMITED'), { 'Retry-After': 'soon' })
    await page.goto('/register?flow=invite')
    await codeInput(page).fill(CODE)
    await expect(
      codeMessage(page).getByText(/Слишком много проверок\. Повторите через (60|59) с\./),
    ).toBeVisible()
    await page.reload()
    await expect(
      codeMessage(page).getByText(/Слишком много проверок\. Повторите через \d+ с\./),
    ).toBeVisible()
    await codeInput(page).fill(OTHER_CODE)
    await codeInput(page).press('Enter')
    expect(state.checks).toEqual([CODE])
  })

  test('T16: поздний ответ после ухода и смены кода не возвращает прежний шаг', async ({
    page,
  }) => {
    const state = await mockAccess(page)
    const hold = gate()
    state.check = async (_code, route) => {
      await hold.promise
      await route.fulfill({ status: 204 })
    }
    await page.goto('/register?flow=invite')
    await codeInput(page).fill(CODE)
    await expect(codeMessage(page).getByText('Проверяем код приглашения…')).toBeVisible()
    await page.getByRole('link', { name: 'Войти' }).click()
    await expect(page).toHaveURL(/\/login$/)
    hold.open()
    await page.waitForTimeout(100)
    await expect(page).toHaveURL(/\/login$/)
    expect(await storedContext(page)).toBeNull()
    await page.getByRole('link', { name: 'У меня есть приглашение' }).click()
    await expect(codeInput(page)).toHaveValue('')
    await expect(
      page.getByText('Приглашение проверено. Заполните данные для создания аккаунта.', {
        exact: true,
      }),
    ).toHaveCount(0)
  })
})

test.describe('US-M01-01 · ссылки, загрузка и контекст вкладки (T17–T20)', () => {
  for (const prefix of ['/register?code=', '/register?flow=invite&code=']) {
    test(`T17: ${prefix}… — код проверяется один раз, убирается заменой, flow и прочие параметры остаются`, async ({
      page,
    }) => {
      const state = await mockAccess(page)
      await page.goto('/login')
      await page.goto(`${prefix}${CODE}&utm=mail`)
      await expect(
        page.getByText('Приглашение проверено. Заполните данные для создания аккаунта.', {
          exact: true,
        }),
      ).toBeVisible()
      expect(page.url()).not.toContain(CODE)
      expect(new URL(page.url()).searchParams.get('flow')).toBe('invite')
      expect(new URL(page.url()).searchParams.get('utm')).toBe('mail')
      expect(state.checks).toEqual([CODE])
      expect(state.modeRequests).toBe(0)
      await page.goBack()
      await expect(page).toHaveURL(/\/login$/)
      await page.goForward()
      expect(page.url()).not.toContain(CODE)
    })
  }

  test('T17: ссылка важнее сохранённого контекста; пустой и повторённый code — ошибка B2, не A', async ({
    page,
  }) => {
    const state = await mockAccess(page, { mode: 'open' })
    await page.goto('/register?flow=invite')
    await passInvitation(page, OTHER_CODE)
    await page.goto(`/register?code=${CODE}`)
    await expect(
      page.getByText('Приглашение проверено. Заполните данные для создания аккаунта.', {
        exact: true,
      }),
    ).toBeVisible()
    expect(state.checks).toEqual([OTHER_CODE, CODE])
    expect(JSON.parse((await storedContext(page))!)).toMatchObject({ code: CODE })

    await page.goto('/register?code=')
    await expect(codeMessage(page).getByText('Для регистрации нужен код приглашения')).toBeVisible()
    await expect(page).toHaveURL(/\/register\?flow=invite$/)
    await page.goto(`/register?code=${CODE}&code=${OTHER_CODE}`)
    await expect(
      codeMessage(page).getByText('Код состоит из 43 символов: латиница, цифры, «-» и «_»'),
    ).toBeVisible()
    await expect(page.getByLabel('Имя')).toHaveCount(0)
    expect(state.checks).toEqual([OTHER_CODE, CODE])
  })

  test('T18: каркас до загрузки сессии не трогает ссылку и не проверяет код; настоящая страница проверяет один раз', async ({
    page,
  }) => {
    const state = await mockAccess(page)
    const boot = gate()
    await page.route('**/api/v1/auth/me', async (route) => {
      await boot.promise
      await json(route, 401, failure('UNAUTHENTICATED'))
    })
    await page.goto(`/register?flow=invite&code=${CODE}`)
    await expect(page.getByText('Загружаем форму…')).toBeVisible()
    await expect(codeInput(page)).toHaveCount(0)
    expect(page.url()).toContain(CODE)
    expect(state.checks).toEqual([])
    expect(await storedContext(page)).toBeNull()
    boot.open()
    await expect(
      page.getByText('Приглашение проверено. Заполните данные для создания аккаунта.', {
        exact: true,
      }),
    ).toBeVisible()
    expect(page.url()).not.toContain(CODE)
    expect(state.checks).toEqual([CODE])
  })

  test('T19: F5 в B3 — сначала серверная проверка, потом B3; испорченный, будущий или истёкший контекст — B2', async ({
    page,
  }) => {
    const state = await mockAccess(page)
    await page.goto('/register?flow=invite')
    await passInvitation(page)
    const saved = JSON.parse((await storedContext(page))!) as {
      v: number
      code: string
      checkedAt: number
    }
    expect(saved).toEqual({ v: 1, code: CODE, checkedAt: expect.any(Number) })
    const hold = gate()
    state.check = async (_code, route) => {
      await hold.promise
      await route.fulfill({ status: 204 })
    }
    await page.reload()
    await expect(page.getByText('Загружаем форму регистрации…')).toBeVisible()
    await expect(page.getByLabel('Имя')).toHaveCount(0)
    hold.open()
    await expect(
      page.getByText('Приглашение проверено. Заполните данные для создания аккаунта.', {
        exact: true,
      }),
    ).toBeVisible()
    expect(state.checks).toEqual([CODE, CODE])
    // Перепроверка не продлевает срок.
    expect(JSON.parse((await storedContext(page))!)).toEqual(saved)

    for (const raw of [
      '{broken',
      JSON.stringify({ ...saved, checkedAt: Date.now() + 60_000 }),
      JSON.stringify({ ...saved, checkedAt: Date.now() - 31 * 60_000 }),
      JSON.stringify({ ...saved, v: 2 }),
    ]) {
      await page.evaluate(
        ([key, value]) => sessionStorage.setItem(key!, value!),
        [CONTEXT_KEY, raw],
      )
      await page.reload()
      await expect(codeInput(page)).toHaveValue('')
      expect(await storedContext(page)).toBeNull()
    }
    expect(state.checks).toEqual([CODE, CODE])
  })

  test('T20: контекст очищается при A, финальном отказе, успехе и выходе; validated=true бесполезен; данных нет в хранилищах', async ({
    page,
  }) => {
    const state = await mockAccess(page, { mode: 'open' })
    await page.goto('/register?flow=invite&validated=true')
    await expect(codeInput(page)).toBeVisible()
    await expect(page.getByLabel('Имя')).toHaveCount(0)

    await passInvitation(page)
    await page.goto('/register')
    await expect(page.getByLabel('Имя')).toBeEnabled()
    expect(await storedContext(page)).toBeNull()

    await page.goto('/register?flow=invite')
    await passInvitation(page)
    await fillAccount(page)
    await submitButton(page).click()
    await expect(page).toHaveURL(/\/onboarding\/company$/)
    expect(await storedContext(page)).toBeNull()
    const storages = await page.evaluate(() =>
      JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
    )
    for (const secret of [PASSWORD, 'maria@example.test', CODE])
      expect(storages).not.toContain(secret)

    // После выхода: прежнего контекста нет, повторная проверка использованного кода — отказ (AC-B15).
    await page.evaluate(
      ([key, value]) => sessionStorage.setItem(key!, value!),
      [CONTEXT_KEY, JSON.stringify({ v: 1, code: CODE, checkedAt: Date.now() })],
    )
    await page.getByRole('button', { name: 'Выйти' }).click()
    await expect(page).toHaveURL(/\/login/)
    expect(await storedContext(page)).toBeNull()
    state.check = async (_code, route) => json(route, 403, failure('INVITATION_INVALID'))
    await page.getByRole('link', { name: 'У меня есть приглашение' }).click()
    await codeInput(page).fill(CODE)
    await expect(codeMessage(page).getByText('Код приглашения не подошёл')).toBeVisible()
    await expect(page.getByLabel('Имя')).toHaveCount(0)
    expect(state.registers).toHaveLength(1)
  })
})

test.describe('US-M01-01/02 · отправка, отказ и исход (T21–T26)', () => {
  test('T21: «Создаём аккаунт…», поля заблокированы, двойной клик и Enter — один запрос', async ({
    page,
  }) => {
    const state = await mockAccess(page, { mode: 'open' })
    const hold = gate()
    const create = state.register
    state.register = async (body, route) => {
      await hold.promise
      await create(body, route)
    }
    await page.goto('/register')
    await fillAccount(page)
    await submitButton(page).dblclick()
    await page.keyboard.press('Enter')
    const busy = page.locator('button[aria-busy="true"]')
    await expect(busy).toContainText('Создаём аккаунт…')
    await expect(busy).toBeDisabled()
    await expect(page.getByLabel('Имя')).toBeDisabled()
    await expect(page.getByLabel('Имя')).toHaveValue('Мария')
    hold.open()
    await expect(page).toHaveURL(/\/onboarding\/company$/)
    expect(state.registers).toHaveLength(1)
  })

  for (const [flow, response] of [
    ['B', { status: 400, code: 'REGISTRATION_FAILED' }],
    ['A', { status: 409, code: 'EMAIL_ALREADY_REGISTERED' }],
  ] as const) {
    test(`T22 (${flow}, ${response.code}): нейтральный блок над формой, почта не отмечена, данные и приглашение сохранены, один явный повтор`, async ({
      page,
    }) => {
      const state = await mockAccess(page, { mode: 'open' })
      const create = state.register
      state.register = async (body, route) => {
        if (body.email === 'busy@example.test')
          return json(route, response.status, failure(response.code, 'Email already registered'))
        return create(body, route)
      }
      if (flow === 'B') {
        await page.goto('/register?flow=invite')
        await passInvitation(page)
      } else {
        await page.goto('/register')
      }
      await fillAccount(page, { email: 'busy@example.test' })
      await page.getByLabel('Пароль', { exact: true }).press('Enter')
      const block = page.getByTestId('register-feedback')
      await expect(block).toContainText('Не удалось создать аккаунт')
      await expect(block).toContainText('Проверьте данные или попробуйте позже.')
      await expect(block).not.toContainText(/зарегистрирован|используется|e2e-trace|Email/)
      await expect(block).toBeFocused()
      expect((await box(block)).y + (await box(block)).height).toBeLessThan(
        (await box(page.getByLabel('Имя'))).y,
      )
      await expect(page.getByLabel('Электронная почта')).not.toHaveAttribute('aria-invalid', 'true')
      await expect(page.getByLabel('Имя')).toHaveValue('Мария')
      await expect(page.getByLabel('Электронная почта')).toHaveValue('busy@example.test')
      await expect(page.getByLabel('Пароль', { exact: true })).toHaveValue(PASSWORD)
      await expect(page.getByLabel('Пароль', { exact: true })).toHaveAttribute('type', 'password')
      await expect(page).toHaveURL(flow === 'B' ? /\/register\?flow=invite$/ : /\/register$/)
      if (flow === 'B') {
        await expect(
          page.getByText('Приглашение проверено. Заполните данные для создания аккаунта.', {
            exact: true,
          }),
        ).toBeVisible()
        await expect(
          page.getByRole('button', { name: 'Использовать другое приглашение' }),
        ).toBeVisible()
        await expect(codeInput(page)).toHaveCount(0)
      }
      await page.getByLabel('Электронная почта').fill('free@example.test')
      await expect(block).toHaveCount(0)
      await submitButton(page).click()
      await expect(page).toHaveURL(/\/onboarding\/company$/)
      expect(state.registers.map((body) => [body.email, body.inviteCode])).toEqual(
        flow === 'B'
          ? [
              ['busy@example.test', CODE],
              ['free@example.test', CODE],
            ]
          : [
              ['busy@example.test', undefined],
              ['free@example.test', undefined],
            ],
      )
      expect(state.checks).toEqual(flow === 'B' ? [CODE] : [])
    })
  }

  test('T23: окончательный INVITATION_INVALID после проверки — B2 с красным «!» и кодом, без пароля и общего отказа', async ({
    page,
  }) => {
    const state = await mockAccess(page)
    state.register = async (_body, route) => json(route, 403, failure('INVITATION_INVALID'))
    await page.goto('/register?flow=invite')
    await passInvitation(page)
    await fillAccount(page)
    await submitButton(page).click()
    await expect(codeMessage(page).getByText('Код приглашения не подошёл')).toBeVisible()
    await expect(codeInput(page)).toHaveValue(CODE)
    await expect(page.getByTestId('invitation-check-face')).toHaveCSS(
      'background-color',
      'rgb(210, 42, 37)',
    )
    await expect(page.getByLabel('Пароль', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Не удалось создать аккаунт')).toHaveCount(0)
    await expect(
      page.getByText('Приглашение проверено. Заполните данные для создания аккаунта.', {
        exact: true,
      }),
    ).toHaveCount(0)
    expect(await storedContext(page)).toBeNull()
  })

  test('T24: 201 и сбой /auth/me — повтор только загрузки сессии; гость после 201 — не успех', async ({
    page,
  }) => {
    const state = await mockAccess(page, { mode: 'open', meFailures: 1 })
    await page.goto('/register')
    await fillAccount(page)
    await submitButton(page).click()
    await expect(page.getByText('Аккаунт создан')).toBeVisible()
    await expect(submitButton(page)).toBeDisabled()
    await page.getByRole('button', { name: 'Повторить загрузку' }).click()
    await expect(page).toHaveURL(/\/onboarding\/company$/)
    expect(state.registers).toHaveLength(1)

    const guest = await mockAccess(page, { mode: 'open' })
    guest.register = async (_body, route) => json(route, 201, { user: NEW_USER.user })
    await page.goto('/register')
    await fillAccount(page)
    await submitButton(page).click()
    await expect(page.getByText('Аккаунт создан')).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)
  })

  test('T24: ответ регистрации потерян — сверка с /auth/me без второго POST; без сессии — вход или восстановление', async ({
    page,
  }) => {
    const state = await mockAccess(page, { mode: 'open' })
    state.register = async (_body, route) => {
      state.registered = true
      state.me = NEW_USER
      await route.abort('connectionreset')
    }
    await page.goto('/register')
    await fillAccount(page)
    await submitButton(page).click()
    await expect(page).toHaveURL(/\/onboarding\/company$/)
    expect(state.registers).toHaveLength(1)

    const lost = await mockAccess(page, { mode: 'open' })
    lost.register = async (_body, route) => route.abort('connectionreset')
    await page.goto('/register')
    await fillAccount(page)
    await submitButton(page).click()
    const block = page.getByTestId('register-feedback')
    await expect(block).toContainText(
      'Не удалось получить результат регистрации. Попробуйте войти или восстановить пароль.',
    )
    await expect(block.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login')
    await expect(block.getByRole('link', { name: 'Восстановить пароль' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
    await expect(submitButton(page)).toBeDisabled()
    await page.keyboard.press('Enter')
    expect(lost.registers).toHaveLength(1)
  })

  for (const scenario of ['A', 'B'] as const) {
    for (const outcome of ['unknown', 'created', 'pending'] as const) {
      test(`T24 locks: ${scenario}/${outcome}, switch и Back/Forward не разрешают второй POST`, async ({
        page,
      }) => {
        const state = await mockAccess(page, {
          mode: 'open',
          meFailures: outcome === 'created' ? 1 : 0,
        })
        if (outcome === 'unknown')
          state.register = async (_body, route) => route.abort('connectionreset')
        const pending = gate()
        if (outcome === 'pending') {
          const create = state.register
          state.register = async (body, route) => {
            await pending.promise
            await create(body, route)
          }
        }
        await page.goto('/register')
        await page.getByRole('link', { name: 'Использовать код приглашения' }).click()
        if (scenario === 'A') await page.goBack()
        else await passInvitation(page)
        await fillAccount(page)
        await submitButton(page).click()
        const block = page.getByTestId('register-feedback')
        const message =
          outcome === 'created' ? 'Аккаунт создан' : 'Не удалось получить результат регистрации.'
        const assertOutcome = () =>
          outcome === 'pending'
            ? expect(page.locator('button[aria-busy="true"]')).toBeVisible()
            : expect(block).toContainText(message)
        await assertOutcome()
        await expect(page.getByRole('link', { name: 'Использовать код приглашения' })).toHaveCount(
          0,
        )
        await expect(
          page.getByRole('button', { name: 'Использовать другое приглашение' }),
        ).toHaveCount(0)
        const checks = state.checks.length
        if (scenario === 'A') await page.goForward()
        else await page.goBack()
        await assertOutcome()
        await expect(submitButton(page)).toBeDisabled()
        await page.keyboard.press('Enter')
        expect(state.registers).toHaveLength(1)
        expect(state.checks).toHaveLength(checks)
        if (outcome === 'pending') {
          pending.open()
          await expect(page).toHaveURL(/\/onboarding\/company$/)
          expect(state.registers).toHaveLength(1)
        } else if (outcome === 'created') {
          await page.getByRole('button', { name: 'Повторить загрузку' }).click()
          await expect(page).toHaveURL(/\/onboarding\/company$/)
          expect(state.registers).toHaveLength(1)
        } else {
          await expect(block.getByRole('link', { name: 'Войти', exact: true })).toBeVisible()
          await expect(block.getByRole('link', { name: 'Восстановить пароль' })).toBeVisible()
        }
      })
    }
  }

  test('T25: код платформы — шаг компании с именем, «Аккаунт», «Выйти»; код сотрудника — организация владельца', async ({
    page,
  }) => {
    await mockAccess(page)
    await page.goto('/register?flow=invite')
    await passInvitation(page)
    await fillAccount(page)
    await submitButton(page).click()
    await expect(page).toHaveURL(/\/onboarding\/company$/)
    await expect(page.getByRole('navigation', { name: 'Шаги начала работы' })).toContainText(
      'Шаг 1 из 4',
    )
    await expect(page.getByText('Мария', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Аккаунт' })).toBeVisible()
    await page.getByRole('button', { name: 'Выйти' }).click()
    await expect(page).toHaveURL(/\/login/)

    await page.getByRole('link', { name: 'У меня есть приглашение' }).click()
    await passInvitation(page, EMPLOYEE_CODE)
    await fillAccount(page, { email: 'manager@example.test' })
    await submitButton(page).click()
    await expect(page).toHaveURL(/\/radar/)
    await expect(page.getByRole('heading', { name: 'Расскажите о компании' })).toHaveCount(0)
  })

  test('T25/G07: имя из 200 букв и действия шапки видимы без переполнения на 320/390/834/1440', async ({
    page,
  }, info) => {
    const state = await mockAccess(page)
    const name = 'Я'.repeat(200)
    state.register = async (body, route) => {
      state.registered = true
      state.me = { ...NEW_USER, user: { ...NEW_USER.user, displayName: body.displayName } }
      return json(route, 201, { user: state.me.user })
    }
    await page.goto('/register')
    await fillAccount(page, { name })
    await submitButton(page).click()
    await expect(page).toHaveURL(/\/onboarding\/company$/)
    for (const width of [320, 390, 834, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      const displayName = page.getByTestId('account-display-name')
      await expect(displayName).toHaveText(name)
      await expect(displayName).toBeVisible()
      await expect(page.getByRole('link', { name: 'Аккаунт', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      const bounds = await box(displayName)
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
      expect(bounds.y).toBeGreaterThanOrEqual(0)
      const header = await box(page.locator('header'))
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(header.y + header.height)
      await captureRunEvidence(page, info, `header-${width}.png`)
    }
  })

  test('T26: после успеха интерфейс не запрашивает отправку письма и не ждёт её', async ({
    page,
  }) => {
    const state = await mockAccess(page, { mode: 'open' })
    await page.goto('/register')
    await fillAccount(page)
    await submitButton(page).click()
    await expect(page).toHaveURL(/\/onboarding\/company$/)
    expect(state.api.filter((call) => call.includes('/auth/email/'))).toEqual([])
  })
})

test.describe('US-M01-01 · адаптивы, клавиатура и нижняя строка (T27, T28)', () => {
  const widths = [
    [1440, 1000],
    [1024, 768],
    [834, 1194],
    [600, 900],
    [390, 844],
    [375, 812],
  ] as const

  for (const [width, height] of widths) {
    test(`T27: матрица A/B2/B3/C без горизонтального переполнения (${width}×${height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height })
      const state = await mockAccess(page, { mode: 'open' })
      const noOverflow = async (label: string) => {
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, label).toBeLessThanOrEqual(0)
      }
      await page.goto('/login')
      await noOverflow('вход')
      await page.goto('/register')
      await fillAccount(page, { email: 'maria.example.test' })
      await submitButton(page).click()
      await expect(page.getByText('Введите корректный адрес электронной почты.')).toBeVisible()
      await noOverflow('A ошибка почты')
      state.register = async (_body, route) => json(route, 400, failure('REGISTRATION_FAILED'))
      await page.getByLabel('Электронная почта').fill('maria@example.test')
      await submitButton(page).click()
      await expect(page.getByTestId('register-feedback')).toBeVisible()
      await noOverflow('A общий отказ')
      await page.goto('/register?flow=invite')
      await codeInput(page).fill('LDR-2026')
      await checkAction(page).click()
      await noOverflow('B2 формат')
      await codeInput(page).fill(REJECTED_CODES.использованный)
      await expect(codeMessage(page).getByText('Код приглашения не подошёл')).toBeVisible()
      await noOverflow('B2 403')
      // Длинный код остаётся одной строкой внутри поля.
      const input = await box(codeInput(page))
      expect(input.height).toBe(46)
      await passInvitation(page)
      await noOverflow('B3')
      state.mode = 'invite_only'
      await page.goto('/register')
      await expect(page.getByText('Регистрация закрыта')).toBeVisible()
      await noOverflow('C')
      for (const field of await page.locator('form input').all()) {
        expect((await box(field)).height).toBe(46)
      }
    })
  }

  test('T27: клавиатура и доступность B2/B3/A/C; занятость не меняет размеры', async ({ page }) => {
    const state = await mockAccess(page, { mode: 'open' })
    const hold = gate()
    state.check = async (_code, route) => {
      await hold.promise
      await route.fulfill({ status: 204 })
    }
    await page.goto('/register?flow=invite')
    const axe = () => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect((await axe()).violations).toEqual([])
    await codeInput(page).focus()
    await page.keyboard.press('Tab')
    await expect(checkAction(page)).toBeFocused()
    expect(await checkAction(page).evaluate((el) => el.matches(':focus-visible'))).toBe(true)
    await codeInput(page).focus()
    const card = page.locator('.rounded-card').filter({ has: heading(page) })
    const idle = await box(card)
    await page.keyboard.type(CODE)
    await page.keyboard.press('Enter')
    await expect(codeMessage(page).getByText('Проверяем код приглашения…')).toBeVisible()
    expect((await box(card)).height).toBe(idle.height)
    hold.open()
    await expect(page.getByLabel('Имя')).toBeFocused()
    expect((await axe()).violations).toEqual([])

    const slow = gate()
    const create = state.register
    state.register = async (body, route) => {
      await slow.promise
      await create(body, route)
    }
    await page.keyboard.type('Мария')
    await page.keyboard.press('Tab')
    await page.keyboard.type('maria@example.test')
    await page.keyboard.press('Tab')
    await page.keyboard.type(PASSWORD)
    const button = await box(submitButton(page))
    await page.keyboard.press('Enter')
    await expect(page.locator('button[aria-busy="true"]')).toBeVisible()
    const busy = await box(page.locator('button[aria-busy="true"]'))
    expect([busy.width, busy.height]).toEqual([button.width, button.height])
    slow.open()
    await expect(page).toHaveURL(/\/onboarding\/company$/)

    for (const mode of ['open', 'invite_only'] as const) {
      const guest = await mockAccess(page, { mode })
      expect(guest.registers).toEqual([])
      await page.goto('/register')
      await expect(page.getByLabel('Имя')).toBeVisible()
      expect((await axe()).violations).toEqual([])
    }
  })

  test('T28: desktop — правовые ссылки в нижней строке с подписью продукта: 64 px от края, 24 px между ссылками, на всех экранах доступа', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const state = await mockAccess(page, { mode: 'open' })
    await page.route('**/api/v1/auth/email/verify', (route) =>
      json(route, 400, failure('VERIFICATION_TOKEN_INVALID')),
    )
    const pages = [
      ['/login', () => page.getByRole('heading', { name: 'Вход в LidRadar' })],
      ['/register', () => page.getByLabel('Имя')],
      ['/register?flow=invite', () => codeInput(page)],
      ['/forgot-password', () => page.getByLabel('Электронная почта')],
      ['/reset-password', () => page.getByText('Ссылка недействительна')],
      [`/reset-password#token=${'T'.repeat(43)}`, () => page.getByLabel('Новый пароль')],
      [`/verify-email#token=${'T'.repeat(43)}`, () => page.getByText('Ссылка недействительна')],
      ['/register (C)', () => page.getByText('Регистрация закрыта')],
    ] as const
    for (const [path, ready] of pages) {
      if (path === '/register (C)') {
        state.mode = 'invite_only'
      }
      // Каждый кадр — новый document, включая hash-only reset. Промежуточный
      // /login запускал второй bootstrap до завершения lazy imports первого;
      // neutral document размонтирует предыдущий кадр без лишнего app bootstrap.
      await page.goto('about:blank')
      await page.goto(path === '/register (C)' ? '/register' : path)
      await expect(ready()).toBeVisible()
      const product = await box(page.getByTestId('auth-product-line'))
      const links = page.getByTestId('auth-legal').getByRole('link')
      await expect(links).toHaveText(['Пользовательское соглашение', 'Политика конфиденциальности'])
      const [terms, privacy] = [await box(links.nth(0)), await box(links.nth(1))]
      expect(Math.round(product.x), path).toBe(64)
      expect(Math.round(1440 - (privacy.x + privacy.width)), path).toBe(64)
      expect(Math.round(privacy.x - (terms.x + terms.width)), path).toBe(24)
      for (const link of [terms, privacy]) {
        expect(Math.abs(link.y - product.y), path).toBeLessThanOrEqual(1)
        expect(link.height, path).toBe(product.height)
      }
      expect(Math.round(product.y), path).toBe(934)
      for (const link of await links.all()) {
        await expect(link).toHaveAttribute('target', '_blank')
        await expect(link).toHaveAttribute('rel', 'noopener')
      }
    }
  })

  test('T28: планшет и телефон — правовые ссылки под формой, без перекрытия', async ({ page }) => {
    await mockAccess(page, { mode: 'open' })
    for (const [width, height] of [
      [834, 1194],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await page.goto('/register?flow=invite')
      const card = await box(page.locator('.rounded-card').filter({ has: heading(page) }))
      const legal = await box(page.getByTestId('auth-legal'))
      expect(legal.y).toBeGreaterThanOrEqual(card.y + card.height + 24 - 1)
      for (const link of await page.getByTestId('auth-legal').getByRole('link').all()) {
        expect((await box(link)).height).toBe(46)
      }
    }
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
    }, info) => {
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
      await captureRunEvidence(page, info, `reset-long-email-${width}.png`)
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
