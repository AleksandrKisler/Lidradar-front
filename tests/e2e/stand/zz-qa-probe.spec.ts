/**
 * ВРЕМЕННЫЙ адверсариальный прогон на реальном API (не часть регулярного набора).
 * Создаёт отдельную тестовую организацию с «опасными» данными, менеджера по
 * приглашению и проверяет изоляцию, валидацию, идемпотентность, лимитер входа,
 * формы, клавиатуру, офлайн и доступность с реальными данными. Команды над
 * рисками выполняются только в учебном профиле `large`.
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import {
  expect,
  request,
  test,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { requireStand } from './support'

test.describe.configure({ mode: 'serial' })
test.use({ trace: 'off', video: 'off', screenshot: 'off' })

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa']
const STATE_FILE = process.env.QA_STATE_FILE ?? '/tmp/lidradar-qa-state.json'
const NOTES_FILE = process.env.QA_NOTES_FILE ?? '/tmp/lidradar-qa-notes.md'
const notes: string[] = []
function note(text: string): void {
  notes.push(text)
  console.log(`QA-NOTE: ${text}`)
}
function finding(text: string): void {
  notes.push(`FINDING: ${text}`)
  console.log(`QA-FINDING: ${text}`)
}

interface State {
  password: string
  ownerEmail: string
  managerEmail: string
  bruteEmail: string
  run: number
}
function loadState(): State {
  if (existsSync(STATE_FILE)) {
    const saved = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as State
    saved.run += 1
    writeFileSync(STATE_FILE, JSON.stringify(saved))
    return saved
  }
  const fresh: State = {
    password: randomBytes(18).toString('base64url'),
    ownerEmail: 'qa-owner@lidradar.test',
    managerEmail: 'qa-manager@lidradar.test',
    bruteEmail: 'qa-brute@lidradar.test',
    run: 1,
  }
  writeFileSync(STATE_FILE, JSON.stringify(fresh))
  chmodSync(STATE_FILE, 0o600)
  return fresh
}

const XSS_IMG = '<img src=x onerror="window.__xss=1">'
const XSS_SCRIPT = '<script>window.__xss=2</script>'
const LONG_WORD = 'Ж'.repeat(120)
const RTL_ZW = 'Тест ‮обратный‬ и нулевой​​ширины 🚗🧽 «кавычки» & <>'

let baseURL = ''
let state: State
let ownerApi: APIRequestContext
let managerApi: APIRequestContext
let largeApi: APIRequestContext
let guestApi: APIRequestContext
let ownerId = ''
let managerId = ''
let tenantA = ''
let tenantB = ''
let tenantLarge = ''
let locationA = ''
let connectionA = ''
let webhookSecret = ''
let serviceOk = ''
let invitationCode = ''
let largeRisks: LargeRisk[] = []
let foreignRiskId = ''
let foreignConversationId = ''
let conversationA = ''

interface LargeRisk {
  risk: { id: string; opportunityId: string | null; status: string; severity: string; type: string }
  opportunity: { id: string; stage: string } | null
  conversation: { id: string } | null
}

const tenant = (id: string) => ({ 'X-Tenant-ID': id })
async function json<T = unknown>(response: APIResponse): Promise<T> {
  return (await response.json()) as T
}
async function errorCode(response: APIResponse): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: { code?: string } }
  return body.error?.code ?? '(нет кода)'
}

async function registerAndLogin(email: string, displayName: string): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL })
  const registered = await ctx.post('/api/v1/auth/register', {
    data: { email, password: state.password, displayName },
  })
  if (![201, 409].includes(registered.status())) {
    throw new Error(`регистрация ${email}: ${registered.status()} ${await registered.text()}`)
  }
  if (registered.status() === 409) note(`${email} уже существует — повторный запуск, вход по сохранённому паролю`)
  const login = await ctx.post('/api/v1/auth/login', { data: { email, password: state.password } })
  if (login.status() !== 200) {
    throw new Error(`вход ${email}: ${login.status()} — вероятно, лимит попыток; повторите через 15 минут`)
  }
  return ctx
}

async function browserFor(browser: Browser, api: APIRequestContext, init?: { userId: string; tenantId: string }): Promise<BrowserContext> {
  const stateDump = await api.storageState()
  const context = await browser.newContext({ storageState: stateDump, viewport: { width: 1440, height: 900 } })
  if (init) {
    await context.addInitScript(
      ([key, value]) => {
        try {
          window.localStorage.setItem(key, value)
        } catch {
          /* приватный режим */
        }
      },
      [`lidradar.tenant.${init.userId}`, init.tenantId] as const,
    )
  }
  return context
}

async function noPageScroll(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }))
  expect.soft(overflow.scrollWidth, `горизонтальная прокрутка страницы: ${label}`).toBeLessThanOrEqual(overflow.inner + 1)
}

async function axeCheck(page: Page, label: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  if (violations.length) {
    for (const violation of violations) {
      finding(
        `axe ${label}: ${violation.id} (${violation.impact}) — ${violation.nodes.length} узл.; пример: ${violation.nodes[0]?.target.join(' ')} — ${violation.nodes[0]?.failureSummary?.split('\n')[1] ?? ''}`,
      )
    }
  }
  expect.soft(violations, `axe ${label}`).toEqual([])
}

function webhookEvent(data: Record<string, unknown>, type = 'message.received.v1', id = randomUUID()) {
  return { id, type, occurredAt: new Date().toISOString(), data: { attachments: [], metadata: {}, ...data } }
}

