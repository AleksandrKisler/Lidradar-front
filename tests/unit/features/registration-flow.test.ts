import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { ApiError } from '@/shared/api'
import { fetchMe, register, registrationKeys } from '@/entities/session'
import {
  INVITATION_CHECK_RETRY_KEY,
  INVITATION_CONTEXT_KEY,
  INVITATION_CONTEXT_TTL_MS,
  useRegistrationFlow,
  type RegistrationFlow,
} from '@/features/auth-session'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

/**
 * Модель регистрации US-M01-01 (A/B2/B3/C): режим текущего входа, единая команда проверки кода,
 * гонки и поздние ответы, контекст вкладки, нейтральный отказ и неизвестный исход отправки.
 * Сеть подменяется на уровне `fetch`: проверяется и транспорт (тело, заголовки, отмена).
 */

/** Синтетические коды: 43 символа base64url, смешанный регистр. */
const CODE = 'Syn7hetic-Code_aaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const OTHER = 'Other-Synthetic_bbbbbbbbbbbbbbbbbbbbbbbbbbb'
const NOW = new Date('2026-10-29T10:00:00Z').getTime()
const VALUES = { displayName: 'Мария', email: 'maria@example.test', password: 'synthetic-pass-1' }

const user = {
  id: 'user-1',
  email: 'maria@example.test',
  displayName: 'Мария',
  status: 'ACTIVE' as const,
  createdAt: '2026-10-29T00:00:00Z',
  updatedAt: '2026-10-29T00:00:00Z',
  emailVerifiedAt: null,
  deletionDueAt: null,
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}
const envelope = (code: string) => ({ error: { code, message: 'server text', traceId: 't-1' } })

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

type Handler = (request: Request) => Promise<Response> | Response

let modeHandler: Handler
let checkHandler: Handler
let modeRequests: Request[]
let checkRequests: Array<{ request: Request; code: string }>
let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
let queryClient: QueryClient
let router: Router
let flow: RegistrationFlow
let wrapper: VueWrapper | null

const Harness = defineComponent({
  setup() {
    flow = useRegistrationFlow()
    return () => h('div')
  },
})

async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
  }
}

async function open(location: string): Promise<RegistrationFlow> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/register', name: 'register', component: { render: () => null } },
      { path: '/radar', name: 'radar', component: { render: () => null } },
      { path: '/login', name: 'login', component: { render: () => null } },
    ],
  })
  await router.push(location)
  await router.isReady()
  wrapper = mount(Harness, { global: { plugins: [router, [VueQueryPlugin, { queryClient }]] } })
  await flush()
  return flow
}

