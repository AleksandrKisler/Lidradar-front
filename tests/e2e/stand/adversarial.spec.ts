/**
 * Адверсариальный прогон на реальном API (профиль Playwright `stand`,
 * запускается только с `QA_ADVERSARIAL=1`: он изменяет данные стенда).
 *
 * Что делает: создаёт (или переиспользует) двух учебных пользователей
 * `qa-owner@` и `qa-manager@lidradar.test`, две организации с «опасными»
 * именами, точку, услуги, подключение GENERIC_WEBHOOK и переписки из вебхуков,
 * приглашение менеджера; затем проверяет заголовки безопасности, отрицательные
 * сценарии входа, изоляцию организаций и права ролей, валидацию, обработку
 * некорректных идентификаторов, вебхуки, идемпотентность команд над рисками
 * профиля `large` (несколько рисков переводятся в работу, закрываются и
 * получают оценку), защиту последнего владельца, а в браузере — экранирование
 * имён, переключение организаций, разделы менеджера, потерю членства,
 * двойную отправку форм, подделанные адреса, клавиатуру и фокус, офлайн,
 * гонку этапов, axe с реальными данными, вход и лимит попыток.
 *
 * Наблюдения пишутся строками `QA-NOTE:`/`QA-FINDING:` в вывод и в файл
 * `QA_NOTES_FILE`; состояние (пароль учебных пользователей, cookie сессий и
 * идентификаторы запуска) — в `QA_STATE_FILE` вне репозитория. Сессии
 * кешируются на запуск (`QA_RUN_ID`), потому что Playwright перезапускает
 * worker после каждого падения, а вход ограничен 5 попытками на аккаунт и 20 на
 * адрес в минуту; регистрация — 5 попытками в час на адрес. Пароль стенда в
 * браузер не попадает. Учебные данные восстанавливаются
 * `make frontend-data-down && make frontend-data-up` в backend-репозитории.
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
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

// Запуск с одним worker-ом (`--workers=1`): порядок тестов важен, падение одного не отменяет остальные.
test.skip(
  !process.env.QA_ADVERSARIAL,
  'адверсариальный прогон включается переменной QA_ADVERSARIAL=1',
)
test.use({ trace: 'off', video: 'off', screenshot: 'off' })

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa']
// Состояние живёт рядом с файлом пароля стенда (папка `runtime/` backend-репозитория вне git).
const standDir = process.env.LIDRADAR_STAND_PASSWORD_FILE
  ? dirname(process.env.LIDRADAR_STAND_PASSWORD_FILE)
  : '/tmp'
const STATE_FILE = process.env.QA_STATE_FILE ?? join(standDir, 'qa-adversarial-state.json')
const NOTES_FILE = process.env.QA_NOTES_FILE ?? join(standDir, 'qa-adversarial-notes.md')
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
const LONG_WORD = 'Ж'.repeat(40)
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
let largeUserId = ''
const mutatedRisks: string[] = []

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
  // Сначала вход: регистрация лимитирована 5 попытками в час на IP и считает даже 409.
  let login = await ctx.post('/api/v1/auth/login', { data: { email, password: state.password } })
  if (login.status() === 401) {
    const registered = await ctx.post('/api/v1/auth/register', {
      data: { email, password: state.password, displayName },
    })
    if (registered.status() !== 201) {
      throw new Error(`регистрация ${email}: ${registered.status()} ${await registered.text()}`)
    }
    login = await ctx.post('/api/v1/auth/login', { data: { email, password: state.password } })
  } else {
    note(`${email} уже существует — повторный запуск, вход по сохранённому паролю`)
  }
  if (login.status() !== 200) {
    throw new Error(
      `вход ${email}: ${login.status()} — вероятно, лимит попыток; повторите через 15 минут`,
    )
  }
  return ctx
}

async function browserFor(
  browser: Browser,
  api: APIRequestContext,
  init?: { userId: string; tenantId: string },
): Promise<BrowserContext> {
  const stateDump = await api.storageState()
  const context = await browser.newContext({
    storageState: stateDump,
    viewport: { width: 1440, height: 900 },
  })
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
  expect
    .soft(overflow.scrollWidth, `горизонтальная прокрутка страницы: ${label}`)
    .toBeLessThanOrEqual(overflow.inner + 1)
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

function webhookEvent(
  data: Record<string, unknown>,
  type = 'message.received.v1',
  id = randomUUID(),
) {
  return {
    id,
    type,
    occurredAt: new Date().toISOString(),
    data: { attachments: [], metadata: {}, ...data },
  }
}

async function postWebhook(
  body: unknown,
  secret = webhookSecret,
  connection = connectionA,
  tenantId = tenantA,
) {
  return ownerApi.post(`/api/v1/webhooks/GENERIC_WEBHOOK/${tenantId}/${connection}`, {
    headers: { 'X-LidRadar-Webhook-Secret': secret, 'Content-Type': 'application/json' },
    data: body,
  })
}

interface RunCache {
  sessions: Record<
    'owner' | 'manager' | 'large',
    Awaited<ReturnType<APIRequestContext['storageState']>>
  >
  ids: {
    ownerId: string
    managerId: string
    tenantA: string
    tenantB: string
    tenantLarge: string
    largeUserId: string
    locationA: string
    connectionA: string
    webhookSecret: string
    serviceOk: string
    invitationCode: string
    conversationA: string
  }
}
const RUN_ID = process.env.QA_RUN_ID ?? 'adhoc'
const bruteEmail = () => `qa-brute-${RUN_ID.replace(/[^a-z0-9]/gi, '')}@lidradar.test`

async function contextFromCache(
  saved: RunCache['sessions']['owner'],
  email: string,
  displayName: string,
): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL, storageState: saved })
  if ((await ctx.get('/api/v1/auth/me')).status() === 200) return ctx
  await ctx.dispose()
  return registerAndLogin(email, displayName)
}

test.beforeAll(async () => {
  requireStand()
  baseURL = process.env.E2E_BASE_URL!
  state = loadState()
  guestApi = await request.newContext({ baseURL })
  const runs = (state as unknown as { runs?: Record<string, RunCache> }).runs ?? {}
  const cached = runs[RUN_ID]
  const password = readFileSync(process.env.LIDRADAR_STAND_PASSWORD_FILE!, 'utf8').trim()

  if (cached) {
    // Повторный worker того же запуска (Playwright перезапускает worker после падения): без новых входов и данных.
    ownerApi = await contextFromCache(
      cached.sessions.owner,
      state.ownerEmail,
      `QA Владелец ${XSS_IMG}`,
    )
    managerApi = await contextFromCache(
      cached.sessions.manager,
      state.managerEmail,
      `QA Менеджер ${RTL_ZW}`,
    )
    largeApi = await request.newContext({ baseURL, storageState: cached.sessions.large })
    if ((await largeApi.get('/api/v1/auth/me')).status() !== 200) {
      await largeApi.dispose()
      largeApi = await request.newContext({ baseURL })
      expect(
        (
          await largeApi.post('/api/v1/auth/login', {
            data: { email: 'large@lidradar.test', password },
          })
        ).status(),
      ).toBe(200)
    }
    ;({
      ownerId,
      managerId,
      tenantA,
      tenantB,
      tenantLarge,
      largeUserId,
      locationA,
      connectionA,
      webhookSecret,
      serviceOk,
      invitationCode,
      conversationA,
    } = cached.ids)
  } else {
    ownerApi = await registerAndLogin(state.ownerEmail, `QA Владелец ${XSS_IMG}`)
    const me = await json<{
      user: { id: string }
      memberships: { tenantId: string; organizationName: string }[]
    }>(await ownerApi.get('/api/v1/auth/me'))
    ownerId = me.user.id
    note(`владелец ${state.ownerEmail}: членств до запуска ${me.memberships.length}`)
    const existingA = me.memberships.find((item) => item.organizationName.startsWith('QA <script>'))
    if (existingA) {
      tenantA = existingA.tenantId
    } else {
      const orgA = await ownerApi.post('/api/v1/organizations', {
        data: {
          name: `QA ${XSS_SCRIPT} «Блик»`,
          defaultTimezone: 'Europe/Moscow',
          defaultCurrency: 'RUB',
        },
      })
      expect(orgA.status(), 'создание организации A').toBe(201)
      tenantA = (await json<{ id: string }>(orgA)).id
    }
    const existingB = me.memberships.find((item) => item.organizationName.startsWith(LONG_WORD))
    if (existingB) {
      tenantB = existingB.tenantId
    } else {
      const orgB = await ownerApi.post('/api/v1/organizations', {
        data: {
          name: `${LONG_WORD} ${RTL_ZW}`,
          defaultTimezone: 'Asia/Vladivostok',
          defaultCurrency: 'KZT',
        },
      })
      expect(orgB.status(), `создание организации B: ${await orgB.text()}`).toBe(201)
      tenantB = (await json<{ id: string }>(orgB)).id
    }

    const location = await ownerApi.post('/api/v1/locations', {
      headers: tenant(tenantA),
      data: {
        name: `Точка ${XSS_IMG} ${RTL_ZW}`,
        timezone: 'Asia/Vladivostok',
        responseThresholdMinutes: 1,
      },
    })
    expect(location.status(), 'создание точки').toBe(201)
    locationA = (await json<{ id: string }>(location)).id
    const hours = await ownerApi.put(`/api/v1/locations/${locationA}/business-hours`, {
      headers: tenant(tenantA),
      data: {
        timezone: 'Asia/Vladivostok',
        days: [1, 2, 3, 4, 5, 6]
          .map((weekday) => ({ weekday, closed: false, opensAt: '09:00', closesAt: '21:00' }))
          .concat([{ weekday: 7, closed: true }] as never),
      },
    })
    expect(hours.status(), 'график').toBe(200)
    const service = await ownerApi.post('/api/v1/services', {
      headers: tenant(tenantA),
      data: {
        name: `Полировка ${XSS_IMG}`,
        locationId: locationA,
        priceFrom: '1000.50',
        priceTo: '2500',
        currency: 'RUB',
      },
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
    note(
      `connect с собственным секретом вернул webhookSecret: ${connected.webhookSecret ? 'да' : 'null (секрет показывается только серверный)'}`,
    )

    const contact = `Ирина ${XSS_IMG}`
    const events = [
      webhookEvent({
        conversationExternalId: 'qa-conv-1',
        messageExternalId: 'qa-m1',
        contactExternalId: 'qa-c1',
        contactDisplayName: contact,
        direction: 'INCOMING',
        messageType: 'TEXT',
        text: `Здравствуйте! ${XSS_SCRIPT} Сколько стоит полировка?`,
        sentAt: new Date(Date.now() - 3_600_000).toISOString(),
      }),
      webhookEvent({
        conversationExternalId: 'qa-conv-1',
        messageExternalId: 'qa-m2',
        contactExternalId: 'qa-c1',
        contactDisplayName: contact,
        direction: 'OUTGOING',
        messageType: 'TEXT',
        text: 'Полный комплекс — 31 000 ₽.',
        sentAt: new Date(Date.now() - 3_500_000).toISOString(),
      }),
      webhookEvent({
        conversationExternalId: 'qa-conv-1',
        messageExternalId: 'qa-m3',
        contactExternalId: 'qa-c1',
        contactDisplayName: contact,
        direction: 'INCOMING',
        messageType: 'TEXT',
        text: 'Д'.repeat(3000),
        sentAt: new Date(Date.now() - 3_400_000).toISOString(),
      }),
      webhookEvent({
        conversationExternalId: 'qa-conv-2',
        messageExternalId: 'qa-m4',
        contactExternalId: 'qa-c2',
        contactDisplayName: RTL_ZW,
        direction: 'INCOMING',
        messageType: 'TEXT',
        text: RTL_ZW,
        sentAt: new Date(Date.now() - 1_800_000).toISOString(),
      }),
    ]
    for (const event of events) {
      const accepted = await postWebhook(event)
      expect(
        accepted.status(),
        `webhook ${String((event.data as unknown as { messageExternalId: string }).messageExternalId)}`,
      ).toBe(202)
    }
    expect(
      (
        await postWebhook(
          webhookEvent(
            {
              conversationExternalId: 'qa-conv-1',
              messageExternalId: 'qa-m3',
              contactExternalId: 'qa-c1',
            },
            'message.deleted.v1',
          ),
        )
      ).status(),
    ).toBe(202)
    const edited = await postWebhook(
      webhookEvent(
        {
          conversationExternalId: 'qa-conv-1',
          messageExternalId: 'qa-m1',
          contactExternalId: 'qa-c1',
          direction: 'INCOMING',
          messageType: 'TEXT',
          text: `Здравствуйте! (исправлено) ${XSS_SCRIPT} Сколько стоит полировка?`,
          sentAt: new Date(Date.now() - 3_600_000).toISOString(),
        },
        'message.edited.v1',
      ),
    )
    note(
      `правка сообщения → ${edited.status()} ${edited.status() >= 400 ? await errorCode(edited) : ''}`,
    )

    const deadline = Date.now() + 25_000
    while (Date.now() < deadline) {
      const list = await json<{
        items: { conversation: { id: string; externalId: string; connectionId: string } }[]
      }>(await ownerApi.get('/api/v1/conversations?limit=50', { headers: tenant(tenantA) }))
      const mine = list.items.filter((item) => item.conversation.connectionId === connectionA)
      if (mine.length >= 2) {
        conversationA =
          mine.find((item) => item.conversation.externalId === 'qa-conv-1')?.conversation.id ??
          mine[0]!.conversation.id
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    if (!conversationA)
      finding(
        'переписки из вебхуков не появились за 25 с — обработчик заданий не работает или события отклонены',
      )

    const invitation = await ownerApi.post('/api/v1/organization/invitations', {
      headers: tenant(tenantA),
      data: { role: 'MANAGER', note: `<b>qa</b> ${RTL_ZW}` },
    })
    expect(invitation.status(), 'приглашение').toBe(201)
    invitationCode = (await json<{ code: string }>(invitation)).code

    managerApi = await registerAndLogin(state.managerEmail, `QA Менеджер ${RTL_ZW}`)
    managerId = (await json<{ user: { id: string } }>(await managerApi.get('/api/v1/auth/me'))).user
      .id
    const accepted = await managerApi.post('/api/v1/invitations/accept', {
      data: { code: invitationCode },
    })
    if (accepted.status() === 200) {
      expect((await json<{ membership: { tenantId: string } }>(accepted)).membership.tenantId).toBe(
        tenantA,
      )
    } else {
      note(
        `принятие приглашения повторным менеджером → ${accepted.status()} ${await errorCode(accepted)} (уже состоит)`,
      )
      expect([409, 400]).toContain(accepted.status())
      const managerMe = await json<{ memberships: { tenantId: string }[] }>(
        await managerApi.get('/api/v1/auth/me'),
      )
      if (!managerMe.memberships.some((item) => item.tenantId === tenantA)) {
        const fresh = await ownerApi.post('/api/v1/organization/invitations', {
          headers: tenant(tenantA),
          data: { role: 'MANAGER' },
        })
        const again = await managerApi.post('/api/v1/invitations/accept', {
          data: { code: (await json<{ code: string }>(fresh)).code },
        })
        expect(again.status(), 'повторное принятие после отзыва').toBe(200)
      }
    }

    largeApi = await request.newContext({ baseURL })
    const largeLogin = await largeApi.post('/api/v1/auth/login', {
      data: { email: 'large@lidradar.test', password },
    })
    expect(largeLogin.status(), 'вход large').toBe(200)
    const largeMe = await json<{ user: { id: string }; memberships: { tenantId: string }[] }>(
      await largeApi.get('/api/v1/auth/me'),
    )
    largeUserId = largeMe.user.id
    tenantLarge = largeMe.memberships[0]!.tenantId

    runs[RUN_ID] = {
      sessions: {
        owner: await ownerApi.storageState(),
        manager: await managerApi.storageState(),
        large: await largeApi.storageState(),
      },
      ids: {
        ownerId,
        managerId,
        tenantA,
        tenantB,
        tenantLarge,
        largeUserId,
        locationA,
        connectionA,
        webhookSecret,
        serviceOk,
        invitationCode,
        conversationA,
      },
    }
    ;(state as unknown as { runs?: Record<string, RunCache> }).runs = runs
    writeFileSync(STATE_FILE, JSON.stringify(state))
  }
  largeRisks = (
    await json<{ items: LargeRisk[] }>(
      await largeApi.get('/api/v1/risks?active=true&limit=60', { headers: tenant(tenantLarge) }),
    )
  ).items
  foreignRiskId = largeRisks[0]!.risk.id
  foreignConversationId = largeRisks.find((item) => item.conversation)?.conversation?.id ?? ''
  note(
    `large: активных рисков в первой странице ${largeRisks.length}; NEW-сделок ${largeRisks.filter((item) => item.opportunity?.stage === 'NEW').length}`,
  )
})

test.afterAll(async () => {
  const previous = existsSync(NOTES_FILE) ? readFileSync(NOTES_FILE, 'utf8') : ''
  writeFileSync(NOTES_FILE, previous + notes.map((line) => `- ${line}`).join('\n') + '\n')
})

test('API: cookie, заголовки безопасности и проверка Origin', async () => {
  const login = await guestApi.post('/api/v1/auth/login', {
    data: { email: bruteEmail(), password: 'wrong-password-value' },
  })
  const headers = login.headersArray().map((h) => `${h.name.toLowerCase()}: ${h.value}`)
  note(
    `заголовки ответа API: ${headers.filter((h) => /^(x-|content-security|strict|cache|referrer)/.test(h)).join(' | ') || 'нет заголовков безопасности'}`,
  )
  expect
    .soft(
      headers.some((h) => h.startsWith('x-content-type-options: nosniff')),
      'X-Content-Type-Options',
    )
    .toBe(true)
  const setCookie = (await ownerApi.storageState()).cookies.find(
    (c) => c.name === 'lidradar_session',
  )
  expect(setCookie, 'cookie сессии').toBeTruthy()
  expect.soft(setCookie!.httpOnly, 'HttpOnly').toBe(true)
  expect.soft(['Lax', 'Strict']).toContain(setCookie!.sameSite)
  note(
    `cookie: httpOnly=${setCookie!.httpOnly} sameSite=${setCookie!.sameSite} secure=${setCookie!.secure} (dev: LIDRADAR_COOKIE_SECURE=false)`,
  )

  const evil = await guestApi.post('/api/v1/auth/login', {
    headers: { Origin: 'https://evil.example' },
    data: { email: bruteEmail(), password: 'wrong-password-value' },
  })
  note(`POST с Origin evil.example → ${evil.status()} ${await errorCode(evil)}`)
  expect.soft(evil.status(), 'чужой Origin отклоняется').toBe(403)
  const wrongType = await guestApi.post('/api/v1/auth/login', {
    headers: { 'Content-Type': 'text/plain' },
    data: JSON.stringify({ email: bruteEmail(), password: 'wrong-password-value' }),
  })
  note(
    `POST /auth/login с text/plain → ${wrongType.status()} ${await errorCode(wrongType)} (тело разбирается независимо от Content-Type)`,
  )
  expect.soft([400, 401, 415]).toContain(wrongType.status())
})

test('API: отрицательные сценарии входа и регистрации', async () => {
  const wrong = await guestApi.post('/api/v1/auth/login', {
    data: { email: bruteEmail(), password: 'definitely-wrong-password' },
  })
  const unknown = await guestApi.post('/api/v1/auth/login', {
    data: { email: `nobody-${Date.now()}@lidradar.test`, password: 'definitely-wrong-password' },
  })
  expect(wrong.status()).toBe(401)
  expect(unknown.status()).toBe(401)
  const strip = (text: string) => text.replace(/"traceId":"[^"]+"/, '')
  expect
    .soft(strip(await wrong.text()), 'тело 401 одинаково для чужого и неверного')
    .toBe(strip(await unknown.text()))
  const malformed = await guestApi.post('/api/v1/auth/login', {
    data: { email: 'not-an-email', password: 'x' },
  })
  note(`вход с адресом без @ → ${malformed.status()} ${await errorCode(malformed)}`)
  expect.soft([400, 401]).toContain(malformed.status())
  const shortPassword = await guestApi.post('/api/v1/auth/register', {
    data: { email: `short-${Date.now()}@lidradar.test`, password: 'short', displayName: 'X' },
  })
  note(
    `регистрация с паролем из 5 символов → ${shortPassword.status()} ${await errorCode(shortPassword)}`,
  )
  expect
    .soft([400, 429], 'пароль короче 12 (или лимит регистраций)')
    .toContain(shortPassword.status())
  const noCookie = await guestApi.get('/api/v1/auth/me')
  expect(noCookie.status()).toBe(401)
  const refresh = await guestApi.post('/api/v1/auth/refresh')
  expect.soft([401, 403]).toContain(refresh.status())
  // Выход и повторное чтение сессии — отдельным контекстом, чтобы не терять сессию менеджера.
  const throwaway = await request.newContext({ baseURL })
  expect(
    (
      await throwaway.post('/api/v1/auth/login', {
        data: { email: state.managerEmail, password: state.password },
      })
    ).status(),
  ).toBe(200)
  expect((await throwaway.get('/api/v1/auth/me')).status()).toBe(200)
  const logout = await throwaway.post('/api/v1/auth/logout')
  expect([200, 204]).toContain(logout.status())
  expect((await throwaway.get('/api/v1/auth/me')).status(), 'после выхода сессии нет').toBe(401)
  await throwaway.dispose()
})

test('API: изоляция организаций и права ролей', async () => {
  expect(
    (await ownerApi.get('/api/v1/radar', { headers: tenant(tenantLarge) })).status(),
    'чужая организация',
  ).toBe(403)
  expect((await ownerApi.get('/api/v1/radar', { headers: tenant('not-a-uuid') })).status()).toBe(
    400,
  )
  const missing = await ownerApi.get('/api/v1/radar')
  expect.soft([400, 401, 403]).toContain(missing.status())
  note(`GET /radar без X-Tenant-ID → ${missing.status()} ${await errorCode(missing)}`)
  expect(
    (await ownerApi.get(`/api/v1/risks/${foreignRiskId}`, { headers: tenant(tenantA) })).status(),
    'чужой риск в своей организации',
  ).toBe(404)
  if (foreignConversationId) {
    expect(
      (
        await ownerApi.get(`/api/v1/conversations/${foreignConversationId}`, {
          headers: tenant(tenantA),
        })
      ).status(),
    ).toBe(404)
    expect(
      (
        await ownerApi.get(`/api/v1/conversations/${foreignConversationId}/messages`, {
          headers: tenant(tenantA),
        })
      ).status(),
    ).toBe(404)
  }
  expect(
    (
      await ownerApi.post(`/api/v1/risks/${foreignRiskId}/acknowledge`, {
        headers: tenant(tenantA),
      })
    ).status(),
  ).toBe(404)
  expect(
    (await ownerApi.get('/api/v1/radar', { headers: tenant(tenantB) })).status(),
    'вторая своя организация',
  ).toBe(200)

  const forbidden: [string, string][] = [
    ['GET', '/api/v1/services'],
    ['GET', '/api/v1/organization/members'],
    ['GET', '/api/v1/organization/invitations'],
    ['GET', '/api/v1/analytics/summary'],
    ['GET', '/api/v1/integrations'],
    ['GET', '/api/v1/revenue/confirmed-recovered'],
  ]
  for (const [method, path] of forbidden) {
    const response = await managerApi.fetch(path, { method, headers: tenant(tenantA) })
    expect.soft(response.status(), `менеджер ${method} ${path}`).toBe(403)
  }
  expect
    .soft(
      (
        await managerApi.post('/api/v1/organization/ml-consent', { headers: tenant(tenantA) })
      ).status(),
      'менеджер согласие',
    )
    .toBe(403)
  expect
    .soft(
      (
        await managerApi.patch('/api/v1/organization', {
          headers: tenant(tenantA),
          data: { name: 'x' },
        })
      ).status(),
    )
    .toBe(403)
  expect
    .soft(
      (
        await managerApi.post('/api/v1/services', { headers: tenant(tenantA), data: { name: 'x' } })
      ).status(),
    )
    .toBe(403)
  expect
    .soft(
      (
        await managerApi.get('/api/v1/organization/ml-consent', { headers: tenant(tenantA) })
      ).status(),
      'менеджер читает статус согласия',
    )
    .toBe(200)
  expect((await managerApi.get('/api/v1/radar', { headers: tenant(tenantA) })).status()).toBe(200)
  expect(
    (await managerApi.get('/api/v1/conversations', { headers: tenant(tenantA) })).status(),
  ).toBe(200)
  expect(
    (
      await managerApi.get('/api/v1/notifications/preferences', { headers: tenant(tenantA) })
    ).status(),
  ).toBe(200)
  expect(
    (await managerApi.get('/api/v1/radar', { headers: tenant(tenantB) })).status(),
    'менеджер не состоит в B',
  ).toBe(403)
  const locations = await managerApi.get('/api/v1/locations', { headers: tenant(tenantA) })
  note(`менеджер GET /locations → ${locations.status()} (список точек нужен фильтру Radar)`)
  const adminMe = await json<{ platformAdmin: boolean }>(await managerApi.get('/api/v1/admin/me'))
  expect(adminMe.platformAdmin, 'менеджер не администратор платформы').toBe(false)
  expect(
    (await json<{ platformAdmin: boolean }>(await ownerApi.get('/api/v1/admin/me'))).platformAdmin,
  ).toBe(false)
  expect((await ownerApi.get('/api/v1/admin/organizations')).status()).toBe(403)
  const machine = await ownerApi.post('/internal/v1/ai/nodes/heartbeat', { data: {} })
  note(`браузерная сессия на /internal → ${machine.status()}`)
  expect.soft([401, 403, 404]).toContain(machine.status())
})

test('API: валидация граничных значений', async () => {
  const h = tenant(tenantA)
  const cases: [string, Record<string, unknown>, number[]][] = [
    [
      'цена от больше цены до',
      { name: 'Диапазон наоборот', priceFrom: '2000', priceTo: '1000', currency: 'RUB' },
      [400],
    ],
    ['цена не число', { name: 'Буквы', priceFrom: 'abc', currency: 'RUB' }, [400]],
    ['13 цифр', { name: 'Слишком много', priceFrom: '1234567890123', currency: 'RUB' }, [400]],
    ['три знака после запятой', { name: 'Дробь', priceFrom: '10.123', currency: 'RUB' }, [400]],
    ['имя 201 символ', { name: 'Ж'.repeat(201), currency: 'RUB' }, [400]],
    ['имя 200 латинских символов', { name: 'A'.repeat(200), currency: 'RUB' }, [201]],
    [
      'имя 100 кириллических символов (200 байт)',
      { name: 'Ж'.repeat(100), currency: 'RUB' },
      [201],
    ],
    [
      'имя 101 кириллический символ (202 байта)',
      { name: 'Ж'.repeat(101), currency: 'RUB' },
      [201, 400],
    ],
    ['пустое имя', { name: '   ', currency: 'RUB' }, [400]],
    [
      'валюта строчными',
      { name: 'Валюта строчными', priceFrom: '10', currency: 'rub' },
      [201, 400],
    ],
    ['чужая точка', { name: 'Чужая точка', locationId: randomUUID(), currency: 'RUB' }, [400, 404]],
    ['имя 200 кириллических символов', { name: 'Ж'.repeat(200), currency: 'RUB' }, [201, 400]],
    ['только нижняя граница', { name: 'От 0.01', priceFrom: '0.01', currency: 'RUB' }, [201]],
    ['неизвестное поле', { name: 'Лишнее поле', currency: 'RUB', unexpected: true }, [201, 400]],
  ]
  for (const [label, body, accepted] of cases) {
    const response = await ownerApi.post('/api/v1/services', { headers: h, data: body })
    note(
      `услуга «${label}» → ${response.status()} ${response.status() >= 400 ? await errorCode(response) : ''}`,
    )
    expect.soft(accepted, `услуга: ${label}`).toContain(response.status())
    if (label.startsWith('имя 101') && response.status() === 400) {
      finding(
        'сервер ограничивает длину имени в байтах: 101 кириллический символ отклонён, хотя контракт обещает 200 символов (клиент проверяет символы → неожиданный 400 для русских названий длиннее 100 знаков)',
      )
    }
  }
  const huge = await ownerApi.post('/api/v1/services', {
    headers: h,
    data: { name: 'A'.repeat(300_000), currency: 'RUB' },
  })
  note(`услуга с именем 300 КБ → ${huge.status()} ${await errorCode(huge)}`)
  expect.soft([400, 413]).toContain(huge.status())
  expect(
    (
      await ownerApi.patch(`/api/v1/services/${randomUUID()}`, {
        headers: h,
        data: { active: false },
      })
    ).status(),
  ).toBe(404)

  for (const [label, body, accepted] of [
    ['порог 0', { name: 'П0', timezone: 'Europe/Moscow', responseThresholdMinutes: 0 }, [400]],
    [
      'порог 1441',
      { name: 'П1441', timezone: 'Europe/Moscow', responseThresholdMinutes: 1441 },
      [400],
    ],
    ['неизвестный часовой пояс', { name: 'TZ', timezone: 'Mars/Olympus' }, [400]],
  ] as [string, Record<string, unknown>, number[]][]) {
    const response = await ownerApi.post('/api/v1/locations', { headers: h, data: body })
    note(`точка «${label}» → ${response.status()} ${await errorCode(response)}`)
    expect.soft(accepted, `точка: ${label}`).toContain(response.status())
  }
  const overnight = await ownerApi.put(`/api/v1/locations/${locationA}/business-hours`, {
    headers: h,
    data: {
      timezone: 'Asia/Vladivostok',
      days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        weekday,
        closed: false,
        opensAt: '22:00',
        closesAt: '06:00',
      })),
    },
  })
  note(
    `график через полночь (22:00–06:00) → ${overnight.status()} ${overnight.status() >= 400 ? await errorCode(overnight) : ''}`,
  )
  const badDay = await ownerApi.put(`/api/v1/locations/${locationA}/business-hours`, {
    headers: h,
    data: { timezone: 'Asia/Vladivostok', days: [{ weekday: 8, closed: true }] },
  })
  expect.soft(badDay.status(), 'день недели 8').toBe(400)
  // Восстановить корректный график.
  expect(
    (
      await ownerApi.put(`/api/v1/locations/${locationA}/business-hours`, {
        headers: h,
        data: {
          timezone: 'Asia/Vladivostok',
          days: [1, 2, 3, 4, 5, 6]
            .map((weekday) => ({ weekday, closed: false, opensAt: '09:00', closesAt: '21:00' }))
            .concat([{ weekday: 7, closed: true }] as never),
        },
      })
    ).status(),
  ).toBe(200)

  const badPreference = await ownerApi.put('/api/v1/notifications/preferences/NO_RESPONSE', {
    headers: h,
    data: {
      minimumSeverity: 'HIGH',
      deliveryMode: 'IMMEDIATE',
      inAppEnabled: true,
      telegramEnabled: false,
      quietHoursEnabled: true,
      quietHoursStart: '25:00',
      quietHoursEnd: '07:00',
      digestTime: '09:00',
    },
  })
  expect.soft(badPreference.status(), 'тихие часы 25:00').toBe(400)
  const unknownType = await ownerApi.put('/api/v1/notifications/preferences/UNKNOWN_TYPE', {
    headers: h,
    data: {
      minimumSeverity: 'HIGH',
      deliveryMode: 'IMMEDIATE',
      inAppEnabled: true,
      telegramEnabled: false,
      quietHoursEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      digestTime: '09:00',
    },
  })
  expect.soft([400, 404]).toContain(unknownType.status())
  const list = await ownerApi.get(
    '/api/v1/conversations?search=' + encodeURIComponent('x'.repeat(101)),
    { headers: h },
  )
  note(`поиск 101 символ → ${list.status()} ${list.status() >= 400 ? await errorCode(list) : ''}`)
  expect.soft(list.status()).toBe(400)
  const injection = await ownerApi.get(
    '/api/v1/conversations?search=' + encodeURIComponent(`%_'" OR 1=1 --`),
    { headers: h },
  )
  expect(injection.status(), 'поиск со спецсимволами').toBe(200)
  const limit = await ownerApi.get('/api/v1/risks?limit=100000', { headers: h })
  note(`GET /risks?limit=100000 → ${limit.status()}`)
  expect.soft([200, 400]).toContain(limit.status())
  const badSeverity = await ownerApi.get('/api/v1/risks?severity=BOGUS', { headers: h })
  note(`GET /risks?severity=BOGUS → ${badSeverity.status()} ${await errorCode(badSeverity)}`)
  const badRange = await ownerApi.get('/api/v1/analytics/summary?from=2026-13-40&to=zzz', {
    headers: h,
  })
  expect.soft(badRange.status(), 'аналитика с мусорными датами').toBe(400)
  const reversed = await ownerApi.get('/api/v1/analytics/summary?from=2026-09-20&to=2026-09-01', {
    headers: h,
  })
  note(`аналитика from>to → ${reversed.status()} ${await errorCode(reversed)}`)
  const cursor = await ownerApi.get(
    '/api/v1/risks?cursor=' + encodeURIComponent('AAAA!!!not-a-cursor'),
    { headers: h },
  )
  note(`мусорный cursor → ${cursor.status()} ${await errorCode(cursor)}`)
  expect.soft([400]).toContain(cursor.status())
})

test('API: некорректные идентификаторы в пути не дают 500', async () => {
  const h = tenant(tenantA)
  const probes: [string, string, unknown][] = [
    ['GET', '/api/v1/risks/not-a-uuid', undefined],
    ['GET', '/api/v1/conversations/not-a-uuid', undefined],
    ['GET', '/api/v1/conversations/not-a-uuid/messages', undefined],
    ['GET', '/api/v1/opportunities/not-a-uuid', undefined],
    ['PATCH', '/api/v1/services/not-a-uuid', { active: false }],
    ['DELETE', '/api/v1/services/not-a-uuid', undefined],
    ['PATCH', '/api/v1/locations/not-a-uuid', { name: 'x' }],
    ['PUT', '/api/v1/locations/not-a-uuid/business-hours', { timezone: 'Europe/Moscow', days: [] }],
    ['PATCH', '/api/v1/organization/members/not-a-uuid', { role: 'MANAGER' }],
    ['DELETE', '/api/v1/organization/members/not-a-uuid', undefined],
    ['DELETE', '/api/v1/organization/invitations/not-a-uuid', undefined],
    ['POST', '/api/v1/risks/not-a-uuid/acknowledge', undefined],
    ['POST', '/api/v1/risks/not-a-uuid/resolve', undefined],
    ['POST', '/api/v1/risks/not-a-uuid/feedback', { verdict: 'TRUE_POSITIVE' }],
    ['POST', '/api/v1/risks/not-a-uuid/actions', { type: 'OTHER' }],
    ['POST', '/api/v1/risks/not-a-uuid/recommendation', undefined],
    ['GET', '/api/v1/integrations/not-a-uuid/health', undefined],
    ['POST', '/api/v1/integrations/not-a-uuid/health/check', undefined],
    ['DELETE', '/api/v1/integrations/not-a-uuid', undefined],
    ['PATCH', '/api/v1/opportunities/not-a-uuid', { stage: 'ENGAGED' }],
    ['POST', '/api/v1/opportunities/not-a-uuid/outcomes', { status: 'RESPONDED' }],
    [
      'POST',
      '/api/v1/opportunities/not-a-uuid/revenue',
      { amount: '1', currency: 'RUB', attributionType: 'ORGANIC' },
    ],
    ['POST', '/api/v1/webhooks/GENERIC_WEBHOOK/not-a-uuid/not-a-uuid', {}],
  ]
  const broken: string[] = []
  for (const [method, path, body] of probes) {
    const response = await ownerApi.fetch(path, {
      method,
      headers: { ...h, 'Idempotency-Key': randomUUID() },
      ...(body === undefined ? {} : { data: body }),
    })
    if (response.status() >= 500)
      broken.push(`${method} ${path} → ${response.status()} ${await errorCode(response)}`)
    expect.soft(response.status(), `${method} ${path}`).toBeLessThan(500)
  }
  if (broken.length) finding(`500 на некорректный UUID в пути: ${broken.join('; ')}`)
  else note('некорректные UUID в пути: везде 4xx')
})

test('API: вебхуки — секрет, размер, дубли, неизвестное подключение', async () => {
  const good = webhookEvent({
    conversationExternalId: 'qa-conv-1',
    messageExternalId: 'qa-m5',
    contactExternalId: 'qa-c1',
    contactDisplayName: 'Ирина',
    direction: 'INCOMING',
    messageType: 'TEXT',
    text: 'Повтор события',
    sentAt: new Date().toISOString(),
  })
  expect
    .soft((await postWebhook(good, 'wrong-secret-value-000000')).status(), 'неверный секрет')
    .toBe(401)
  expect
    .soft(
      (await postWebhook(good, webhookSecret, randomUUID())).status(),
      'неизвестное подключение',
    )
    .toBe(404)
  const first = await postWebhook(good)
  const duplicate = await postWebhook(good)
  note(`повтор того же события → ${first.status()} затем ${duplicate.status()}`)
  expect.soft([200, 202, 409]).toContain(duplicate.status())
  const malformed = await ownerApi.post(
    `/api/v1/webhooks/GENERIC_WEBHOOK/${tenantA}/${connectionA}`,
    {
      headers: { 'X-LidRadar-Webhook-Secret': webhookSecret, 'Content-Type': 'application/json' },
      data: '{not json',
    },
  )
  note(
    `вебхук с битым JSON → ${malformed.status()} ${malformed.status() >= 400 ? await errorCode(malformed) : '(принят без проверки тела)'}`,
  )
  if (malformed.status() === 202)
    finding(
      'вебхук принимает битый JSON с 202: контракт обещает 400, а мусор превращается в падающее задание',
    )
  expect.soft(malformed.status(), 'битый JSON').toBe(400)
  const missing = await postWebhook({ id: randomUUID(), type: 'message.received.v1' })
  expect.soft(missing.status(), 'событие без данных').toBe(400)
  const oversize = await postWebhook(
    webhookEvent({
      conversationExternalId: 'qa-conv-3',
      messageExternalId: 'qa-big',
      contactExternalId: 'qa-c3',
      contactDisplayName: 'Big',
      direction: 'INCOMING',
      messageType: 'TEXT',
      text: 'Б'.repeat(2_500_000),
      sentAt: new Date().toISOString(),
    }),
  )
  note(`вебхук 2,5 МБ → ${oversize.status()} ${await errorCode(oversize)}`)
  expect.soft([413, 400]).toContain(oversize.status())
  const edited = await postWebhook(
    webhookEvent(
      {
        conversationExternalId: 'qa-conv-1',
        messageExternalId: 'qa-m1',
        contactExternalId: 'qa-c1',
        direction: 'INCOMING',
        messageType: 'TEXT',
        text: 'Здравствуйте! (исправлено) Сколько стоит полировка?',
        sentAt: new Date().toISOString(),
      },
      'message.edited.v1',
    ),
  )
  note(
    `правка сообщения → ${edited.status()} ${edited.status() >= 400 ? await errorCode(edited) : ''}`,
  )
  const unknownType = await postWebhook(
    webhookEvent(
      { conversationExternalId: 'qa-conv-1', messageExternalId: 'qa-m9' },
      'message.exploded.v9',
    ),
  )
  expect.soft(unknownType.status(), 'неизвестный тип события').toBe(400)
  // Секрет не должен возвращаться в чтении подключений.
  const integrations = await ownerApi.get('/api/v1/integrations', { headers: tenant(tenantA) })
  expect(integrations.status()).toBe(200)
  expect(
    (await integrations.text()).includes(webhookSecret),
    'секрет вебхука не читается обратно',
  ).toBe(false)
})

test('API: команды над рисками в large — идемпотентность, конфликты, закрытие', async () => {
  const h = tenant(tenantLarge)
  const candidate =
    largeRisks.find(
      (item) => item.risk.status === 'OPEN' && item.opportunity && item.opportunity.stage === 'NEW',
    ) ?? largeRisks.find((item) => item.risk.status === 'OPEN' && item.opportunity)
  test.skip(!candidate, 'в large нет открытого риска со сделкой')
  const riskId = candidate!.risk.id
  const opportunityId = candidate!.opportunity!.id
  mutatedRisks.push(riskId)
  note(
    `large: изменяется риск ${riskId} (сделка ${opportunityId}, этап ${candidate!.opportunity!.stage})`,
  )

  const ack = await largeApi.post(`/api/v1/risks/${riskId}/acknowledge`, { headers: h })
  expect(ack.status()).toBe(200)
  const ackAgain = await largeApi.post(`/api/v1/risks/${riskId}/acknowledge`, { headers: h })
  note(
    `повторное «взять в работу» → ${ackAgain.status()} ${ackAgain.status() >= 400 ? await errorCode(ackAgain) : ''}`,
  )
  expect.soft([200, 409]).toContain(ackAgain.status())

  const key = randomUUID()
  const bodyA = { type: 'CALL', note: `qa ${XSS_SCRIPT}` }
  const action1 = await largeApi.post(`/api/v1/risks/${riskId}/actions`, {
    headers: { ...h, 'Idempotency-Key': key },
    data: bodyA,
  })
  expect(action1.status()).toBe(201)
  const action2 = await largeApi.post(`/api/v1/risks/${riskId}/actions`, {
    headers: { ...h, 'Idempotency-Key': key },
    data: bodyA,
  })
  expect(action2.status(), 'повтор с тем же ключом').toBe(200)
  expect((await json<{ id: string }>(action2)).id).toBe((await json<{ id: string }>(action1)).id)
  const action3 = await largeApi.post(`/api/v1/risks/${riskId}/actions`, {
    headers: { ...h, 'Idempotency-Key': key },
    data: { type: 'SEND_MESSAGE' },
  })
  expect(action3.status(), 'тот же ключ, другое тело').toBe(409)
  expect(await errorCode(action3)).toBe('IDEMPOTENCY_CONFLICT')
  const noKey = await largeApi.post(`/api/v1/risks/${riskId}/actions`, {
    headers: h,
    data: { type: 'OTHER', note: 'без ключа' },
  })
  note(
    `действие без Idempotency-Key → ${noKey.status()} ${noKey.status() >= 400 ? await errorCode(noKey) : ''}`,
  )
  const badKey = await largeApi.post(`/api/v1/risks/${riskId}/actions`, {
    headers: { ...h, 'Idempotency-Key': 'x'.repeat(300) },
    data: { type: 'OTHER' },
  })
  note(
    `ключ 300 символов → ${badKey.status()} ${badKey.status() >= 400 ? await errorCode(badKey) : ''}`,
  )

  const outcomeKey = randomUUID()
  const outcome1 = await largeApi.post(`/api/v1/opportunities/${opportunityId}/outcomes`, {
    headers: { ...h, 'Idempotency-Key': outcomeKey },
    data: { status: 'RESPONDED', note: 'qa' },
  })
  expect(outcome1.status()).toBe(201)
  expect(
    (
      await largeApi.post(`/api/v1/opportunities/${opportunityId}/outcomes`, {
        headers: { ...h, 'Idempotency-Key': outcomeKey },
        data: { status: 'RESPONDED', note: 'qa' },
      })
    ).status(),
  ).toBe(200)

  const revenueKey = randomUUID()
  const revenue1 = await largeApi.post(`/api/v1/opportunities/${opportunityId}/revenue`, {
    headers: { ...h, 'Idempotency-Key': revenueKey },
    data: { amount: '100.50', currency: 'RUB', attributionType: 'ORGANIC' },
  })
  expect(revenue1.status(), 'обычная оплата').toBe(201)
  expect(
    (
      await largeApi.post(`/api/v1/opportunities/${opportunityId}/revenue`, {
        headers: { ...h, 'Idempotency-Key': revenueKey },
        data: { amount: '100.50', currency: 'RUB', attributionType: 'ORGANIC' },
      })
    ).status(),
  ).toBe(200)
  const recoveredNoChain = await largeApi.post(`/api/v1/opportunities/${opportunityId}/revenue`, {
    headers: { ...h, 'Idempotency-Key': randomUUID() },
    data: { amount: '10', currency: 'RUB', attributionType: 'RECOVERED' },
  })
  note(`RECOVERED без цепочки → ${recoveredNoChain.status()} ${await errorCode(recoveredNoChain)}`)
  expect.soft([400, 409, 422]).toContain(recoveredNoChain.status())
  const negative = await largeApi.post(`/api/v1/opportunities/${opportunityId}/revenue`, {
    headers: { ...h, 'Idempotency-Key': randomUUID() },
    data: { amount: '-5', currency: 'RUB', attributionType: 'ORGANIC' },
  })
  expect(negative.status(), 'отрицательная сумма').toBe(400)
  const zero = await largeApi.post(`/api/v1/opportunities/${opportunityId}/revenue`, {
    headers: { ...h, 'Idempotency-Key': randomUUID() },
    data: { amount: '0', currency: 'RUB', attributionType: 'ORGANIC' },
  })
  note(`сумма 0 → ${zero.status()} ${await errorCode(zero)}`)
  expect.soft(zero.status()).toBe(400)

  const stageBefore = candidate!.opportunity!.stage
  const invalid = await largeApi.patch(`/api/v1/opportunities/${opportunityId}`, {
    headers: h,
    data: { stage: 'WON' },
  })
  if (stageBefore === 'NEW') {
    expect(invalid.status(), 'NEW → WON запрещён').toBe(409)
    note(`NEW → WON: ${await errorCode(invalid)}`)
    const before = await (
      await largeApi.get(`/api/v1/opportunities/${opportunityId}`, { headers: h })
    ).text()
    const same = await largeApi.patch(`/api/v1/opportunities/${opportunityId}`, {
      headers: h,
      data: { stage: 'NEW' },
    })
    const after = await (
      await largeApi.get(`/api/v1/opportunities/${opportunityId}`, { headers: h })
    ).text()
    note(
      `тот же этап NEW → NEW: ${same.status()} ${same.status() >= 400 ? await errorCode(same) : ''}; ответ сделки ${before === after ? 'не изменился (идемпотентно)' : 'ИЗМЕНИЛСЯ — возможна пустая запись в истории'}`,
    )
    if (same.status() < 400 && before !== after)
      finding(
        'PATCH сделки на тот же этап отвечает 200 и меняет запись (проверить историю этапов на пустой переход NEW → NEW)',
      )
    expect(
      (
        await largeApi.patch(`/api/v1/opportunities/${opportunityId}`, {
          headers: h,
          data: { stage: 'ENGAGED' },
        })
      ).status(),
    ).toBe(200)
    const back = await largeApi.patch(`/api/v1/opportunities/${opportunityId}`, {
      headers: h,
      data: { stage: 'NEW' },
    })
    expect(back.status(), 'назад нельзя').toBe(409)
  } else {
    note(`этап сделки ${stageBefore}: PATCH WON → ${invalid.status()} ${await errorCode(invalid)}`)
  }
  expect(
    (
      await largeApi.patch(`/api/v1/opportunities/${opportunityId}`, {
        headers: h,
        data: { stage: 'BOGUS' },
      })
    ).status(),
  ).toBe(400)

  const feedback = await largeApi.post(`/api/v1/risks/${riskId}/feedback`, {
    headers: h,
    data: { verdict: 'TRUE_POSITIVE', note: XSS_SCRIPT },
  })
  expect(feedback.status()).toBe(201)
  const feedbackAgain = await largeApi.post(`/api/v1/risks/${riskId}/feedback`, {
    headers: h,
    data: { verdict: 'FALSE_POSITIVE', reason: 'OTHER' },
  })
  note(
    `повторная оценка → ${feedbackAgain.status()} ${feedbackAgain.status() >= 400 ? await errorCode(feedbackAgain) : ''}`,
  )
  const feedbackBad = await largeApi.post(`/api/v1/risks/${riskId}/feedback`, {
    headers: h,
    data: { verdict: 'FALSE_POSITIVE' },
  })
  note(
    `ложное срабатывание без причины → ${feedbackBad.status()} ${feedbackBad.status() >= 400 ? await errorCode(feedbackBad) : ''}`,
  )

  expect((await largeApi.post(`/api/v1/risks/${riskId}/resolve`, { headers: h })).status()).toBe(
    200,
  )
  const afterResolve = await largeApi.post(`/api/v1/risks/${riskId}/actions`, {
    headers: { ...h, 'Idempotency-Key': randomUUID() },
    data: { type: 'OTHER' },
  })
  note(
    `действие после закрытия риска → ${afterResolve.status()} ${afterResolve.status() >= 400 ? await errorCode(afterResolve) : ''}`,
  )
  if (afterResolve.status() < 400)
    finding(
      'сервер принимает запись действия по закрытому риску (201): инвариант «закрытый риск только для чтения» держится только интерфейсом',
    )
  const resolveAgain = await largeApi.post(`/api/v1/risks/${riskId}/resolve`, { headers: h })
  note(
    `повторное закрытие → ${resolveAgain.status()} ${resolveAgain.status() >= 400 ? await errorCode(resolveAgain) : ''}`,
  )
  const detail = await json<{ risk: { status: string } }>(
    await largeApi.get(`/api/v1/risks/${riskId}`, { headers: h }),
  )
  note(
    `итоговый статус риска после оценок и закрытия: ${detail.risk.status} (вторая оценка FALSE_POSITIVE закрывает риск как ложный)`,
  )
  expect(['RESOLVED', 'FALSE_POSITIVE']).toContain(detail.risk.status)
  const detailText = await (await largeApi.get(`/api/v1/risks/${riskId}`, { headers: h })).text()
  note(
    `заметка действия с <script> возвращается как текст JSON: ${detailText.includes('window.__xss') ? 'да' : 'нет (заметки нет в read model)'}`,
  )
})

test('API: команда — последний владелец, роли, приглашения', async () => {
  const h = tenant(tenantA)
  const selfDemote = await ownerApi.patch(`/api/v1/organization/members/${ownerId}`, {
    headers: h,
    data: { role: 'MANAGER' },
  })
  expect(selfDemote.status(), 'единственный владелец не понижает себя').toBe(409)
  expect(await errorCode(selfDemote)).toBe('LAST_OWNER')
  const selfRevoke = await ownerApi.delete(`/api/v1/organization/members/${ownerId}`, {
    headers: h,
  })
  expect(selfRevoke.status(), 'единственный владелец не отзывает себя').toBe(409)
  expect(
    (
      await ownerApi.patch(`/api/v1/organization/members/${managerId}`, {
        headers: h,
        data: { role: 'OWNER' },
      })
    ).status(),
  ).toBe(200)
  expect(
    (
      await ownerApi.patch(`/api/v1/organization/members/${managerId}`, {
        headers: h,
        data: { role: 'OWNER' },
      })
    ).status(),
    'та же роль повторно',
  ).toBeLessThan(500)
  expect(
    (
      await ownerApi.patch(`/api/v1/organization/members/${managerId}`, {
        headers: h,
        data: { role: 'MANAGER' },
      })
    ).status(),
  ).toBe(200)
  expect(
    (
      await ownerApi.patch(`/api/v1/organization/members/${managerId}`, {
        headers: h,
        data: { role: 'ADMIN' },
      })
    ).status(),
  ).toBe(400)
  expect(
    (
      await ownerApi.patch(`/api/v1/organization/members/${randomUUID()}`, {
        headers: h,
        data: { role: 'MANAGER' },
      })
    ).status(),
  ).toBe(404)
  expect(
    (
      await ownerApi.delete(`/api/v1/organization/members/${randomUUID()}`, { headers: h })
    ).status(),
  ).toBe(404)
  const manager2Managing = await managerApi.patch(`/api/v1/organization/members/${ownerId}`, {
    headers: h,
    data: { role: 'MANAGER' },
  })
  expect(manager2Managing.status(), 'менеджер не меняет роли').toBe(403)

  expect(
    (
      await managerApi.post('/api/v1/invitations/accept', { data: { code: invitationCode } })
    ).status(),
    'код второй раз',
  ).toBeGreaterThanOrEqual(400)
  expect(
    (await managerApi.post('/api/v1/invitations/accept', { data: { code: 'short' } })).status(),
  ).toBe(400)
  expect(
    (
      await managerApi.post('/api/v1/invitations/accept', {
        data: { code: randomBytes(32).toString('base64url').slice(0, 43) },
      })
    ).status(),
  ).toBe(404)
  const listed = await ownerApi.get('/api/v1/organization/invitations', { headers: h })
  expect(listed.status()).toBe(200)
  expect((await listed.text()).includes(invitationCode), 'код не отдаётся в списке').toBe(false)
  const pending = await ownerApi.post('/api/v1/organization/invitations', {
    headers: h,
    data: { role: 'OWNER' },
  })
  expect(pending.status()).toBe(201)
  const pendingBody = await json<{ invitation: { id: string }; code: string }>(pending)
  expect(
    (
      await ownerApi.delete(`/api/v1/organization/invitations/${pendingBody.invitation.id}`, {
        headers: h,
      })
    ).status(),
  ).toBe(204)
  const revokedAccept = await managerApi.post('/api/v1/invitations/accept', {
    data: { code: pendingBody.code },
  })
  note(`принятие отозванного кода → ${revokedAccept.status()} ${await errorCode(revokedAccept)}`)
  expect.soft([404, 409, 410]).toContain(revokedAccept.status())
  const grant = await ownerApi.post('/api/v1/organization/ml-consent', { headers: h })
  expect(grant.status()).toBe(201)
  expect(
    (await ownerApi.post('/api/v1/organization/ml-consent', { headers: h })).status(),
    'повторная выдача',
  ).toBe(200)
  expect((await ownerApi.delete('/api/v1/organization/ml-consent', { headers: h })).status()).toBe(
    204,
  )
  const revokeAgain = await ownerApi.delete('/api/v1/organization/ml-consent', { headers: h })
  note(`повторный отзыв согласия → ${revokeAgain.status()}`)
})

test('UI: владелец — опасные имена экранируются, длинные слова не ломают раскладку', async ({
  browser,
}) => {
  test.setTimeout(300_000)
  const context = await browserFor(browser, ownerApi, { userId: ownerId, tenantId: tenantA })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/radar')
  await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
  const switcher = page.getByRole('combobox', { name: 'Рабочее пространство' })
  await expect(switcher).toHaveValue(tenantA)
  expect(await switcher.locator('option:checked').textContent()).toContain(
    '<script>window.__xss=2</script>',
  )
  expect(
    await page.locator('script', { hasText: 'window.__xss' }).count(),
    'скрипт из имени не вставлен в DOM',
  ).toBe(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  expect(await page.locator('img[src="x"]').count(), 'вставленный img не появился').toBe(0)
  await noPageScroll(page, 'Radar A 1440')
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/radar')
  await page.getByRole('button', { name: 'Меню' }).click()
  await expect(page.getByRole('dialog', { name: 'Меню' })).toBeVisible()
  expect(await page.locator('script', { hasText: 'window.__xss' }).count()).toBe(0)
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto('/settings/company')
  await expect(page.getByLabel('Название компании')).toHaveValue(
    /<script>window\.__xss=2<\/script>/,
  )
  await expect(page.getByText('Точка <img', { exact: false }).first()).toBeVisible()
  await page.goto('/settings/services')
  await expect(page.getByRole('table', { name: 'Услуги организации' })).toContainText(
    'Полировка <img',
  )
  await page.goto('/settings/team')
  await expect(page.getByText('QA Владелец <img', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('QA Менеджер', { exact: false }).first()).toBeVisible()
  await page.goto('/integrations')
  await expect(page.getByText('Форма сайта <b>qa</b>', { exact: false }).first()).toBeVisible()
  expect(
    await page.locator('b', { hasText: 'qa' }).count(),
    'HTML в имени подключения не интерпретируется',
  ).toBe(0)

  await page.goto('/conversations')
  const list = page.getByRole('list', { name: 'Список диалогов' })
  await expect(list).toBeVisible()
  test.skip(!conversationA, 'переписки не были созданы')
  await expect(list).toContainText('Ирина <img')
  await page.goto(`/conversations/${conversationA}`)
  const thread = page.getByRole('region', { name: 'Сообщения' })
  await expect(thread).toBeVisible()
  await expect(thread).toContainText('<script>window.__xss=2</script>')
  const threadText = (await thread.textContent()) ?? ''
  note(
    `удалённое сообщение подписано: ${/удален/i.test(threadText) ? 'да' : 'нет — текст ' + (threadText.includes('ДДДД') ? 'ещё виден' : 'скрыт без подписи')}`,
  )
  note(`правка сообщения отражена: ${threadText.includes('(исправлено)') ? 'да' : 'нет'}`)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  expect(await page.locator('img[src="x"]').count()).toBe(0)
  await noPageScroll(page, 'переписка 1440')

  await page.setViewportSize({ width: 375, height: 812 })
  for (const path of [
    '/radar',
    '/conversations',
    `/conversations/${conversationA}`,
    '/settings/company',
    '/settings/team',
    '/settings/services',
    '/integrations',
    '/settings/privacy',
  ]) {
    await page.goto(path)
    await page.waitForTimeout(900)
    await noPageScroll(page, `${path} 375`)
  }
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/settings/team')
  await page.waitForTimeout(900)
  await noPageScroll(page, '/settings/team 320')
  expect(errors, 'ошибки JS').toEqual([])
  await context.close()
})

test('UI: переключение организаций и подмена сохранённого выбора', async ({ browser }) => {
  test.setTimeout(300_000)
  const context = await browserFor(browser, ownerApi)
  const page = await context.newPage()
  const tenants: string[] = []
  page.on('request', (item) => {
    if (!item.url().includes('/api/v1/')) return
    const header = item.headers()['x-tenant-id']
    if (header) tenants.push(header)
  })
  await page.goto('/radar')
  await expect(page).toHaveURL(/\/workspaces/)
  const workspaces = page.getByRole('list', { name: 'Рабочие пространства' })
  await expect(workspaces).toBeVisible()
  await axeCheck(page, 'выбор пространства')
  await workspaces.getByRole('button').filter({ hasText: 'QA <script>' }).first().click()
  await expect(page).toHaveURL(/\/radar/)
  await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
  await page.waitForTimeout(1000)
  expect([...new Set(tenants)], 'до переключения все запросы к A').toEqual([tenantA])

  tenants.length = 0
  await page.getByRole('combobox', { name: 'Рабочее пространство' }).selectOption(tenantB)
  await expect(page.getByRole('combobox', { name: 'Рабочее пространство' })).toHaveValue(tenantB)
  await page.waitForTimeout(1500)
  expect([...new Set(tenants)], 'после переключения все запросы к B').toEqual([tenantB])
  await noPageScroll(page, 'Radar B длинное имя 1440')
  await page.setViewportSize({ width: 320, height: 640 })
  await page.waitForTimeout(600)
  await noPageScroll(page, 'Radar B 320')
  await page.getByRole('button', { name: 'Меню' }).click()
  await page.waitForTimeout(400)
  await noPageScroll(page, 'меню с длинным именем 320')
  await page.keyboard.press('Escape')

  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [
    `lidradar.tenant.${ownerId}`,
    tenantLarge,
  ] as const)
  tenants.length = 0
  await page.goto('/radar')
  await page.waitForTimeout(2000)
  expect(tenants.includes(tenantLarge), 'подменённый tenant не отправляется').toBe(false)
  note(`после подмены localStorage чужим tenant приложение открыло ${new URL(page.url()).pathname}`)
  await context.close()
})

test('UI: менеджер — разделы по правам и нейтральные отказы', async ({ browser }) => {
  test.setTimeout(300_000)
  const context = await browserFor(browser, managerApi)
  const page = await context.newPage()
  await page.goto('/settings')
  await expect(page).toHaveURL(/\/settings\/notifications/)
  const nav = page.getByRole('navigation', { name: 'Разделы' })
  await expect(nav.getByRole('link', { name: 'Radar' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Аналитика' })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Интеграции' })).toHaveCount(0)
  const adminRequests: string[] = []
  page.on('request', (item) => {
    if (item.url().includes('/api/v1/admin')) adminRequests.push(new URL(item.url()).pathname)
  })
  for (const path of [
    '/analytics',
    '/integrations',
    '/settings/company',
    '/settings/services',
    '/settings/team',
    '/admin',
    '/admin/dead-letters',
  ]) {
    await page.goto(path)
    await expect(page.getByText('Раздел недоступен'), path).toBeVisible()
  }
  expect([...new Set(adminRequests)], 'без права — только /admin/me').toEqual(['/api/v1/admin/me'])
  await page.goto('/settings/privacy')
  await expect(page.getByRole('button', { name: 'Дать согласие' })).toHaveCount(0)
  await expect(page.getByText(/владелец/i).first()).toBeVisible()
  await page.goto('/radar')
  await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
  await axeCheck(page, 'Radar менеджера в пустой организации')
  await page.goto('/settings/notifications')
  await axeCheck(page, 'уведомления менеджера')
  await context.close()
})

test('UI: потеря членства во время сеанса', async ({ browser }) => {
  test.setTimeout(300_000)
  const context = await browserFor(browser, managerApi)
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/settings/notifications')
  const rows = page.getByRole('list', { name: 'Настройки по типам рисков' })
  await expect(rows).toBeVisible()
  expect(
    (
      await ownerApi.delete(`/api/v1/organization/members/${managerId}`, {
        headers: tenant(tenantA),
      })
    ).status(),
  ).toBe(204)
  const first = rows.getByRole('listitem').first()
  await first.locator('summary').click()
  await first.getByLabel('Минимальная важность').selectOption({ index: 1 })
  await first.getByRole('button', { name: 'Сохранить' }).click()
  await page.waitForTimeout(3500)
  const alerts = (await page.getByRole('alert').allTextContents())
    .map((text) => text.trim())
    .filter(Boolean)
  note(
    `после отзыва доступа: адрес ${new URL(page.url()).pathname}; сообщения: ${alerts.join(' / ') || 'нет'}`,
  )
  expect
    .soft(alerts.join(' ').includes('lidradar_session'), 'нет утечки технических деталей')
    .toBe(false)
  await page.reload()
  await page.waitForTimeout(2500)
  note(`после перезагрузки бывший менеджер попадает на ${new URL(page.url()).pathname}`)
  expect.soft(new URL(page.url()).pathname).toMatch(/\/onboarding\/company|\/workspaces|\/login/)
  expect(errors, 'ошибки JS').toEqual([])
  await context.close()
})

test('UI: диалог услуги — двойная отправка и клиентская валидация', async ({ browser }) => {
  test.setTimeout(300_000)
  const context = await browserFor(browser, ownerApi, { userId: ownerId, tenantId: tenantA })
  const page = await context.newPage()
  let posts = 0
  await page.route('**/api/v1/services', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    posts += 1
    const response = await route.fetch()
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.fulfill({ response })
  })
  await page.goto('/settings/services')
  await page.getByRole('button', { name: 'Добавить услугу' }).click()
  const dialog = page.getByRole('dialog', { name: 'Новая услуга' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Название услуги').fill('Двойной клик')
  await dialog.getByLabel('Цена от').fill('12,5')
  const submit = dialog.getByRole('button', { name: /Создать|Сохранить|Добавить/ })
  await submit.dblclick()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
  note(`двойной клик в диалоге услуги: POST=${posts}`)
  if (posts > 1)
    finding(
      'диалог «Новая услуга» отправляет два POST на двойной клик — создаются две одинаковые услуги (нет синхронного замка, как в диалоге подключения)',
    )
  expect.soft(posts, 'один POST на двойной клик').toBe(1)
  await expect(page.getByRole('table', { name: 'Услуги организации' })).toContainText(
    'Двойной клик',
  )
  await expect(page.getByRole('table', { name: 'Услуги организации' })).toContainText('12,50')

  await page.getByRole('button', { name: 'Добавить услугу' }).click()
  const second = page.getByRole('dialog', { name: 'Новая услуга' })
  await second.getByLabel('Название услуги').fill('Ошибка цен')
  await second.getByLabel('Цена от').fill('2000')
  await second.getByLabel('Цена до').fill('1000')
  const before = posts
  await second.getByRole('button', { name: /Создать|Сохранить|Добавить/ }).click()
  await page.waitForTimeout(1200)
  const messages = (
    await second
      .locator('[role="alert"], [id$="error"], p.text-danger, .text-danger')
      .allTextContents()
  )
    .map((t) => t.trim())
    .filter(Boolean)
  note(
    `диапазон наоборот: POST=${posts - before}; сообщения формы: ${messages.join(' / ') || 'нет'}`,
  )
  expect.soft(posts - before, 'заведомо неверный диапазон не отправляется').toBe(0)
  await second.getByLabel('Цена до').fill('')
  await second.getByLabel('Цена от').fill('abc')
  await second.getByRole('button', { name: /Создать|Сохранить|Добавить/ }).click()
  await page.waitForTimeout(800)
  expect.soft(posts - before, 'буквы в цене не отправляются').toBe(0)
  await second.getByLabel('Цена от').fill('1')
  await second.getByLabel('Название услуги').fill('Ж'.repeat(201))
  await second.getByRole('button', { name: /Создать|Сохранить|Добавить/ }).click()
  await page.waitForTimeout(1500)
  const tooLong = (
    await second.locator('[role="alert"], [id$="error"], .text-danger').allTextContents()
  )
    .map((t) => t.trim())
    .filter(Boolean)
  note(
    `имя 201 символ: POST=${posts - before}; сообщения: ${tooLong.join(' / ') || 'нет'}; диалог ${(await second.isVisible()) ? 'открыт' : 'закрыт'}`,
  )
  await page.keyboard.press('Escape')

  // Точка: тот же класс формы без замка.
  let locationPosts = 0
  await page.route('**/api/v1/locations', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    locationPosts += 1
    const response = await route.fetch()
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.fulfill({ response })
  })
  await page.goto('/settings/company')
  await page.getByRole('button', { name: 'Добавить точку' }).click()
  const locationDialog = page.getByRole('dialog', { name: 'Новая точка' })
  await locationDialog.getByLabel('Название точки').fill('Точка двойного клика')
  const locationSubmit = locationDialog.getByRole('button', { name: /Создать|Сохранить|Добавить/ })
  await locationSubmit.dblclick()
  await expect(locationDialog).toBeHidden({ timeout: 15_000 })
  note(`двойной клик в диалоге точки: POST=${locationPosts}`)
  if (locationPosts > 1)
    finding('диалог «Новая точка» отправляет два POST на двойной клик (дубликат точки)')
  expect.soft(locationPosts, 'один POST на двойной клик (точка)').toBe(1)

  // График через полночь: сервер отвечает 400 — форма должна объяснить.
  const openInput = page.getByLabel('Понедельник, открытие')
  if (await openInput.count()) {
    await openInput.fill('22:00')
    await page.getByLabel('Понедельник, закрытие').fill('06:00')
    await page.getByRole('button', { name: 'Сохранить график' }).click()
    await page.waitForTimeout(2000)
    const hoursMessages = (await page.getByRole('alert').allTextContents())
      .map((t) => t.trim())
      .filter(Boolean)
    const inline = (await page.locator('[id$="error"], .text-danger').allTextContents())
      .map((t) => t.trim())
      .filter(Boolean)
    note(
      `график 22:00–06:00 в форме: сообщения ${[...hoursMessages, ...inline].join(' / ') || 'нет'}`,
    )
    await page.reload()
  } else {
    note('поле «Понедельник, открытие» не найдено — проверка графика через полночь пропущена')
  }
  await context.close()

  // Оценка сигнала: POST без ключа идемпотентности.
  const large = await browserFor(browser, largeApi, { userId: largeUserId, tenantId: tenantLarge })
  const largePage = await large.newPage()
  const target = largeRisks.find(
    (item) => item.risk.status === 'OPEN' && !mutatedRisks.includes(item.risk.id),
  )
  if (target) {
    mutatedRisks.push(target.risk.id)
    let feedbackPosts = 0
    await largePage.route('**/api/v1/risks/*/feedback', async (route) => {
      feedbackPosts += 1
      const response = await route.fetch()
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.fulfill({ response })
    })
    await largePage.goto(`/risks/${target.risk.id}`)
    await largePage.getByRole('radio', { name: /Риск подтвердился/ }).check()
    await largePage.getByRole('button', { name: 'Записать оценку' }).dblclick()
    await largePage.waitForTimeout(4000)
    note(`двойной клик «Записать оценку»: POST=${feedbackPosts}`)
    if (feedbackPosts > 1)
      finding(
        'панель оценки сигнала отправляет две оценки на двойной клик (у запроса нет ключа идемпотентности)',
      )
    expect.soft(feedbackPosts, 'одна оценка на двойной клик').toBe(1)
  }
  await large.close()
})