async function postWebhook(body: unknown, secret = webhookSecret, connection = connectionA, tenantId = tenantA) {
  return ownerApi.post(`/api/v1/webhooks/GENERIC_WEBHOOK/${tenantId}/${connection}`, {
    headers: { 'X-LidRadar-Webhook-Secret': secret, 'Content-Type': 'application/json' },
    data: body,
  })
}

test.beforeAll(async () => {
  requireStand()
  baseURL = process.env.E2E_BASE_URL!
  state = loadState()
  guestApi = await request.newContext({ baseURL })

  ownerApi = await registerAndLogin(state.ownerEmail, `QA Владелец ${XSS_IMG}`)
  const me = await json<{ user: { id: string }; memberships: { tenantId: string; organizationName: string }[] }>(
    await ownerApi.get('/api/v1/auth/me'),
  )
  ownerId = me.user.id
  note(`владелец ${state.ownerEmail}: членств до запуска ${me.memberships.length}`)

  const orgA = await ownerApi.post('/api/v1/organizations', {
    data: { name: `QA ${XSS_SCRIPT} «Блик» #${state.run}`, defaultTimezone: 'Europe/Moscow', defaultCurrency: 'RUB' },
  })
  expect(orgA.status(), 'создание организации A').toBe(201)
  tenantA = (await json<{ id: string }>(orgA)).id
  const orgB = await ownerApi.post('/api/v1/organizations', {
    data: { name: `${LONG_WORD} ${RTL_ZW} #${state.run}`, defaultTimezone: 'Asia/Vladivostok', defaultCurrency: 'KZT' },
  })
  expect(orgB.status(), 'создание организации B').toBe(201)
  tenantB = (await json<{ id: string }>(orgB)).id

  const location = await ownerApi.post('/api/v1/locations', {
    headers: tenant(tenantA),
    data: { name: `Точка ${XSS_IMG} ${RTL_ZW}`, timezone: 'Asia/Vladivostok', responseThresholdMinutes: 1 },
  })
  expect(location.status(), 'создание точки').toBe(201)
  locationA = (await json<{ id: string }>(location)).id
  const hours = await ownerApi.put(`/api/v1/locations/${locationA}/business-hours`, {
    headers: tenant(tenantA),
    data: {
      timezone: 'Asia/Vladivostok',
      days: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, closed: false, opensAt: '09:00', closesAt: '21:00' })).concat([{ weekday: 7, closed: true }] as never),
    },
  })
  expect(hours.status(), 'график').toBe(200)

  const service = await ownerApi.post('/api/v1/services', {
    headers: tenant(tenantA),
    data: { name: `Полировка ${XSS_IMG}`, locationId: locationA, priceFrom: '1000.50', priceTo: '2500', currency: 'RUB' },
  })
  expect(service.status(), 'услуга').toBe(201)
  serviceOk = (await json<{ id: string }>(service)).id

  webhookSecret = randomBytes(24).toString('base64url')
  const connect = await ownerApi.post('/api/v1/integrations/GENERIC_WEBHOOK/connect', {
    headers: tenant(tenantA),
    data: { name: `Форма сайта <b>qa</b>`, locationId: locationA, webhookSecret },
  })
  expect(connect.status(), 'подключение GENERIC_WEBHOOK').toBe(201)
  const connected = await json<{ id: string; webhookSecret: string | null }>(connect)
  connectionA = connected.id
  note(`connect вернул webhookSecret: ${connected.webhookSecret ? 'да (показ один раз)' : 'null'}`)

  const contact = `Ирина ${XSS_IMG}`
  const events = [
    webhookEvent({ conversationExternalId: 'qa-conv-1', messageExternalId: 'qa-m1', contactExternalId: 'qa-c1', contactDisplayName: contact, direction: 'INCOMING', messageType: 'TEXT', text: `Здравствуйте! ${XSS_SCRIPT} Сколько стоит полировка?`, sentAt: new Date(Date.now() - 3_600_000).toISOString() }),
    webhookEvent({ conversationExternalId: 'qa-conv-1', messageExternalId: 'qa-m2', contactExternalId: 'qa-c1', contactDisplayName: contact, direction: 'OUTGOING', messageType: 'TEXT', text: 'Полный комплекс — 31 000 ₽.', sentAt: new Date(Date.now() - 3_500_000).toISOString() }),
    webhookEvent({ conversationExternalId: 'qa-conv-1', messageExternalId: 'qa-m3', contactExternalId: 'qa-c1', contactDisplayName: contact, direction: 'INCOMING', messageType: 'TEXT', text: 'Д'.repeat(3000), sentAt: new Date(Date.now() - 3_400_000).toISOString() }),
    webhookEvent({ conversationExternalId: 'qa-conv-2', messageExternalId: 'qa-m4', contactExternalId: 'qa-c2', contactDisplayName: RTL_ZW, direction: 'INCOMING', messageType: 'TEXT', text: RTL_ZW, sentAt: new Date(Date.now() - 1_800_000).toISOString() }),
  ]
  for (const event of events) {
    const accepted = await postWebhook(event)
    expect(accepted.status(), `webhook ${String((event.data as { messageExternalId: string }).messageExternalId)}`).toBe(202)
  }
  // Удаление и правка сообщений: подписи должны быть честными.
  expect((await postWebhook(webhookEvent({ conversationExternalId: 'qa-conv-1', messageExternalId: 'qa-m3', contactExternalId: 'qa-c1' }, 'message.deleted.v1'))).status()).toBe(202)

  const deadline = Date.now() + 25_000
  while (Date.now() < deadline) {
    const list = await json<{ items: { conversation: { id: string; externalId: string } }[] }>(
      await ownerApi.get('/api/v1/conversations?limit=10', { headers: tenant(tenantA) }),
    )
    if (list.items.length >= 2) {
      conversationA = list.items.find((item) => item.conversation.externalId === 'qa-conv-1')?.conversation.id ?? list.items[0]!.conversation.id
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  if (!conversationA) finding('переписки из вебхуков не появились за 25 с — обработчик заданий не работает или события отклонены')

  const invitation = await ownerApi.post('/api/v1/organization/invitations', {
    headers: tenant(tenantA),
    data: { role: 'MANAGER', note: `<b>qa</b> ${RTL_ZW}` },
  })
  expect(invitation.status(), 'приглашение').toBe(201)
  invitationCode = (await json<{ code: string }>(invitation)).code

  managerApi = await registerAndLogin(state.managerEmail, `QA Менеджер ${RTL_ZW}`)
  managerId = (await json<{ user: { id: string } }>(await managerApi.get('/api/v1/auth/me'))).user.id
  const accepted = await managerApi.post('/api/v1/invitations/accept', { data: { code: invitationCode } })
  expect(accepted.status(), 'принятие приглашения').toBe(200)
  expect((await json<{ membership: { tenantId: string } }>(accepted)).membership.tenantId).toBe(tenantA)

  // Учебный профиль large — единственное место для команд над рисками.
  largeApi = await request.newContext({ baseURL })
  const password = readFileSync(process.env.LIDRADAR_STAND_PASSWORD_FILE!, 'utf8').trim()
  const largeLogin = await largeApi.post('/api/v1/auth/login', { data: { email: 'large@lidradar.test', password } })
  expect(largeLogin.status(), 'вход large').toBe(200)
  const largeMe = await json<{ memberships: { tenantId: string }[] }>(await largeApi.get('/api/v1/auth/me'))
  tenantLarge = largeMe.memberships[0]!.tenantId
  largeRisks = (await json<{ items: LargeRisk[] }>(await largeApi.get('/api/v1/risks?active=true&limit=60', { headers: tenant(tenantLarge) }))).items
  foreignRiskId = largeRisks[0]!.risk.id
  foreignConversationId = largeRisks.find((item) => item.conversation)?.conversation?.id ?? ''
  note(`large: активных рисков в первой странице ${largeRisks.length}; NEW-сделок ${largeRisks.filter((item) => item.opportunity?.stage === 'NEW').length}`)
})