function storedContext(): Record<string, unknown> | null {
  const raw = sessionStorage.getItem(INVITATION_CONTEXT_KEY)
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>)
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  })
  vi.setSystemTime(NOW)
  setActivePinia(createPinia())
  sessionStorage.clear()
  localStorage.clear()
  vi.mocked(register).mockReset()
  vi.mocked(fetchMe).mockReset()
  vi.mocked(fetchMe).mockRejectedValue(new ApiError({ httpStatus: 401, code: 'UNAUTHENTICATED' }))
  queryClient = new QueryClient()
  modeRequests = []
  checkRequests = []
  modeHandler = () => json({ mode: 'open' })
  checkHandler = () => new Response(null, { status: 204 })
  fetchMock = vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname
    if (path === '/api/v1/auth/registration') {
      modeRequests.push(request)
      return modeHandler(request)
    }
    if (path === '/api/v1/auth/registration/invitation/check') {
      const body = (await request.clone().json()) as { code: string }
      checkRequests.push({ request, code: body.code })
      return checkHandler(request)
    }
    throw new Error(`неожиданный запрос ${path}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  wrapper = null
})

afterEach(() => {
  wrapper?.unmount()
  queryClient.clear()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('режим A/C: только ответ текущего входа (AC-G12, AC-C04)', () => {
  it('до ответа — каркас; open → A, invite_only → C', async () => {
    const gate = deferred<Response>()
    modeHandler = () => gate.promise
    await open('/register')
    expect(flow.view.value).toBe('mode-loading')
    gate.resolve(json({ mode: 'open' }))
    await flush()
    expect(flow.view.value).toBe('open')

    wrapper!.unmount()
    modeHandler = () => json({ mode: 'invite_only' })
    await open('/register')
    expect(flow.view.value).toBe('closed')
  })

  it('кешированный open не открывает A: нужен ответ этого входа, запрос один', async () => {
    queryClient.setQueryData(registrationKeys.mode, { mode: 'open' })
    const gate = deferred<Response>()
    modeHandler = () => gate.promise
    await open('/register')
    expect(flow.view.value).toBe('mode-loading')
    gate.resolve(json({ mode: 'invite_only' }))
    await flush()
    expect(flow.view.value).toBe('closed')
    expect(modeRequests).toHaveLength(1)
  })

  it('кешированный open и сбой свежего запроса — служебная ошибка, а не A', async () => {
    queryClient.setQueryData(registrationKeys.mode, { mode: 'open' })
    modeHandler = () => json(envelope('INTERNAL_ERROR'), 500)
    await open('/register')
    expect(flow.view.value).toBe('mode-error')
    await flow.submit(VALUES)
    expect(register).not.toHaveBeenCalled()
  })

  it.each([
    ['500', () => json(envelope('INTERNAL_ERROR'), 500)],
    ['сеть', () => Promise.reject(new TypeError('offline'))],
  ])('сбой режима (%s): служебная ошибка без автоповтора, ручной повтор', async (_name, fail) => {
    modeHandler = fail
    await open('/register')
    expect(flow.view.value).toBe('mode-error')
    expect(flow.modeError.value).toBeInstanceOf(ApiError)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(modeRequests).toHaveLength(1)
    modeHandler = () => json({ mode: 'open' })
    flow.retryMode()
    await flush()
    expect(flow.view.value).toBe('open')
    expect(modeRequests).toHaveLength(2)
  })

  it('таймаут режима — служебная ошибка, а не бесконечный каркас', async () => {
    modeHandler = (request) =>
      new Promise((_resolve, reject) =>
        request.signal.addEventListener('abort', () => reject(request.signal.reason)),
      )
    await open('/register')
    expect(flow.view.value).toBe('mode-loading')
    await vi.advanceTimersByTimeAsync(15_000)
    await flush()
    expect(flow.view.value).toBe('mode-error')
  })

  /** WebKit отклоняет отменённый fetch с `AbortError`, игнорируя причину `TimeoutError`. */
  const webkitHang: Handler = (request) =>
    new Promise((_resolve, reject) =>
      request.signal.addEventListener('abort', () =>
        reject(new DOMException('Fetch is aborted', 'AbortError')),
      ),
    )

  it('таймаут режима в WebKit (AbortError вместо TimeoutError) — служебная ошибка и ручной повтор', async () => {
    modeHandler = webkitHang
    await open('/register')
    await vi.advanceTimersByTimeAsync(15_000)
    await flush()
    expect(flow.view.value).toBe('mode-error')
    modeHandler = () => json({ mode: 'open' })
    flow.retryMode()
    await flush()
    expect(flow.view.value).toBe('open')
  })

  it('таймаут проверки кода в WebKit — служебный сбой, а не бесконечная проверка', async () => {
    checkHandler = webkitHang
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    await vi.advanceTimersByTimeAsync(15_000)
    await flush()
    expect(flow.codeStatus.value).toBe('service')
  })

  it('flow=invite не запрашивает режим; B2 доступен и при недоступном режиме', async () => {
    modeHandler = () => Promise.reject(new TypeError('offline'))
    await open('/register')
    expect(flow.view.value).toBe('mode-error')
    await router.push(flow.inviteLocation.value)
    await flush()
    expect(router.currentRoute.value.query).toEqual({ flow: 'invite' })
    expect(flow.view.value).toBe('invite-code')
    flow.inputCode(CODE)
    await vi.advanceTimersByTimeAsync(400)
    await flush()
    expect(flow.view.value).toBe('invite-details')
    expect(modeRequests).toHaveLength(1)
  })

  it('поздний ответ режима после перехода в B2 не меняет шаг; новый вход в A — новый запрос', async () => {
    const gate = deferred<Response>()
    modeHandler = () => gate.promise
    await open('/register')
    await router.push('/register?flow=invite')
    await flush()
    gate.resolve(json({ mode: 'open' }))
    await flush()
    expect(flow.view.value).toBe('invite-code')
    const second = deferred<Response>()
    modeHandler = () => second.promise
    await router.push('/register')
    await flush()
    expect(flow.view.value).toBe('mode-loading')
    second.resolve(json({ mode: 'invite_only' }))
    await flush()
    expect(flow.view.value).toBe('closed')
  })

  it('INVITATION_REQUIRED на отправке A: свежий режим, закрытое состояние, повтор без кода невозможен (AC-A04)', async () => {
    await open('/register')
    expect(flow.view.value).toBe('open')
    vi.mocked(register).mockRejectedValue(
      new ApiError({ httpStatus: 403, code: 'INVITATION_REQUIRED' }),
    )
    // Даже если GET ещё отвечает прежним open, устаревший режим не разрешает отправку без кода.
    await flow.submit(VALUES)
    await flush()
    expect(modeRequests).toHaveLength(2)
    expect(flow.view.value).toBe('closed')
    await flow.submit(VALUES)
    expect(register).toHaveBeenCalledTimes(1)
    expect(vi.mocked(register).mock.calls[0]![0]).not.toHaveProperty('inviteCode')
  })
})

describe('проверка кода: одна команда и тайминги (AC-B03…B06)', () => {
  it('ровно 400 мс после полного кода; тело — нормализованный код без X-Tenant-ID', async () => {
    await open('/register?flow=invite')
    flow.inputCode(` ${CODE.slice(0, 20)}\n${CODE.slice(20)} `)
    await vi.advanceTimersByTimeAsync(399)
    expect(checkRequests).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    await flush()
    expect(checkRequests).toHaveLength(1)
    const { request, code } = checkRequests[0]!
    expect(code).toBe(CODE)
    expect(request.method).toBe('POST')
    expect(request.headers.get('X-Tenant-ID')).toBeNull()
    expect(new URL(request.url).search).toBe('')
    expect(flow.view.value).toBe('invite-details')
  })

  it('IME: во время набора проверки нет, после завершения — через 400 мс', async () => {
    await open('/register?flow=invite')
    flow.inputCode(CODE, true)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(checkRequests).toHaveLength(0)
    flow.submitCode()
    await flush()
    expect(checkRequests).toHaveLength(0)
    flow.inputCode(CODE, false)
    await vi.advanceTimersByTimeAsync(400)
    await flush()
    expect(checkRequests).toHaveLength(1)
  })

  it('Enter/стрелка до таймера: сразу одна проверка, отложенная не дублирует', async () => {
    const gate = deferred<Response>()
    checkHandler = () => gate.promise
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    await vi.advanceTimersByTimeAsync(100)
    flow.submitCode()
    await flush()
    expect(checkRequests).toHaveLength(1)
    expect(flow.codeStatus.value).toBe('checking')
    // Во время запроса: повторные действия и ввод не создают второй запрос.
    flow.submitCode()
    flow.submitCode()
    flow.inputCode(OTHER)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(checkRequests).toHaveLength(1)
    expect(flow.code.value).toBe(CODE)
    gate.resolve(new Response(null, { status: 204 }))
    await flush()
    expect(flow.view.value).toBe('invite-details')
  })

  it('пустое, неполное и неверное значение — без запроса, с текстом шага', async () => {
    await open('/register?flow=invite')
    flow.submitCode()
    expect(flow.codeStatus.value).toBe('empty')
    flow.inputCode(CODE.slice(0, 42))
    expect(flow.codeStatus.value).toBe('idle')
    flow.submitCode()
    expect(flow.codeStatus.value).toBe('format')
    flow.inputCode(`${CODE}x`) // 44 символа: ошибка сразу
    expect(flow.codeStatus.value).toBe('format')
    flow.inputCode(`${CODE.slice(0, 42)}ж`) // кириллица
    expect(flow.codeStatus.value).toBe('format')
    flow.inputCode(`${CODE.slice(0, 42)}+`) // недопустимый знак
    expect(flow.codeStatus.value).toBe('format')
    await vi.advanceTimersByTimeAsync(5_000)
    expect(checkRequests).toHaveLength(0)
  })

  it('без ввода нет запроса; после ошибки нет автоповтора; правка возвращает исходное состояние', async () => {
    checkHandler = () => json(envelope('INVITATION_INVALID'), 403)
    await open('/register?flow=invite')
    await vi.advanceTimersByTimeAsync(5_000)
    expect(checkRequests).toHaveLength(0)
    flow.inputCode(CODE)
    await vi.advanceTimersByTimeAsync(400)
    await flush()
    expect(flow.codeStatus.value).toBe('invalid')
    expect(flow.code.value).toBe(CODE)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(checkRequests).toHaveLength(1)
    flow.inputCode(CODE.slice(0, 40))
    expect(flow.codeStatus.value).toBe('idle')
  })
})

describe('классификация ответа проверки (AC-B09, AC-G09)', () => {
  it('403 INVITATION_INVALID — отказ кода; B3 не открывается', async () => {
    checkHandler = () => json(envelope('INVITATION_INVALID'), 403)
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    expect(flow.codeStatus.value).toBe('invalid')
    expect(flow.view.value).toBe('invite-code')
  })

  it.each<[string, Handler]>([
    ['400 INVALID_ARGUMENT', () => json(envelope('INVALID_ARGUMENT'), 400)],
    ['403 ORIGIN_NOT_ALLOWED', () => json(envelope('ORIGIN_NOT_ALLOWED'), 403)],
    ['неожиданный 401', () => json(envelope('UNAUTHENTICATED'), 401)],
    ['404 старого API', () => json(envelope('ROUTE_NOT_FOUND'), 404)],
    ['500', () => json(envelope('INTERNAL_ERROR'), 500)],
    ['502 без конверта', () => new Response('<html>bad gateway</html>', { status: 502 })],
    ['нет сети', () => Promise.reject(new TypeError('offline'))],
    ['200 вместо 204', () => json({ ok: true })],
  ])('%s — служебный сбой без красного «!», B3 не открывается', async (_name, handler) => {
    checkHandler = handler
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    expect(flow.codeStatus.value).toBe('service')
    expect(flow.view.value).toBe('invite-code')
    expect(flow.code.value).toBe(CODE)
    // Ручной повтор доступен и уходит тем же путём.
    checkHandler = () => new Response(null, { status: 204 })
    flow.submitCode()
    await flush()
    expect(checkRequests).toHaveLength(2)
    expect(flow.view.value).toBe('invite-details')
  })

  it('таймаут проверки — служебный сбой, а не отказ кода', async () => {
    checkHandler = (request) =>
      new Promise((_resolve, reject) =>
        request.signal.addEventListener('abort', () => reject(request.signal.reason)),
      )
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    expect(flow.codeStatus.value).toBe('checking')
    await vi.advanceTimersByTimeAsync(15_000)
    await flush()
    expect(flow.codeStatus.value).toBe('service')
  })
})

describe('ограничение частоты проверки (AC-B05, AC-G09)', () => {
  it('429 с Retry-After: отсчёт, смена кода не обходит, по окончании без автозапроса', async () => {
    checkHandler = () => json(envelope('RATE_LIMITED'), 429, { 'Retry-After': '30' })
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    expect(flow.codeStatus.value).toBe('rate-limited')
    expect(flow.codeRetrySeconds.value).toBe(30)
    expect(Number(sessionStorage.getItem(INVITATION_CHECK_RETRY_KEY))).toBe(NOW + 30_000)
    checkHandler = () => new Response(null, { status: 204 })
    flow.inputCode(OTHER)
    await vi.advanceTimersByTimeAsync(400)
    flow.submitCode()
    await flush()
    expect(checkRequests).toHaveLength(1)
    expect(flow.codeStatus.value).toBe('rate-limited')
    await vi.advanceTimersByTimeAsync(30_000)
    await flush()
    expect(flow.codeStatus.value).toBe('idle')
    expect(checkRequests).toHaveLength(1)
    flow.submitCode()
    await flush()
    expect(checkRequests).toHaveLength(2)
    expect(checkRequests[1]!.code).toBe(OTHER)
  })

  it.each([
    ['нет заголовка', {}],
    ['неверный заголовок', { 'Retry-After': 'soon' }],
    ['ноль', { 'Retry-After': '0' }],
  ])('429, %s: запасной отсчёт 60 с', async (_name, headers) => {
    checkHandler = () => json(envelope('RATE_LIMITED'), 429, headers)
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    expect(flow.codeRetrySeconds.value).toBe(60)
  })

  it('ожидание переживает перезагрузку страницы', async () => {
    checkHandler = () => json(envelope('RATE_LIMITED'), 429, { 'Retry-After': '45' })
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    wrapper!.unmount()
    wrapper = null
    await vi.advanceTimersByTimeAsync(5_000)
    await open('/register?flow=invite')
    expect(flow.codeStatus.value).toBe('rate-limited')
    expect(flow.codeRetrySeconds.value).toBe(40)
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    expect(checkRequests).toHaveLength(1)
  })
})

describe('поздние ответы и отмена (AC-G09, AC-B08)', () => {
  it('переход в A во время проверки: запрос отменён, поздний 204 не открывает B3 и не пишет контекст', async () => {
    const gate = deferred<Response>()
    checkHandler = () => gate.promise
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    const { request } = checkRequests[0]!
    await router.push('/register')
    await flush()
    expect(request.signal.aborted).toBe(true)
    gate.resolve(new Response(null, { status: 204 }))
    await flush()
    expect(flow.view.value).toBe('open')
    expect(storedContext()).toBeNull()
  })

  it('уход со страницы: таймер и запрос отменены, поздний ответ ничего не сохраняет', async () => {
    const gate = deferred<Response>()
    checkHandler = () => gate.promise
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    await vi.advanceTimersByTimeAsync(200)
    wrapper!.unmount()
    wrapper = null
    await vi.advanceTimersByTimeAsync(1_000)
    expect(checkRequests).toHaveLength(0)

    await open('/register?flow=invite')
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    wrapper!.unmount()
    wrapper = null
    expect(checkRequests[0]!.request.signal.aborted).toBe(true)
    gate.resolve(new Response(null, { status: 204 }))
    await flush()
    expect(storedContext()).toBeNull()
  })

  it('новая ссылка во время проверки прежнего кода: поздний ответ отсечён, решает новая проверка', async () => {
    const first = deferred<Response>()
    checkHandler = () => first.promise
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    checkHandler = () => json(envelope('INVITATION_INVALID'), 403)
    await router.push(`/register?flow=invite&code=${OTHER}`)
    await flush()
    expect(flow.codeStatus.value).toBe('invalid')
    first.resolve(new Response(null, { status: 204 }))
    await flush()
    expect(flow.view.value).toBe('invite-code')
    expect(flow.code.value).toBe(OTHER)
    expect(storedContext()).toBeNull()
  })

  it('B3 → «другое приглашение»: пустой B2, подтверждение сброшено, B3 только после новой проверки', async () => {
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    expect(flow.view.value).toBe('invite-details')
    flow.useOtherInvitation()
    expect(flow.view.value).toBe('invite-code')
    expect(flow.code.value).toBe('')
    expect(storedContext()).toBeNull()
    await flow.submit(VALUES)
    expect(register).not.toHaveBeenCalled()
    flow.inputCode(OTHER)
    flow.submitCode()
    await flush()
    expect(flow.view.value).toBe('invite-details')
    expect(storedContext()).toMatchObject({ code: OTHER })
  })
})

describe('персональные ссылки (AC-B01, AC-B14)', () => {
  it.each(['/register?code=', '/register?flow=invite&code='])(
    '%s<код>&utm: код читается один раз и убирается replace, flow и прочие параметры остаются',
    async (prefix) => {
      await open(`${prefix}${CODE}&utm=mail#anchor`)
      expect(checkRequests.map((item) => item.code)).toEqual([CODE])
      expect(router.currentRoute.value.query).toEqual({ utm: 'mail', flow: 'invite' })
      expect(router.currentRoute.value.hash).toBe('#anchor')
      expect(router.currentRoute.value.fullPath).not.toContain(CODE)
      expect(flow.view.value).toBe('invite-details')
      // Очистка адреса не порождает повторной проверки.
      await vi.advanceTimersByTimeAsync(2_000)
      expect(checkRequests).toHaveLength(1)
      // Это была замена: назад в истории адреса с кодом нет.
      router.back()
      await flush()
      expect(router.currentRoute.value.fullPath).not.toContain(CODE)
    },
  )

  it('новая ссылка важнее сохранённого контекста', async () => {
    sessionStorage.setItem(
      INVITATION_CONTEXT_KEY,
      JSON.stringify({ v: 1, code: CODE, checkedAt: NOW - 60_000 }),
    )
    await open(`/register?code=${OTHER}`)
    expect(checkRequests.map((item) => item.code)).toEqual([OTHER])
    expect(storedContext()).toEqual({ v: 1, code: OTHER, checkedAt: NOW })
  })

  it.each([
    ['пустой', '/register?code=', 'empty'],
    ['без значения', '/register?code', 'empty'],
    ['повторённый', `/register?code=${CODE}&code=${OTHER}`, 'format'],
    ['неверный', '/register?flow=invite&code=LDR-2026', 'format'],
  ])('%s code — ошибка B2, а не A; запросов нет', async (_name, location, status) => {
    await open(location)
    expect(flow.view.value).toBe('invite-code')
    expect(flow.codeStatus.value).toBe(status)
    expect(checkRequests).toHaveLength(0)
    expect(modeRequests).toHaveLength(0)
    expect(router.currentRoute.value.query.code).toBeUndefined()
  })

  it('validated=true ничего не подтверждает', async () => {
    await open('/register?flow=invite&validated=true')
    expect(flow.view.value).toBe('invite-code')
    await flow.submit(VALUES)
    expect(register).not.toHaveBeenCalled()
    expect(checkRequests).toHaveLength(0)
  })
})