test('UI: подделанные адреса не ломают страницы', async ({ browser }) => {
  test.setTimeout(300_000)
  const context = await browserFor(browser, largeApi, {
    userId: largeUserId,
    tenantId: tenantLarge,
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const probes: [string, RegExp | string][] = [
    ['/radar?severity=BOGUS&riskType=NOPE&limit=100000&locationId=zzz', 'Radar'],
    ['/radar?cursor=%00%ff', 'Radar'],
    ['/analytics?from=2026-13-40&to=zzz', 'Аналитика'],
    ['/analytics?from=2020-01-01&to=2026-09-25', 'Аналитика'],
    ['/analytics?from=2026-09-20&to=2026-09-01', 'Аналитика'],
    [`/conversations?search=${'x'.repeat(101)}&withRisk=maybe`, 'Диалоги'],
    ['/conversations?search=%3Cscript%3Ealert(1)%3C/script%3E', 'Диалоги'],
    ['/risks/not-a-uuid', /не найден/i],
    ['/risks/00000000-0000-4000-8000-000000000000', /не найден|отсутствует или недоступен/i],
    [`/conversations/${randomUUID()}`, /не найдена/i],
    ['/settings/notifications?tab=%3Cimg%20src%3Dx%3E', 'Уведомления'],
    ['/admin/trace?tenantId=%27&messageId=%22', 'Раздел недоступен'],
  ]
  for (const [path, marker] of probes) {
    await page.goto(path)
    await page.waitForTimeout(1500)
    const visible =
      typeof marker === 'string'
        ? await page.getByText(marker, { exact: false }).first().isVisible()
        : await page.getByText(marker).first().isVisible()
    const alerts = (await page.getByRole('alert').allTextContents())
      .map((t) => t.trim())
      .filter(Boolean)
    note(
      `${path} → ${visible ? 'страница жива' : 'ОЖИДАЕМЫЙ ТЕКСТ НЕ НАЙДЕН'}; ${alerts.length ? 'сообщения: ' + alerts.join(' / ') : 'без сообщений'}`,
    )
    expect.soft(visible, `страница ${path}`).toBe(true)
  }
  await page.goto('/login?redirect=https://evil.example')
  await page.waitForTimeout(1200)
  expect(new URL(page.url()).pathname, 'авторизованный не остаётся на входе').not.toBe('/login')
  expect(errors, 'ошибки JS').toEqual([])
  await context.close()
})

test('UI: клавиатура и фокус — вход, диалог оплаты, мобильное меню', async ({ browser }) => {
  test.setTimeout(300_000)
  const guest = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const loginPage = await guest.newPage()
  await loginPage.goto('/login')
  await expect(loginPage.getByLabel('Электронная почта')).toBeVisible()
  const sequence: string[] = []
  for (let step = 0; step < 6; step += 1) {
    await loginPage.keyboard.press('Tab')
    sequence.push(
      await loginPage.evaluate(() => {
        const element = document.activeElement as HTMLElement | null
        if (!element) return 'нет'
        const label =
          element.getAttribute('aria-label') ??
          element.getAttribute('name') ??
          element.textContent?.trim().slice(0, 24) ??
          ''
        const ring =
          getComputedStyle(element).outlineStyle !== 'none' ||
          getComputedStyle(element).boxShadow !== 'none'
        return `${element.tagName.toLowerCase()}[${label}]${ring ? '' : '(без видимого фокуса)'}`
      }),
    )
  }
  note(`порядок Tab на входе: ${sequence.join(' → ')}`)
  expect
    .soft(
      sequence.some((item) => item.includes('(без видимого фокуса)') && !item.startsWith('body')),
      'видимый фокус на каждом шаге',
    )
    .toBe(false)
  await guest.close()

  const context = await browserFor(browser, largeApi, {
    userId: largeUserId,
    tenantId: tenantLarge,
  })
  const page = await context.newPage()
  const candidate = largeRisks.find(
    (item) =>
      item.opportunity && !mutatedRisks.includes(item.risk.id) && item.risk.status !== 'RESOLVED',
  )
  test.skip(!candidate, 'нет подходящего риска')
  await page.goto(`/risks/${candidate!.risk.id}`)
  const trigger = page.getByRole('button', { name: 'Подтвердить оплату' })
  await expect(trigger).toBeVisible()
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Подтвердить оплату' })
  await expect(dialog).toBeVisible()
  const inside = () =>
    page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)
  expect(await inside(), 'фокус внутри диалога при открытии').toBe(true)
  for (let step = 0; step < 14; step += 1) await page.keyboard.press('Tab')
  expect(await inside(), 'ловушка фокуса удерживает Tab').toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expect(
    await page.evaluate(() => document.activeElement?.textContent?.trim()),
    'фокус вернулся на кнопку',
  ).toBe('Подтвердить оплату')
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/radar')
  const menu = page.getByRole('button', { name: 'Меню' })
  await menu.focus()
  await page.keyboard.press('Enter')
  const menuDialog = page.getByRole('dialog', { name: 'Меню' })
  await expect(menuDialog).toBeVisible()
  expect(await inside(), 'фокус в меню').toBe(true)
  await page.keyboard.press('Escape')
  await expect(menuDialog).toBeHidden()
  expect(
    await page.evaluate(() => document.activeElement?.textContent?.trim()),
    'фокус вернулся на «Меню»',
  ).toBe('Меню')
  await context.close()
})

test('UI: офлайн и восстановление потока', async ({ browser }) => {
  test.setTimeout(300_000)
  const context = await browserFor(browser, largeApi, {
    userId: largeUserId,
    tenantId: tenantLarge,
  })
  const page = await context.newPage()
  await page.goto('/radar')
  const status = page.getByText(/Обновления|Нет сети|Подключаем/).first()
  await expect(status).toHaveText(/Обновления онлайн/, { timeout: 15_000 })
  const feed = page.getByRole('list', { name: 'Список активных рисков' })
  await expect(feed).toBeVisible()
  await context.setOffline(true)
  await expect(status).not.toHaveText(/Обновления онлайн/, { timeout: 45_000 })
  note(`офлайн: индикатор «${(await status.textContent())?.trim()}»`)
  await expect(feed, 'данные остаются на экране офлайн').toBeVisible()
  await page.getByRole('link', { name: 'Диалоги' }).click()
  await page.waitForTimeout(4000)
  const alerts = (await page.getByRole('alert').allTextContents())
    .map((t) => t.trim())
    .filter(Boolean)
  const statuses = (await page.getByRole('status').allTextContents())
    .map((t) => t.trim())
    .filter(Boolean)
  const loading = await page.locator('[aria-label^="Загрузка"]').count()
  note(
    `переход офлайн на «Диалоги»: alert: ${alerts.join(' / ') || 'нет'}; status: ${statuses.join(' / ') || 'нет'}; скелетов загрузки: ${loading}; список виден: ${await page.getByRole('list', { name: 'Список диалогов' }).isVisible()}`,
  )
  if (!alerts.length && loading > 0)
    finding(
      'офлайн-переход на незагруженный раздел оставляет скелет загрузки без сообщения об ошибке и кнопки «Повторить»',
    )
  await context.setOffline(false)
  await page.goto('/radar')
  await expect(status).toHaveText(/Обновления онлайн/, { timeout: 60_000 })
  await context.close()
})

test('UI: гонка при смене этапа сходится к серверу', async ({ browser }) => {
  test.setTimeout(300_000)
  const candidate = largeRisks.find(
    (item) =>
      item.opportunity?.stage === 'NEW' &&
      item.risk.status === 'OPEN' &&
      !mutatedRisks.includes(item.risk.id),
  )
  test.skip(!candidate, 'нет второй сделки на этапе NEW')
  mutatedRisks.push(candidate!.risk.id)
  const context = await browserFor(browser, largeApi, {
    userId: largeUserId,
    tenantId: tenantLarge,
  })
  const page = await context.newPage()
  await page.goto(`/risks/${candidate!.risk.id}`)
  const region = page.getByRole('region', { name: 'Переписка и сделка' })
  await expect(region.getByTestId('opportunity-stage')).toHaveText('Новая')
  const select = region.getByLabel('Перевести на этап')
  await select.selectOption('ENGAGED')
  expect(
    (
      await largeApi.patch(`/api/v1/opportunities/${candidate!.opportunity!.id}`, {
        headers: tenant(tenantLarge),
        data: { stage: 'QUALIFYING' },
      })
    ).status(),
  ).toBe(200)
  await region
    .getByRole('button', { name: 'Перевести' })
    .click({ timeout: 5000 })
    .catch(() => note('кнопка «Перевести» уже отключена: сигнал потока опередил клик'))
  await page.waitForTimeout(3000)
  const alerts = (await page.getByRole('alert').allTextContents())
    .map((t) => t.trim())
    .filter(Boolean)
  const stage = await region.getByTestId('opportunity-stage').textContent()
  note(
    `гонка этапа: экран показывает «${stage?.trim()}», сообщения: ${alerts.join(' / ') || 'нет'}`,
  )
  expect.soft(stage?.trim(), 'этап сошёлся к серверному «Уточнение»').toBe('Уточнение')
  const options = await select
    .locator('option')
    .evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value).filter(Boolean))
  expect.soft(options.includes('ENGAGED'), 'назад в «В диалоге» не предлагается').toBe(false)
  await context.close()
})