test.afterAll(async () => {
  writeFileSync(NOTES_FILE, notes.map((line) => `- ${line}`).join('\n') + '\n')
})

test('API: cookie, заголовки безопасности и проверка Origin', async () => {
  const login = await guestApi.post('/api/v1/auth/login', { data: { email: state.managerEmail, password: 'wrong-password-value' } })
  const headers = login.headersArray().map((h) => `${h.name.toLowerCase()}: ${h.value}`)
  note(`заголовки ответа API: ${headers.filter((h) => /^(x-|content-security|strict|cache|referrer)/.test(h)).join(' | ') || 'нет заголовков безопасности'}`)
  expect.soft(headers.some((h) => h.startsWith('x-content-type-options: nosniff')), 'X-Content-Type-Options').toBe(true)
  const setCookie = (await ownerApi.storageState()).cookies.find((c) => c.name === 'lidradar_session')
  expect(setCookie, 'cookie сессии').toBeTruthy()
  expect.soft(setCookie!.httpOnly, 'HttpOnly').toBe(true)
  expect.soft(['Lax', 'Strict']).toContain(setCookie!.sameSite)
  note(`cookie: httpOnly=${setCookie!.httpOnly} sameSite=${setCookie!.sameSite} secure=${setCookie!.secure} (dev: LIDRADAR_COOKIE_SECURE=false)`)

  const evil = await guestApi.post('/api/v1/auth/login', {
    headers: { Origin: 'https://evil.example' },
    data: { email: state.managerEmail, password: 'wrong-password-value' },
  })
  note(`POST с Origin evil.example → ${evil.status()} ${await errorCode(evil)}`)
  expect.soft(evil.status(), 'чужой Origin отклоняется').toBe(403)
  const wrongType = await guestApi.post('/api/v1/auth/login', {
    headers: { 'Content-Type': 'text/plain' },
    data: JSON.stringify({ email: state.managerEmail, password: 'wrong-password-value' }),
  })
  note(`POST /auth/login с text/plain → ${wrongType.status()} ${await errorCode(wrongType)}`)
  expect.soft([400, 415]).toContain(wrongType.status())
})