describe('контекст вкладки: F5, срок и очистка (AC-B14, AC-B15)', () => {
  function storeContext(checkedAt: number, code = CODE): void {
    sessionStorage.setItem(INVITATION_CONTEXT_KEY, JSON.stringify({ v: 1, code, checkedAt }))
  }

  it('F5 в B3: сначала серверная проверка (каркас B3), затем B3; срок не продлевается', async () => {
    const checkedAt = NOW - 10 * 60_000
    storeContext(checkedAt)
    const gate = deferred<Response>()
    checkHandler = () => gate.promise
    await open('/register?flow=invite')
    expect(flow.view.value).toBe('invite-restoring')
    expect(checkRequests.map((item) => item.code)).toEqual([CODE])
    gate.resolve(new Response(null, { status: 204 }))
    await flush()
    expect(flow.view.value).toBe('invite-details')
    expect(flow.openedByCheck.value).toBe(false)
    expect(storedContext()).toEqual({ v: 1, code: CODE, checkedAt })
    // Срок считается от первой проверки: через 20 минут после неё контекст истекает.
    await vi.advanceTimersByTimeAsync(INVITATION_CONTEXT_TTL_MS - 10 * 60_000)
    await flush()
    expect(flow.view.value).toBe('invite-code')
    expect(flow.code.value).toBe('')
    expect(storedContext()).toBeNull()
  })

  it('восстановление: 403 — B2 с видимым кодом и удалённым контекстом; сбой — B2 с повтором, контекст сохранён', async () => {
    storeContext(NOW - 60_000)
    checkHandler = () => json(envelope('INTERNAL_ERROR'), 500)
    await open('/register?flow=invite')
    expect(flow.view.value).toBe('invite-code')
    expect(flow.codeStatus.value).toBe('service')
    expect(flow.code.value).toBe(CODE)
    expect(storedContext()).not.toBeNull()
    wrapper!.unmount()
    wrapper = null

    checkHandler = () => json(envelope('INVITATION_INVALID'), 403)
    await open('/register?flow=invite')
    expect(flow.codeStatus.value).toBe('invalid')
    expect(flow.code.value).toBe(CODE)
    expect(storedContext()).toBeNull()
  })

  it.each([500, 429])(
    'повтор после сбоя восстановления %s не продлевает исходный TTL',
    async (status) => {
      const checkedAt = NOW - 10 * 60_000
      storeContext(checkedAt)
      checkHandler = () =>
        json(envelope(status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR'), status)
      await open('/register?flow=invite')
      expect(flow.view.value).toBe('invite-code')
      await vi.advanceTimersByTimeAsync(60_000)
      checkHandler = () => new Response(null, { status: 204 })
      flow.submitCode()
      await flush()
      expect(flow.view.value).toBe('invite-details')
      expect(storedContext()).toEqual({ v: 1, code: CODE, checkedAt })
      await vi.advanceTimersByTimeAsync(19 * 60_000)
      await flush()
      expect(flow.view.value).toBe('invite-code')
      expect(storedContext()).toBeNull()
    },
  )

  it.each([
    [400, 'REGISTRATION_FAILED'],
    [403, 'ORIGIN_NOT_ALLOWED'],
    [429, 'RATE_LIMITED'],
  ])(
    'TTL во время отправки, затем %s: просроченный контекст сразу очищен и показан B2',
    async (status, code) => {
      await open('/register?flow=invite')
      flow.inputCode(CODE)
      flow.submitCode()
      await flush()
      const pending = deferred<never>()
      vi.mocked(register).mockReturnValueOnce(pending.promise)
      const submitting = flow.submit(VALUES)
      await vi.advanceTimersByTimeAsync(INVITATION_CONTEXT_TTL_MS)
      expect(flow.submitStatus.value).toBe('submitting')
      pending.reject(new ApiError({ httpStatus: status as number, code: code as string }))
      await submitting
      await flush()
      expect(flow.view.value).toBe('invite-code')
      expect(storedContext()).toBeNull()
      expect(flow.code.value).toBe('')
      await flow.submit(VALUES)
      expect(register).toHaveBeenCalledTimes(1)
    },
  )

  it('TTL после неизвестного исхода очищает proof, сохраняя блокировку повторной регистрации', async () => {
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    const pending = deferred<never>()
    vi.mocked(register).mockReturnValueOnce(pending.promise)
    vi.mocked(fetchMe).mockRejectedValue(new ApiError({ httpStatus: 401, code: 'UNAUTHENTICATED' }))
    const submitting = flow.submit(VALUES)
    await vi.advanceTimersByTimeAsync(INVITATION_CONTEXT_TTL_MS)
    pending.reject(new ApiError({ httpStatus: 0, code: 'NETWORK_ERROR' }))
    await submitting
    await flush()
    expect(flow.submitStatus.value).toBe('outcome-unknown')
    expect(storedContext()).toBeNull()
    await flow.submit(VALUES)
    expect(register).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['испорченный JSON', '{not json'],
    ['чужая версия', JSON.stringify({ v: 2, code: CODE, checkedAt: NOW })],
    ['лишнее поле', JSON.stringify({ v: 1, code: CODE, checkedAt: NOW, role: 'OWNER' })],
    ['неверный код', JSON.stringify({ v: 1, code: 'short', checkedAt: NOW })],
    ['время строкой', JSON.stringify({ v: 1, code: CODE, checkedAt: String(NOW) })],
    ['время из будущего', JSON.stringify({ v: 1, code: CODE, checkedAt: NOW + 1 })],
    ['истёкший', JSON.stringify({ v: 1, code: CODE, checkedAt: NOW - INVITATION_CONTEXT_TTL_MS })],
  ])('%s — пустой B2 без запроса, запись удалена', async (_name, raw) => {
    sessionStorage.setItem(INVITATION_CONTEXT_KEY, raw)
    await open('/register?flow=invite')
    expect(flow.view.value).toBe('invite-code')
    expect(flow.code.value).toBe('')
    expect(checkRequests).toHaveLength(0)
    expect(sessionStorage.getItem(INVITATION_CONTEXT_KEY)).toBeNull()
  })

  it('хранилище запрещено: сценарий работает в памяти, после перезагрузки снова B2', async () => {
    const proto = Object.getPrototypeOf(sessionStorage) as Storage
    const denied = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    const spies = [
      vi.spyOn(proto, 'getItem').mockImplementation(denied),
      vi.spyOn(proto, 'setItem').mockImplementation(denied),
      vi.spyOn(proto, 'removeItem').mockImplementation(denied),
    ]
    try {
      await open('/register?flow=invite')
      flow.inputCode(CODE)
      flow.submitCode()
      await flush()
      expect(flow.view.value).toBe('invite-details')
      vi.mocked(register).mockRejectedValue(
        new ApiError({ httpStatus: 400, code: 'REGISTRATION_FAILED' }),
      )
      await flow.submit(VALUES)
      expect(vi.mocked(register).mock.calls[0]![0]).toMatchObject({ inviteCode: CODE })
      wrapper!.unmount()
      wrapper = null
      await open('/register?flow=invite')
      expect(flow.view.value).toBe('invite-code')
    } finally {
      spies.forEach((spy) => spy.mockRestore())
    }
  })

  it('переход к A/C очищает контекст; старый код не применяется к обычной регистрации', async () => {
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    expect(storedContext()).not.toBeNull()
    await router.push('/register')
    await flush()
    expect(storedContext()).toBeNull()
    vi.mocked(register).mockReturnValue(new Promise(() => {}))
    void flow.submit(VALUES)
    await flush()
    expect(vi.mocked(register).mock.calls[0]![0]).not.toHaveProperty('inviteCode')
  })

  it('пароль, имя, почта и код не попадают в localStorage, query cache и его ключи', async () => {
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    flow.draft.displayName = VALUES.displayName
    flow.draft.email = VALUES.email
    vi.mocked(register).mockRejectedValue(
      new ApiError({ httpStatus: 400, code: 'REGISTRATION_FAILED' }),
    )
    await flow.submit(VALUES)
    const local = JSON.stringify({ ...localStorage })
    const cache = JSON.stringify(
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => [query.queryKey, query.state.data]),
    )
    const session = JSON.stringify({ ...sessionStorage })
    for (const secret of [VALUES.password, VALUES.email, VALUES.displayName, CODE]) {
      expect(local).not.toContain(secret)
      expect(cache).not.toContain(secret)
    }
    // Единственное разрешённое место кода — запись контекста вкладки; пароля и данных там нет.
    expect(session).toContain(CODE)
    for (const secret of [VALUES.password, VALUES.email, VALUES.displayName]) {
      expect(session).not.toContain(secret)
    }
  })
})

describe('отправка регистрации (AC-G04, AC-G05, AC-B11…B13)', () => {
  async function openDetails(): Promise<void> {
    await open('/register?flow=invite')
    flow.inputCode(CODE)
    flow.submitCode()
    await flush()
    expect(flow.view.value).toBe('invite-details')
  }

  it.each(['unknown', 'created'] as const)(
    '%s: смена приглашения и query-only переход не снимают lock',
    async (kind) => {
      await openDetails()
      if (kind === 'unknown')
        vi.mocked(register).mockRejectedValueOnce(
          new ApiError({ httpStatus: 0, code: 'NETWORK_ERROR' }),
        )
      else vi.mocked(register).mockResolvedValueOnce({ user } as never)
      vi.mocked(fetchMe).mockRejectedValue(
        new ApiError({ httpStatus: 500, code: 'INTERNAL_ERROR' }),
      )
      await flow.submit(VALUES)
      await flush()
      const status = flow.submitStatus.value
      expect(flow.submitLocked.value).toBe(true)
      flow.useOtherInvitation()
      expect(flow.submitStatus.value).toBe(status)
      await router.push('/register')
      await flush()
      await router.push(`/register?flow=invite&code=${OTHER}`)
      await flush()
      expect(router.currentRoute.value.query.code).toBeUndefined()
      expect(flow.submitStatus.value).toBe(status)
      expect(checkRequests).toHaveLength(1)
      await flow.submit(VALUES)
      expect(register).toHaveBeenCalledTimes(1)
    },
  )

  it.each(['submitting', 'account-created', 'reconciling'] as const)(
    '%s: history/query не открывают новую отправку во время незавершённой операции',
    async (status) => {
      await openDetails()
      const pending = deferred<never>()
      if (status === 'submitting') vi.mocked(register).mockReturnValueOnce(pending.promise)
      else {
        if (status === 'account-created')
          vi.mocked(register).mockResolvedValueOnce({ user } as never)
        else
          vi.mocked(register).mockRejectedValueOnce(
            new ApiError({ httpStatus: 0, code: 'NETWORK_ERROR' }),
          )
        vi.mocked(fetchMe).mockReturnValueOnce(pending.promise)
      }
      void flow.submit(VALUES)
      await flush()
      expect(flow.submitStatus.value).toBe(status)
      await router.push('/register')
      await flush()
      await router.push(`/register?flow=invite&code=${OTHER}`)
      await flush()
      expect(flow.submitStatus.value).toBe(status)
      expect(router.currentRoute.value.query.code).toBeUndefined()
      flow.useOtherInvitation()
      await flow.submit(VALUES)
      expect(register).toHaveBeenCalledTimes(1)
      expect(checkRequests).toHaveLength(1)
    },
  )

  it('unknown сначала, затем TTL: очистка контекста не снимает lock', async () => {
    await openDetails()
    vi.mocked(register).mockRejectedValueOnce(
      new ApiError({ httpStatus: 0, code: 'NETWORK_ERROR' }),
    )
    vi.mocked(fetchMe).mockRejectedValue(new ApiError({ httpStatus: 401, code: 'UNAUTHENTICATED' }))
    await flow.submit(VALUES)
    await flush()
    expect(flow.submitStatus.value).toBe('outcome-unknown')
    await vi.advanceTimersByTimeAsync(INVITATION_CONTEXT_TTL_MS)
    await flush()
    expect(flow.submitStatus.value).toBe('outcome-unknown')
    expect(storedContext()).toBeNull()
    await flow.submit(VALUES)
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('B3 отправляет код из контекста; повторная отправка во время запроса игнорируется', async () => {
    const gate = deferred<never>()
    vi.mocked(register).mockReturnValue(gate.promise)
    await openDetails()
    void flow.submit(VALUES)
    void flow.submit(VALUES)
    await flush()
    expect(flow.submitStatus.value).toBe('submitting')
    expect(register).toHaveBeenCalledTimes(1)
    expect(register).toHaveBeenCalledWith({ ...VALUES, inviteCode: CODE })
  })

  it.each([
    [
      'новый 400 REGISTRATION_FAILED',
      new ApiError({ httpStatus: 400, code: 'REGISTRATION_FAILED' }),
    ],
    ['legacy 409', new ApiError({ httpStatus: 409, code: 'EMAIL_ALREADY_REGISTERED' })],
  ])(
    '%s: нейтральный отказ, контекст B сохранён, повтор с исправленной почтой — тот же код',
    async (_name, error) => {
      await openDetails()
      vi.mocked(register).mockRejectedValueOnce(error)
      await flow.submit({ ...VALUES, email: 'busy@example.test' })
      expect(flow.submitStatus.value).toBe('rejected')
      expect(flow.submitError.value).toBe(error)
      expect(flow.view.value).toBe('invite-details')
      const context = storedContext()
      expect(context).toEqual({ v: 1, code: CODE, checkedAt: NOW })
      flow.onDraftEdited()
      expect(flow.submitStatus.value).toBe('idle')
      vi.mocked(register).mockResolvedValueOnce({ user } as never)
      vi.mocked(fetchMe).mockResolvedValue({ user, memberships: [], canCreateOrganization: true })
      await flow.submit({ ...VALUES, email: 'free@example.test' })
      await flush()
      expect(vi.mocked(register).mock.calls.map(([body]) => [body.email, body.inviteCode])).toEqual(
        [
          ['busy@example.test', CODE],
          ['free@example.test', CODE],
        ],
      )
      expect(checkRequests).toHaveLength(1)
      expect(router.currentRoute.value.name).toBe('radar')
    },
  )

  it('окончательный INVITATION_INVALID: B2 с видимым кодом и «!», контекст очищен (AC-B11)', async () => {
    await openDetails()
    vi.mocked(register).mockRejectedValue(
      new ApiError({ httpStatus: 403, code: 'INVITATION_INVALID' }),
    )
    await flow.submit(VALUES)
    expect(flow.view.value).toBe('invite-code')
    expect(flow.codeStatus.value).toBe('invalid')
    expect(flow.code.value).toBe(CODE)
    expect(flow.submitStatus.value).toBe('idle')
    expect(storedContext()).toBeNull()
    // Имя и почта могут остаться в памяти страницы; пароль модель не хранит вовсе.
    expect(JSON.stringify(flow.draft)).not.toContain(VALUES.password)
  })

  it('201: аккаунт фиксируется до /auth/me, контекст очищен, переход по существующим guard-ам', async () => {
    await openDetails()
    vi.mocked(register).mockResolvedValue({ user } as never)
    const me = deferred<never>()
    vi.mocked(fetchMe).mockReturnValueOnce(me.promise)
    void flow.submit(VALUES)
    await flush()
    expect(flow.submitStatus.value).toBe('account-created')
    expect(storedContext()).toBeNull()
    me.resolve({ user, memberships: [], canCreateOrganization: true } as never)
    await flush()
    expect(router.currentRoute.value.name).toBe('radar')
  })

  it('201 + сбой /auth/me: повторяется только загрузка сессии', async () => {
    await openDetails()
    vi.mocked(register).mockResolvedValue({ user } as never)
    vi.mocked(fetchMe).mockRejectedValueOnce(
      new ApiError({ httpStatus: 500, code: 'INTERNAL_ERROR' }),
    )
    await flow.submit(VALUES)
    await flush()
    expect(flow.submitStatus.value).toBe('session-error')
    await flow.submit(VALUES)
    expect(register).toHaveBeenCalledTimes(1)
    vi.mocked(fetchMe).mockResolvedValueOnce({ user, memberships: [], canCreateOrganization: true })
    flow.retrySession()
    await flush()
    expect(register).toHaveBeenCalledTimes(1)
    expect(fetchMe).toHaveBeenCalledTimes(2)
    expect(router.currentRoute.value.name).toBe('radar')
  })

  it('201 + гостевой /auth/me — не успех: ошибка загрузки сессии, перехода нет', async () => {
    await open('/register')
    vi.mocked(register).mockResolvedValue({ user } as never)
    await flow.submit(VALUES)
    await flush()
    expect(flow.submitStatus.value).toBe('session-error')
    expect(router.currentRoute.value.name).toBe('register')
  })

  it.each([
    ['ответ потерян (сеть)', new ApiError({ httpStatus: 0, code: 'NETWORK_ERROR' })],
    ['5xx', new ApiError({ httpStatus: 502, code: 'MALFORMED_RESPONSE' })],
    ['неожиданное исключение', new Error('boom')],
  ])(
    '%s: сверка с /auth/me без повторной регистрации; сессия есть — переход',
    async (_name, error) => {
      await openDetails()
      vi.mocked(register).mockRejectedValue(error)
      vi.mocked(fetchMe).mockResolvedValue({ user, memberships: [], canCreateOrganization: true })
      await flow.submit(VALUES)
      await flush()
      expect(register).toHaveBeenCalledTimes(1)
      expect(fetchMe).toHaveBeenCalledTimes(1)
      expect(router.currentRoute.value.name).toBe('radar')
      expect(storedContext()).toBeNull()
    },
  )

  it('исход неизвестен и сессии нет: «результат не получен», новая отправка заблокирована', async () => {
    await openDetails()
    vi.mocked(register).mockRejectedValue(new ApiError({ httpStatus: 0, code: 'NETWORK_ERROR' }))
    await flow.submit(VALUES)
    await flush()
    expect(flow.submitStatus.value).toBe('outcome-unknown')
    expect(flow.submitLocked.value).toBe(true)
    flow.onDraftEdited()
    await flow.submit({ ...VALUES, email: 'other@example.test' })
    expect(register).toHaveBeenCalledTimes(1)
    // Контекст не объявляется израсходованным: исход не доказан.
    expect(storedContext()).not.toBeNull()
  })

  it('429 регистрации: ожидание, отправка до его конца недоступна', async () => {
    await open('/register')
    vi.mocked(register).mockRejectedValue(
      new ApiError({ httpStatus: 429, code: 'RATE_LIMITED', retryAfterSeconds: 20 }),
    )
    await flow.submit(VALUES)
    expect(flow.submitStatus.value).toBe('failed')
    expect(flow.registerRetrySeconds.value).toBe(20)
    await flow.submit(VALUES)
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('прочий определённый отказ — безопасная подпись, повтор вручную доступен', async () => {
    await open('/register')
    vi.mocked(register).mockRejectedValueOnce(
      new ApiError({ httpStatus: 400, code: 'INVALID_ARGUMENT' }),
    )
    await flow.submit(VALUES)
    expect(flow.submitStatus.value).toBe('failed')
    expect(flow.submitError.value).toBeInstanceOf(ApiError)
    vi.mocked(register).mockReturnValueOnce(new Promise(() => {}))
    void flow.submit(VALUES)
    await flush()
    expect(register).toHaveBeenCalledTimes(2)
  })

  it('C: отправка из закрытой формы не выполняется', async () => {
    modeHandler = () => json({ mode: 'invite_only' })
    await open('/register')
    await flow.submit(VALUES)
    expect(register).not.toHaveBeenCalled()
  })

  it('клиентский срок истёк до отправки B3: регистрация не уходит, возврат к коду', async () => {
    await openDetails()
    vi.setSystemTime(NOW + INVITATION_CONTEXT_TTL_MS)
    await flow.submit(VALUES)
    expect(register).not.toHaveBeenCalled()
    expect(flow.view.value).toBe('invite-code')
    expect(storedContext()).toBeNull()
  })
})
