import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  CLIENT_ERROR_CODES,
  createApiClient,
  unwrap,
  type ApiClient,
  type ApiContext,
} from '@/shared/api'

/** Результат `openapi-fetch` без привязки к контракту — для вызова путей вне схемы браузера. */
type LooseResult =
  | { data: unknown; error?: never; response: Response }
  | { data?: never; error: unknown; response: Response }
type LooseClient = { GET: (path: string, init?: object) => Promise<LooseResult> }

function json(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

function setup(context: Partial<ApiContext> = {}, options: { timeoutMs?: number } = {}) {
  const fetchMock = vi.fn<(request: Request) => Promise<Response>>()
  const ctx: ApiContext = { tenantId: () => null, ...context }
  const client = createApiClient({
    baseUrl: 'http://api.test',
    fetch: fetchMock,
    context: () => ctx,
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
  })
  const call: typeof unwrap = (promise) => unwrap(promise)
  return { client, fetchMock, call, loose: client as unknown as LooseClient }
}

afterEach(() => vi.unstubAllGlobals())

describe('транспорт: заголовки и организация', () => {
  it('отправляет cookie, Accept и уникальный X-Request-ID', async () => {
    const { client, fetchMock, call } = setup()
    fetchMock.mockResolvedValue(json({ user: {}, memberships: [] }))
    await call(client.GET('/api/v1/auth/me'))
    const request = fetchMock.mock.calls[0]![0]
    expect(request.url).toBe('http://api.test/api/v1/auth/me')
    expect(request.credentials).toBe('include')
    expect(request.headers.get('Accept')).toBe('application/json')
    expect(request.headers.get('X-Request-ID')).toMatch(/^[0-9a-f-]{36}$/)
    expect(request.headers.get('X-Tenant-ID')).toBeNull()
  })

  it('пропускает tenant-scoped запрос с заголовком выбранной организации', async () => {
    const { client, fetchMock, call } = setup({ tenantId: () => 'tenant-a' })
    fetchMock.mockResolvedValue(
      json({
        openRisks: 1,
        criticalRisks: 0,
        potentialRevenue: '0.00',
        confirmedRecoveredRevenue: '0.00',
      }),
    )
    const summary = await call(
      client.GET('/api/v1/radar', { params: { header: { 'X-Tenant-ID': 'tenant-a' } } }),
    )
    expect(summary.openRisks).toBe(1)
    expect(fetchMock.mock.calls[0]![0].headers.get('X-Tenant-ID')).toBe('tenant-a')
  })

  it('отклоняет tenant-scoped запрос без организации до отправки', async () => {
    const { client, fetchMock, call } = setup()
    await expect(
      call(client.GET('/api/v1/risks', { params: { header: { 'X-Tenant-ID': '' } } })),
    ).rejects.toMatchObject({
      code: CLIENT_ERROR_CODES.tenantRequired,
      httpStatus: 0,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('отклоняет запрос к организации, отличной от выбранной', async () => {
    const { client, fetchMock, call } = setup({ tenantId: () => 'tenant-a' })
    await expect(
      call(client.GET('/api/v1/risks', { params: { header: { 'X-Tenant-ID': 'tenant-b' } } })),
    ).rejects.toMatchObject({ code: CLIENT_ERROR_CODES.tenantMismatch })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('блокирует машинные пути вебхуков и AI-узла', async () => {
    const { loose, fetchMock, call } = setup()
    await expect(call(loose.GET('/internal/v1/ai/jobs/claim'))).rejects.toMatchObject({
      code: CLIENT_ERROR_CODES.forbiddenPath,
    })
    await expect(call(loose.GET('/api/v1/webhooks/TEST/tenant/connection'))).rejects.toMatchObject({
      code: CLIENT_ERROR_CODES.forbiddenPath,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('передаёт AbortSignal вызывающего и пробрасывает отмену как есть', async () => {
    const { client, fetchMock, call } = setup()
    fetchMock.mockImplementation((request) => {
      // Как настоящий fetch: уже отменённый сигнал отклоняет запрос сразу.
      if (request.signal.aborted) return Promise.reject(request.signal.reason as Error)
      return new Promise((_, reject) =>
        request.signal.addEventListener('abort', () => reject(request.signal.reason as Error)),
      )
    })
    const controller = new AbortController()
    const pending = call(client.GET('/api/v1/auth/me', { signal: controller.signal }))
    controller.abort(new DOMException('отменено', 'AbortError'))
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('прерывает запрос по таймауту и сообщает о нём как о сетевой ошибке', async () => {
    const { client, fetchMock, call } = setup({}, { timeoutMs: 20 })
    fetchMock.mockImplementation(
      (request) =>
        new Promise((_, reject) =>
          request.signal.addEventListener('abort', () => reject(request.signal.reason as Error)),
        ),
    )
    await expect(call(client.GET('/api/v1/auth/me'))).rejects.toMatchObject({
      code: CLIENT_ERROR_CODES.network,
      httpStatus: 0,
    })
  })
})

describe('транспорт: ответы и ошибки', () => {
  it('превращает конверт ошибки в ApiError', async () => {
    const { client, fetchMock, call } = setup()
    fetchMock.mockResolvedValue(
      json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'x', traceId: 't-1' } },
        { status: 401 },
      ),
    )
    await expect(
      call(client.POST('/api/v1/auth/login', { body: { email: 'a@b.c', password: 'p' } })),
    ).rejects.toMatchObject({
      httpStatus: 401,
      code: 'INVALID_CREDENTIALS',
      traceId: 't-1',
    })
  })

  it('безопасно описывает ответ без JSON', async () => {
    const { client, fetchMock, call } = setup()
    fetchMock.mockResolvedValue(
      new Response('<html>502</html>', { status: 502, headers: { 'X-Request-ID': 'r-2' } }),
    )
    const error = await call(client.GET('/api/v1/auth/me')).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe(CLIENT_ERROR_CODES.malformed)
    expect((error as ApiError).traceId).toBe('r-2')
  })

  it('разбирает Retry-After на 429', async () => {
    const { client, fetchMock, call } = setup()
    fetchMock.mockResolvedValue(
      json(
        { error: { code: 'RATE_LIMITED', message: '', traceId: 't' } },
        { status: 429, headers: { 'Retry-After': '58' } },
      ),
    )
    await expect(
      call(client.POST('/api/v1/auth/login', { body: { email: 'a@b.c', password: 'p' } })),
    ).rejects.toMatchObject({
      retryAfterSeconds: 58,
    })
  })

  it('возвращает пустой результат для 204', async () => {
    const { client, fetchMock, call } = setup()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(call(client.POST('/api/v1/auth/logout'))).resolves.toBeUndefined()
  })

  it('превращает сетевой сбой в ApiError с причиной', async () => {
    const { client, fetchMock, call } = setup()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await call(client.GET('/api/v1/auth/me')).catch((e: unknown) => e)
    expect((error as ApiError).code).toBe(CLIENT_ERROR_CODES.network)
    expect((error as ApiError).cause).toBeInstanceOf(TypeError)
  })

  it('сообщает о потере сессии только на защищённых путях', async () => {
    const onSessionLost = vi.fn()
    const { client, fetchMock, call } = setup({ tenantId: () => 'tenant-a', onSessionLost })
    const unauthorized = () =>
      json({ error: { code: 'UNAUTHENTICATED', message: '', traceId: 't' } }, { status: 401 })
    fetchMock.mockResolvedValueOnce(unauthorized())
    await call(
      client.POST('/api/v1/auth/login', { body: { email: 'a@b.c', password: 'p' } }),
    ).catch(() => undefined)
    fetchMock.mockResolvedValueOnce(unauthorized())
    await call(client.GET('/api/v1/auth/me')).catch(() => undefined)
    expect(onSessionLost).not.toHaveBeenCalled()
    fetchMock.mockResolvedValueOnce(unauthorized())
    await call(
      client.GET('/api/v1/risks', { params: { header: { 'X-Tenant-ID': 'tenant-a' } } }),
    ).catch(() => undefined)
    expect(onSessionLost).toHaveBeenCalledTimes(1)
    expect(onSessionLost.mock.calls[0]![0]).toBeInstanceOf(ApiError)
  })

  it('использует глобальный fetch на момент вызова', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const client: ApiClient = createApiClient({
      baseUrl: 'http://api.test',
      context: () => ({ tenantId: () => null }),
    })
    await unwrap(client.GET('/api/v1/auth/me'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