test('API: отрицательные сценарии входа и регистрации', async () => {
  const wrong = await guestApi.post('/api/v1/auth/login', { data: { email: state.managerEmail, password: 'definitely-wrong-password' } })
  const unknown = await guestApi.post('/api/v1/auth/login', { data: { email: `nobody-${Date.now()}@lidradar.test`, password: 'definitely-wrong-password' } })
  expect(wrong.status()).toBe(401)
  expect(unknown.status()).toBe(401)
  const strip = (text: string) => text.replace(/"traceId":"[^"]+"/, '')
  expect.soft(strip(await wrong.text()), 'тело 401 одинаково для чужого и неверного').toBe(strip(await unknown.text()))
  const malformed = await guestApi.post('/api/v1/auth/login', { data: { email: 'not-an-email', password: 'x' } })
  expect.soft(malformed.status()).toBe(400)
  const shortPassword = await guestApi.post('/api/v1/auth/register', { data: { email: `short-${Date.now()}@lidradar.test`, password: 'short', displayName: 'X' } })
  expect.soft(shortPassword.status(), 'пароль короче 12').toBe(400)
  const noCookie = await guestApi.get('/api/v1/auth/me')
  expect(noCookie.status()).toBe(401)
  const refresh = await guestApi.post('/api/v1/auth/refresh')
  expect.soft([401, 403]).toContain(refresh.status())
  // Выход и повторное чтение сессии — отдельным контекстом, чтобы не терять сессию менеджера.
  const throwaway = await request.newContext({ baseURL })
  expect((await throwaway.post('/api/v1/auth/login', { data: { email: state.managerEmail, password: state.password } })).status()).toBe(200)
  expect((await throwaway.get('/api/v1/auth/me')).status()).toBe(200)
  const logout = await throwaway.post('/api/v1/auth/logout')
  expect([200, 204]).toContain(logout.status())
  expect((await throwaway.get('/api/v1/auth/me')).status(), 'после выхода сессии нет').toBe(401)
  await throwaway.dispose()
})

test('API: изоляция организаций и права ролей', async () => {
  expect((await ownerApi.get('/api/v1/radar', { headers: tenant(tenantLarge) })).status(), 'чужая организация').toBe(403)
  expect((await ownerApi.get('/api/v1/radar', { headers: tenant('not-a-uuid') })).status()).toBe(400)
  const missing = await ownerApi.get('/api/v1/radar')
  expect.soft([400, 401, 403]).toContain(missing.status())
  note(`GET /radar без X-Tenant-ID → ${missing.status()} ${await errorCode(missing)}`)
  expect((await ownerApi.get(`/api/v1/risks/${foreignRiskId}`, { headers: tenant(tenantA) })).status(), 'чужой риск в своей организации').toBe(404)
  if (foreignConversationId) {
    expect((await ownerApi.get(`/api/v1/conversations/${foreignConversationId}`, { headers: tenant(tenantA) })).status()).toBe(404)
    expect((await ownerApi.get(`/api/v1/conversations/${foreignConversationId}/messages`, { headers: tenant(tenantA) })).status()).toBe(404)
  }
  expect((await ownerApi.post(`/api/v1/risks/${foreignRiskId}/acknowledge`, { headers: tenant(tenantA) })).status()).toBe(404)
  expect((await ownerApi.get('/api/v1/radar', { headers: tenant(tenantB) })).status(), 'вторая своя организация').toBe(200)

  const forbidden: [string, string][] = [
    ['GET', '/api/v1/services'],
    ['GET', '/api/v1/organization/members'],
    ['GET', '/api/v1/organization/invitations'],
    ['GET', '/api/v1/analytics/summary'],
    ['GET', '/api/v1/integrations'],
    ['GET', '/api/v1/locations'],
    ['GET', '/api/v1/revenue/confirmed-recovered'],
  ]
  for (const [method, path] of forbidden) {
    const response = await managerApi.fetch(path, { method, headers: tenant(tenantA) })
    expect.soft(response.status(), `менеджер ${method} ${path}`).toBe(403)
  }
  expect.soft((await managerApi.post('/api/v1/organization/ml-consent', { headers: tenant(tenantA) })).status(), 'менеджер согласие').toBe(403)
  expect.soft((await managerApi.patch('/api/v1/organization', { headers: tenant(tenantA), data: { name: 'x' } })).status()).toBe(403)
  expect.soft((await managerApi.post('/api/v1/services', { headers: tenant(tenantA), data: { name: 'x' } })).status()).toBe(403)
  expect.soft((await managerApi.get('/api/v1/organization/ml-consent', { headers: tenant(tenantA) })).status(), 'менеджер читает статус согласия').toBe(200)
  expect((await managerApi.get('/api/v1/radar', { headers: tenant(tenantA) })).status()).toBe(200)
  expect((await managerApi.get('/api/v1/conversations', { headers: tenant(tenantA) })).status()).toBe(200)
  expect((await managerApi.get('/api/v1/notifications/preferences', { headers: tenant(tenantA) })).status()).toBe(200)
  expect((await managerApi.get('/api/v1/radar', { headers: tenant(tenantB) })).status(), 'менеджер не состоит в B').toBe(403)
  expect((await managerApi.get('/api/v1/admin/me')).status(), 'менеджер не администратор').toBe(403)
  expect((await ownerApi.get('/api/v1/admin/me')).status(), 'владелец не администратор').toBe(403)
  expect((await ownerApi.get('/api/v1/admin/organizations')).status()).toBe(403)
  const machine = await ownerApi.post('/internal/v1/ai/nodes/heartbeat', { data: {} })
  note(`браузерная сессия на /internal → ${machine.status()}`)
  expect.soft([401, 403, 404]).toContain(machine.status())
})