test('UI: доступность с реальными данными (axe)', async ({ browser }) => {
  test.setTimeout(300_000)
  const context = await browserFor(browser, largeApi, {
    userId: largeUserId,
    tenantId: tenantLarge,
  })
  const page = await context.newPage()
  const risk = largeRisks.find(
    (item) => item.opportunity && item.conversation && !mutatedRisks.includes(item.risk.id),
  )!
  const routes = [
    '/radar',
    `/risks/${risk.risk.id}`,
    '/conversations',
    `/conversations/${risk.conversation!.id}`,
    '/analytics',
    '/integrations',
    '/settings/company',
    '/settings/services',
    '/settings/notifications',
    '/settings/team',
    '/settings/privacy',
  ]
  for (const path of routes) {
    await page.goto(path)
    await page.waitForTimeout(1500)
    await axeCheck(page, `${path} 1440`)
  }
  await page.setViewportSize({ width: 375, height: 812 })
  for (const path of [
    '/radar',
    `/risks/${risk.risk.id}`,
    `/conversations/${risk.conversation!.id}`,
    '/settings/team',
    '/analytics',
  ]) {
    await page.goto(path)
    await page.waitForTimeout(1500)
    await axeCheck(page, `${path} 375`)
    await noPageScroll(page, `${path} 375 (large)`)
  }
  await page.goto('/radar')
  await page.getByRole('button', { name: 'Меню' }).click()
  await page.waitForTimeout(400)
  await axeCheck(page, 'открытое меню 375')
  await context.close()

  const owner = await browserFor(browser, ownerApi, { userId: ownerId, tenantId: tenantB })
  const ownerPage = await owner.newPage()
  for (const path of [
    '/onboarding',
    '/onboarding/location',
    '/onboarding/services',
    '/onboarding/channel',
    '/invitations/accept',
  ]) {
    await ownerPage.goto(path)
    await ownerPage.waitForTimeout(1200)
    await axeCheck(ownerPage, `${path} (организация без данных)`)
  }
  await owner.close()

  const guest = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const guestPage = await guest.newPage()
  for (const path of ['/login', '/register']) {
    await guestPage.goto(path)
    await guestPage.waitForTimeout(800)
    await axeCheck(guestPage, path)
  }
  await guest.close()
})