test('API: валидация граничных значений', async () => {
  const h = tenant(tenantA)
  const cases: [string, Record<string, unknown>, number[]][] = [
    ['цена от больше цены до', { name: 'Диапазон наоборот', priceFrom: '2000', priceTo: '1000', currency: 'RUB' }, [400]],
    ['цена не число', { name: 'Буквы', priceFrom: 'abc', currency: 'RUB' }, [400]],
    ['13 цифр', { name: 'Слишком много', priceFrom: '1234567890123', currency: 'RUB' }, [400]],
    ['три знака после запятой', { name: 'Дробь', priceFrom: '10.123', currency: 'RUB' }, [400]],
    ['имя 201 символ', { name: 'Ж'.repeat(201), currency: 'RUB' }, [400]],
    ['пустое имя', { name: '   ', currency: 'RUB' }, [400]],
    ['валюта строчными', { name: 'Валюта строчными', priceFrom: '10', currency: 'rub' }, [201, 400]],
    ['чужая точка', { name: 'Чужая точка', locationId: randomUUID(), currency: 'RUB' }, [400, 404]],
    ['имя 200 символов', { name: 'Ж'.repeat(200), currency: 'RUB' }, [201]],
    ['только нижняя граница', { name: 'От 0.01', priceFrom: '0.01', currency: 'RUB' }, [201]],
    ['неизвестное поле', { name: 'Лишнее поле', currency: 'RUB', unexpected: true }, [201, 400]],
  ]
  for (const [label, body, accepted] of cases) {
    const response = await ownerApi.post('/api/v1/services', { headers: h, data: body })
    note(`услуга «${label}» → ${response.status()} ${response.status() >= 400 ? await errorCode(response) : ''}`)
    expect.soft(accepted, `услуга: ${label}`).toContain(response.status())
  }
  const huge = await ownerApi.post('/api/v1/services', { headers: h, data: { name: 'A'.repeat(300_000), currency: 'RUB' } })
  note(`услуга с именем 300 КБ → ${huge.status()} ${await errorCode(huge)}`)
  expect.soft([400, 413]).toContain(huge.status())
  expect((await ownerApi.patch(`/api/v1/services/${randomUUID()}`, { headers: h, data: { active: false } })).status()).toBe(404)
  expect((await ownerApi.patch(`/api/v1/services/not-a-uuid`, { headers: h, data: { active: false } })).status()).toBe(400)

  for (const [label, body, accepted] of [
    ['порог 0', { name: 'П0', timezone: 'Europe/Moscow', responseThresholdMinutes: 0 }, [400]],
    ['порог 1441', { name: 'П1441', timezone: 'Europe/Moscow', responseThresholdMinutes: 1441 }, [400]],
    ['неизвестный часовой пояс', { name: 'TZ', timezone: 'Mars/Olympus' }, [400]],
  ] as [string, Record<string, unknown>, number[]][]) {
    const response = await ownerApi.post('/api/v1/locations', { headers: h, data: body })
    note(`точка «${label}» → ${response.status()} ${await errorCode(response)}`)
    expect.soft(accepted, `точка: ${label}`).toContain(response.status())
  }
  const overnight = await ownerApi.put(`/api/v1/locations/${locationA}/business-hours`, {
    headers: h,
    data: { timezone: 'Asia/Vladivostok', days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, closed: false, opensAt: '22:00', closesAt: '06:00' })) },
  })
  note(`график через полночь (22:00–06:00) → ${overnight.status()} ${overnight.status() >= 400 ? await errorCode(overnight) : ''}`)
  const badDay = await ownerApi.put(`/api/v1/locations/${locationA}/business-hours`, {
    headers: h,
    data: { timezone: 'Asia/Vladivostok', days: [{ weekday: 8, closed: true }] },
  })
  expect.soft(badDay.status(), 'день недели 8').toBe(400)
  // Восстановить корректный график.
  expect((await ownerApi.put(`/api/v1/locations/${locationA}/business-hours`, {
    headers: h,
    data: { timezone: 'Asia/Vladivostok', days: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, closed: false, opensAt: '09:00', closesAt: '21:00' })).concat([{ weekday: 7, closed: true }] as never) },
  })).status()).toBe(200)

  const badPreference = await ownerApi.put('/api/v1/notifications/preferences/NO_RESPONSE', {
    headers: h,
    data: { minimumSeverity: 'HIGH', deliveryMode: 'IMMEDIATE', inAppEnabled: true, telegramEnabled: false, quietHoursEnabled: true, quietHoursStart: '25:00', quietHoursEnd: '07:00', digestTime: '09:00' },
  })
  expect.soft(badPreference.status(), 'тихие часы 25:00').toBe(400)
  const unknownType = await ownerApi.put('/api/v1/notifications/preferences/UNKNOWN_TYPE', {
    headers: h,
    data: { minimumSeverity: 'HIGH', deliveryMode: 'IMMEDIATE', inAppEnabled: true, telegramEnabled: false, quietHoursEnabled: false, quietHoursStart: null, quietHoursEnd: null, digestTime: '09:00' },
  })
  expect.soft([400, 404]).toContain(unknownType.status())
  const list = await ownerApi.get('/api/v1/conversations?search=' + encodeURIComponent('x'.repeat(101)), { headers: h })
  note(`поиск 101 символ → ${list.status()} ${list.status() >= 400 ? await errorCode(list) : ''}`)
  expect.soft(list.status()).toBe(400)
  const injection = await ownerApi.get('/api/v1/conversations?search=' + encodeURIComponent(`%_'" OR 1=1 --`), { headers: h })
  expect(injection.status(), 'поиск со спецсимволами').toBe(200)
  const limit = await ownerApi.get('/api/v1/risks?limit=100000', { headers: h })
  note(`GET /risks?limit=100000 → ${limit.status()}`)
  expect.soft([200, 400]).toContain(limit.status())
  const badSeverity = await ownerApi.get('/api/v1/risks?severity=BOGUS', { headers: h })
  note(`GET /risks?severity=BOGUS → ${badSeverity.status()} ${await errorCode(badSeverity)}`)
  const badRange = await ownerApi.get('/api/v1/analytics/summary?from=2026-13-40&to=zzz', { headers: h })
  expect.soft(badRange.status(), 'аналитика с мусорными датами').toBe(400)
  const reversed = await ownerApi.get('/api/v1/analytics/summary?from=2026-09-20&to=2026-09-01', { headers: h })
  note(`аналитика from>to → ${reversed.status()} ${await errorCode(reversed)}`)
  const cursor = await ownerApi.get('/api/v1/risks?cursor=' + encodeURIComponent('AAAA!!!not-a-cursor'), { headers: h })
  note(`мусорный cursor → ${cursor.status()} ${await errorCode(cursor)}`)
  expect.soft([400]).toContain(cursor.status())
})

test('API: вебхуки — секрет, размер, дубли, неизвестное подключение', async () => {
  const good = webhookEvent({ conversationExternalId: 'qa-conv-1', messageExternalId: 'qa-m5', contactExternalId: 'qa-c1', contactDisplayName: 'Ирина', direction: 'INCOMING', messageType: 'TEXT', text: 'Повтор события', sentAt: new Date().toISOString() })
  expect((await postWebhook(good, 'wrong-secret-value-000000')).status(), 'неверный секрет').toBe(401)
  expect((await postWebhook(good, webhookSecret, randomUUID())).status(), 'неизвестное подключение').toBe(404)
  const first = await postWebhook(good)
  const duplicate = await postWebhook(good)
  note(`повтор того же события → ${first.status()} затем ${duplicate.status()}`)
  expect.soft([200, 202, 409]).toContain(duplicate.status())
  const malformed = await ownerApi.post(`/api/v1/webhooks/GENERIC_WEBHOOK/${tenantA}/${connectionA}`, {
    headers: { 'X-LidRadar-Webhook-Secret': webhookSecret, 'Content-Type': 'application/json' },
    data: '{not json',
  })
  expect(malformed.status(), 'битый JSON').toBe(400)
  const missing = await postWebhook({ id: randomUUID(), type: 'message.received.v1' })
  expect.soft(missing.status(), 'событие без данных').toBe(400)
  const oversize = await postWebhook(webhookEvent({ conversationExternalId: 'qa-conv-3', messageExternalId: 'qa-big', contactExternalId: 'qa-c3', contactDisplayName: 'Big', direction: 'INCOMING', messageType: 'TEXT', text: 'Б'.repeat(2_500_000), sentAt: new Date().toISOString() }))
  note(`вебхук 2,5 МБ → ${oversize.status()} ${await errorCode(oversize)}`)
  expect.soft([413, 400]).toContain(oversize.status())
  const edited = await postWebhook(webhookEvent({ conversationExternalId: 'qa-conv-1', messageExternalId: 'qa-m1', contactExternalId: 'qa-c1', direction: 'INCOMING', messageType: 'TEXT', text: 'Здравствуйте! (исправлено) Сколько стоит полировка?', sentAt: new Date().toISOString() }, 'message.edited.v1'))
  note(`правка сообщения → ${edited.status()} ${edited.status() >= 400 ? await errorCode(edited) : ''}`)
  const unknownType = await postWebhook(webhookEvent({ conversationExternalId: 'qa-conv-1', messageExternalId: 'qa-m9' }, 'message.exploded.v9'))
  expect.soft(unknownType.status(), 'неизвестный тип события').toBe(400)
  // Секрет не должен возвращаться в чтении подключений.
  const integrations = await ownerApi.get('/api/v1/integrations', { headers: tenant(tenantA) })
  expect(integrations.status()).toBe(200)
  expect((await integrations.text()).includes(webhookSecret), 'секрет вебхука не читается обратно').toBe(false)
})