test('UI: вход — подмена redirect и одинаковый текст ошибок', async ({ browser }) => {
  test.setTimeout(300_000)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto('/login?redirect=https://evil.example/phish')
  await page.getByLabel('Электронная почта').fill(state.managerEmail)
  await page.getByLabel('Пароль', { exact: true }).fill('definitely-wrong-password')
  await page.keyboard.press('Enter')
  const wrongAlert = (
    await page.getByRole('alert').first().textContent({ timeout: 10_000 })
  )?.trim()
  await page.getByLabel('Электронная почта').fill(`nobody-${Date.now()}@lidradar.test`)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2000)
  const unknownAlert = (await page.getByRole('alert').first().textContent())?.trim()
  note(`текст ошибки входа: «${wrongAlert}» / для чужого адреса: «${unknownAlert}»`)
  expect.soft(unknownAlert).toBe(wrongAlert)
  expect
    .soft(wrongAlert ?? '', 'сообщение не раскрывает причину')
    .not.toMatch(/не найден|не существует|неверный пароль/i)
  await page.getByLabel('Электронная почта').fill(state.managerEmail)
  await page.getByLabel('Пароль', { exact: true }).fill(state.password)
  await page.keyboard.press('Enter')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
  expect(new URL(page.url()).origin, 'остались на своём origin').toBe(new URL(baseURL).origin)
  note(`после входа с redirect=https://evil.example попали на ${new URL(page.url()).pathname}`)
  await context.close()
})