test('API: команды над рисками в large — идемпотентность, конфликты, закрытие', async () => {
  const h = tenant(tenantLarge)
  const candidate = largeRisks.find((item) => item.risk.status === 'OPEN' && item.opportunity && item.opportunity.stage === 'NEW')
    ?? largeRisks.find((item) => item.risk.status === 'OPEN' && item.opportunity)
  test.skip(!candidate, 'в large нет открытого риска со сделкой')
  const riskId = candidate!.risk.id
  const opportunityId = candidate!.opportunity!.id
  note(`large: изменяется риск ${riskId} (сделка ${opportunityId}, этап ${candidate!.opportunity!.stage})`)

  const ack = await largeApi.post(`/api/v1/risks/${riskId}/acknowledge`, { headers: h })
  expect(ack.status()).toBe(200)
  const ackAgain = await largeApi.post(`/api/v1/risks/${riskId}/acknowledge`, { headers: h })
  note(`повторное «взять в работу» → ${ackAgain.status()} ${ackAgain.status() >= 400 ? await errorCode(ackAgain) : ''}`)
  expect.soft([200, 409]).toContain(ackAgain.status())

  const key = randomUUID()
  const bodyA = { type: 'CALL', note: `qa ${XSS_SCRIPT}` }
  const action1 = await largeApi.post(`/api/v1/risks/${riskId}/actions`, { headers: { ...h, 'Idempotency-Key': key }, data: bodyA })
  expect(action1.status()).toBe(201)
  const action2 = await largeApi.post(`/api/v1/risks/${riskId}/actions`, { headers: { ...h, 'Idempotency-Key': key }, data: bodyA })
  expect(action2.status(), 'повтор с тем же ключом').toBe(200)
  expect((await json<{ id: string }>(action2)).id).toBe((await json<{ id: string }>(action1)).id)
  const action3 = await largeApi.post(`/api/v1/risks/${riskId}/actions`, { headers: { ...h, 'Idempotency-Key': key }, data: { type: 'SEND_MESSAGE' } })
  expect(action3.status(), 'тот же ключ, другое тело').toBe(409)
  expect(await errorCode(action3)).toBe('IDEMPOTENCY_CONFLICT')
  const noKey = await largeApi.post(`/api/v1/risks/${riskId}/actions`, { headers: h, data: { type: 'OTHER', note: 'без ключа' } })
  note(`действие без Idempotency-Key → ${noKey.status()} ${noKey.status() >= 400 ? await errorCode(noKey) : ''}`)
  const badKey = await largeApi.post(`/api/v1/risks/${riskId}/actions`, { headers: { ...h, 'Idempotency-Key': 'x'.repeat(300) }, data: { type: 'OTHER' } })
  note(`ключ 300 символов → ${badKey.status()} ${badKey.status() >= 400 ? await errorCode(badKey) : ''}`)

  const outcomeKey = randomUUID()
  const outcome1 = await largeApi.post(`/api/v1/opportunities/${opportunityId}/outcomes`, { headers: { ...h, 'Idempotency-Key': outcomeKey }, data: { status: 'RESPONDED', note: 'qa' } })
  expect(outcome1.status()).toBe(201)
  expect((await largeApi.post(`/api/v1/opportunities/${opportunityId}/outcomes`, { headers: { ...h, 'Idempotency-Key': outcomeKey }, data: { status: 'RESPONDED', note: 'qa' } })).status()).toBe(200)

  const revenueKey = randomUUID()
  const revenue1 = await largeApi.post(`/api/v1/opportunities/${opportunityId}/revenue`, { headers: { ...h, 'Idempotency-Key': revenueKey }, data: { amount: '100.50', currency: 'RUB', attributionType: 'ORGANIC' } })
  expect(revenue1.status(), 'обычная оплата').toBe(201)
  expect((await largeApi.post(`/api/v1/opportunities/${opportunityId}/revenue`, { headers: { ...h, 'Idempotency-Key': revenueKey }, data: { amount: '100.50', currency: 'RUB', attributionType: 'ORGANIC' } })).status()).toBe(200)
  const recoveredNoChain = await largeApi.post(`/api/v1/opportunities/${opportunityId}/revenue`, { headers: { ...h, 'Idempotency-Key': randomUUID() }, data: { amount: '10', currency: 'RUB', attributionType: 'RECOVERED' } })
  note(`RECOVERED без цепочки → ${recoveredNoChain.status()} ${await errorCode(recoveredNoChain)}`)
  expect.soft([400, 409, 422]).toContain(recoveredNoChain.status())
  const negative = await largeApi.post(`/api/v1/opportunities/${opportunityId}/revenue`, { headers: { ...h, 'Idempotency-Key': randomUUID() }, data: { amount: '-5', currency: 'RUB', attributionType: 'ORGANIC' } })
  expect(negative.status(), 'отрицательная сумма').toBe(400)
  const zero = await largeApi.post(`/api/v1/opportunities/${opportunityId}/revenue`, { headers: { ...h, 'Idempotency-Key': randomUUID() }, data: { amount: '0', currency: 'RUB', attributionType: 'ORGANIC' } })
  note(`сумма 0 → ${zero.status()} ${await errorCode(zero)}`)
  expect.soft(zero.status()).toBe(400)

  const stageBefore = candidate!.opportunity!.stage
  const invalid = await largeApi.patch(`/api/v1/opportunities/${opportunityId}`, { headers: h, data: { stage: 'WON' } })
  if (stageBefore === 'NEW') {
    expect(invalid.status(), 'NEW → WON запрещён').toBe(409)
    note(`NEW → WON: ${await errorCode(invalid)}`)
    const same = await largeApi.patch(`/api/v1/opportunities/${opportunityId}`, { headers: h, data: { stage: 'NEW' } })
    note(`тот же этап NEW → NEW: ${same.status()} ${await errorCode(same)}`)
    expect.soft([400, 409]).toContain(same.status())
    expect((await largeApi.patch(`/api/v1/opportunities/${opportunityId}`, { headers: h, data: { stage: 'ENGAGED' } })).status()).toBe(200)
    const back = await largeApi.patch(`/api/v1/opportunities/${opportunityId}`, { headers: h, data: { stage: 'NEW' } })
    expect(back.status(), 'назад нельзя').toBe(409)
  } else {
    note(`этап сделки ${stageBefore}: PATCH WON → ${invalid.status()} ${await errorCode(invalid)}`)
  }
  expect((await largeApi.patch(`/api/v1/opportunities/${opportunityId}`, { headers: h, data: { stage: 'BOGUS' } })).status()).toBe(400)

  const feedback = await largeApi.post(`/api/v1/risks/${riskId}/feedback`, { headers: h, data: { verdict: 'TRUE_POSITIVE', note: XSS_SCRIPT } })
  expect(feedback.status()).toBe(201)
  const feedbackAgain = await largeApi.post(`/api/v1/risks/${riskId}/feedback`, { headers: h, data: { verdict: 'FALSE_POSITIVE', reason: 'OTHER' } })
  note(`повторная оценка → ${feedbackAgain.status()} ${feedbackAgain.status() >= 400 ? await errorCode(feedbackAgain) : ''}`)
  const feedbackBad = await largeApi.post(`/api/v1/risks/${riskId}/feedback`, { headers: h, data: { verdict: 'FALSE_POSITIVE' } })
  note(`ложное срабатывание без причины → ${feedbackBad.status()} ${feedbackBad.status() >= 400 ? await errorCode(feedbackBad) : ''}`)

  expect((await largeApi.post(`/api/v1/risks/${riskId}/resolve`, { headers: h })).status()).toBe(200)
  const afterResolve = await largeApi.post(`/api/v1/risks/${riskId}/actions`, { headers: { ...h, 'Idempotency-Key': randomUUID() }, data: { type: 'OTHER' } })
  note(`действие после закрытия риска → ${afterResolve.status()} ${await errorCode(afterResolve)}`)
  expect.soft([409, 400]).toContain(afterResolve.status())
  const resolveAgain = await largeApi.post(`/api/v1/risks/${riskId}/resolve`, { headers: h })
  note(`повторное закрытие → ${resolveAgain.status()} ${resolveAgain.status() >= 400 ? await errorCode(resolveAgain) : ''}`)
  const detail = await json<{ risk: { status: string } }>(await largeApi.get(`/api/v1/risks/${riskId}`, { headers: h }))
  expect(detail.risk.status).toBe('RESOLVED')
  const detailText = await (await largeApi.get(`/api/v1/risks/${riskId}`, { headers: h })).text()
  note(`заметка действия с <script> возвращается как текст JSON: ${detailText.includes('window.__xss') ? 'да' : 'нет (заметки нет в read model)'}`)
})

test('API: команда — последний владелец, роли, приглашения', async () => {
  const h = tenant(tenantA)
  const selfDemote = await ownerApi.patch(`/api/v1/organization/members/${ownerId}`, { headers: h, data: { role: 'MANAGER' } })
  expect(selfDemote.status(), 'единственный владелец не понижает себя').toBe(409)
  expect(await errorCode(selfDemote)).toBe('LAST_OWNER')
  const selfRevoke = await ownerApi.delete(`/api/v1/organization/members/${ownerId}`, { headers: h })
  expect(selfRevoke.status(), 'единственный владелец не отзывает себя').toBe(409)
  expect((await ownerApi.patch(`/api/v1/organization/members/${managerId}`, { headers: h, data: { role: 'OWNER' } })).status()).toBe(200)
  expect((await ownerApi.patch(`/api/v1/organization/members/${managerId}`, { headers: h, data: { role: 'OWNER' } })).status(), 'та же роль повторно').toBeLessThan(500)
  expect((await ownerApi.patch(`/api/v1/organization/members/${managerId}`, { headers: h, data: { role: 'MANAGER' } })).status()).toBe(200)
  expect((await ownerApi.patch(`/api/v1/organization/members/${managerId}`, { headers: h, data: { role: 'ADMIN' } })).status()).toBe(400)
  expect((await ownerApi.patch(`/api/v1/organization/members/${randomUUID()}`, { headers: h, data: { role: 'MANAGER' } })).status()).toBe(404)
  expect((await ownerApi.delete(`/api/v1/organization/members/${randomUUID()}`, { headers: h })).status()).toBe(404)
  const manager2Managing = await managerApi.patch(`/api/v1/organization/members/${ownerId}`, { headers: h, data: { role: 'MANAGER' } })
  expect(manager2Managing.status(), 'менеджер не меняет роли').toBe(403)

  expect((await managerApi.post('/api/v1/invitations/accept', { data: { code: invitationCode } })).status(), 'код второй раз').toBeGreaterThanOrEqual(400)
  expect((await managerApi.post('/api/v1/invitations/accept', { data: { code: 'short' } })).status()).toBe(400)
  expect((await managerApi.post('/api/v1/invitations/accept', { data: { code: randomBytes(32).toString('base64url').slice(0, 43) } })).status()).toBe(404)
  const listed = await ownerApi.get('/api/v1/organization/invitations', { headers: h })
  expect(listed.status()).toBe(200)
  expect((await listed.text()).includes(invitationCode), 'код не отдаётся в списке').toBe(false)
  const pending = await ownerApi.post('/api/v1/organization/invitations', { headers: h, data: { role: 'OWNER' } })
  expect(pending.status()).toBe(201)
  const pendingBody = await json<{ invitation: { id: string }; code: string }>(pending)
  expect((await ownerApi.delete(`/api/v1/organization/invitations/${pendingBody.invitation.id}`, { headers: h })).status()).toBe(204)
  const revokedAccept = await managerApi.post('/api/v1/invitations/accept', { data: { code: pendingBody.code } })
  note(`принятие отозванного кода → ${revokedAccept.status()} ${await errorCode(revokedAccept)}`)
  expect.soft([404, 409, 410]).toContain(revokedAccept.status())
  const grant = await ownerApi.post('/api/v1/organization/ml-consent', { headers: h })
  expect(grant.status()).toBe(201)
  expect((await ownerApi.post('/api/v1/organization/ml-consent', { headers: h })).status(), 'повторная выдача').toBe(200)
  expect((await ownerApi.delete('/api/v1/organization/ml-consent', { headers: h })).status()).toBe(204)
  const revokeAgain = await ownerApi.delete('/api/v1/organization/ml-consent', { headers: h })
  note(`повторный отзыв согласия → ${revokeAgain.status()}`)
})