test('API+UI: лимит попыток входа', async ({ browser }) => {
  test.setTimeout(300_000)
  let attempts = 0
  let limited: APIResponse | null = null
  for (let index = 0; index < 8; index += 1) {
    attempts += 1
    const response = await guestApi.post('/api/v1/auth/login', {
      data: { email: bruteEmail(), password: `wrong-${index}` },
    })
    if (response.status() === 429) {
      limited = response
      break
    }
    expect(response.status()).toBe(401)
  }
  note(
    `лимит входа по аккаунту: 429 на попытке ${attempts} этого теста (ранее в прогоне было ещё ~4 неудачных); Retry-After=${limited?.headers()['retry-after'] ?? '—'}`,
  )
  expect(limited, 'лимитер входа срабатывает').not.toBeNull()
  expect.soft(Number(limited!.headers()['retry-after'] ?? 0)).toBeGreaterThan(0)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto('/login')
  await page.getByLabel('Электронная почта').fill(bruteEmail())
  await page.getByLabel('Пароль', { exact: true }).fill('another-wrong-password')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /Войти через \d+ с/ })).toBeVisible({
    timeout: 10_000,
  })
  const alertText = (await page.getByRole('alert').first().textContent())?.trim()
  note(`интерфейс при 429: «${alertText}» и кнопка с обратным отсчётом`)
  await context.close()
})

test('UI: выход закрывает сессию и не оставляет данных', async ({ browser }) => {
  test.setTimeout(300_000)
  const api = await request.newContext({ baseURL })
  expect(
    (
      await api.post('/api/v1/auth/login', {
        data: { email: state.ownerEmail, password: state.password },
      })
    ).status(),
  ).toBe(200)
  const context = await browserFor(browser, api, { userId: ownerId, tenantId: tenantA })
  const page = await context.newPage()
  await page.goto('/settings/company')
  await expect(page.getByLabel('Название компании')).toBeVisible()
  await page.getByRole('button', { name: 'Выйти' }).click()
  await expect(page).toHaveURL(/\/login/)
  expect((await page.request.get('/api/v1/auth/me')).status(), 'сессия закрыта на сервере').toBe(
    401,
  )
  await page.goBack()
  await page.waitForTimeout(1200)
  expect(['/login', 'blank']).toContain(new URL(page.url()).pathname)
  await page.goto('/settings/company')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  note(
    `localStorage после выхода: ${await page.evaluate(() => Object.keys(localStorage).join(', ') || 'пусто')}`,
  )
  await api.dispose()
  await context.close()
})
