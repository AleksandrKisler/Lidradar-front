/**
 * HTTP-клиент поверх `openapi-fetch`.
 *
 * Клиент типизирован сгенерированной схемой OpenAPI: путь, параметры, тело и
 * ответы проверяются компилятором, а обязательный заголовок `X-Tenant-ID`
 * нельзя пропустить у tenant-scoped операции. Промежуточный слой добавляет
 * `X-Request-ID`, сверяет организацию запроса с выбранной, блокирует машинные
 * пути и ограничивает время ожидания.
 */
import createClient, { type Client, type Middleware } from 'openapi-fetch'
import { combineSignals, createUuid, isAbortError, timeoutSignal } from '@/shared/lib'
import type { paths } from '../generated/schema'
import { ApiError, CLIENT_ERROR_CODES } from './api-error'
import { getApiContext, type ApiContext } from './context'
import { isMachinePath, isSessionLossPath, isTenantScopedPath } from './scope'
import { recordApiFailure } from '@/shared/observability'

/** Тип клиента, ограниченный путями браузера из контракта. */
export type ApiClient = Client<paths>

export interface CreateApiClientOptions {
  /** Origin API; пустая строка — тот же origin, что у приложения. */
  baseUrl: string
  /** Источник контекста; по умолчанию — глобальный контекст модуля. */
  context?: () => ApiContext
  /** Реализация `fetch`; по умолчанию — глобальная на момент вызова. */
  fetch?: (input: Request) => Promise<Response>
  /** Время ожидания ответа по умолчанию, мс. */
  timeoutMs?: number
}

/** Время ожидания ответа по умолчанию: длиннее обычного запроса, короче терпения пользователя. */
export const DEFAULT_TIMEOUT_MS = 15_000

function pathnameOf(request: Request): string {
  return new URL(request.url).pathname
}

/**
 * Промежуточный слой, общий для всех запросов браузера. Проверки выполняются
 * до отправки, поэтому неверный запрос не доходит до сети. После ответа
 * слой распознаёт потерю сессии: `401` на защищённом пути передаётся хуку
 * контекста, а формы входа и `/auth/me` обрабатывают `401` сами.
 */
function browserMiddleware(context: () => ApiContext): Middleware {
  return {
    async onResponse({ request, response }) {
      if (response.ok) return undefined
      const body: unknown = await response
        .clone()
        .json()
        .catch(() => undefined)
      const failure = ApiError.fromResponse(response, body)
      // Телеметрия получает только шаблон пути, статус, безопасный код и trace.
      recordApiFailure({
        method: request.method,
        url: request.url,
        status: response.status,
        code: failure.code,
        traceId: failure.traceId,
      })
      if (response.status === 401 && isSessionLossPath(pathnameOf(request))) {
        context().onSessionLost?.(failure)
      }
      return undefined
    },
    onError({ request, error }) {
      // Сетевой сбой или таймаут: ответа нет, статус 0; тело запроса не читается.
      const timeout = error instanceof Error && error.name === 'TimeoutError'
      recordApiFailure({
        method: request.method,
        url: request.url,
        status: 0,
        code: timeout ? 'TIMEOUT' : 'NETWORK',
      })
      return undefined
    },
    onRequest({ request }) {
      const pathname = pathnameOf(request)
      if (isMachinePath(pathname)) {
        throw new ApiError({
          httpStatus: 0,
          code: CLIENT_ERROR_CODES.forbiddenPath,
          message: `Путь ${pathname} не предназначен для браузера`,
        })
      }
      request.headers.set('X-Request-ID', createUuid())
      if (!request.headers.has('Accept')) request.headers.set('Accept', 'application/json')
      if (isTenantScopedPath(pathname)) {
        const header = request.headers.get('X-Tenant-ID')
        if (!header) {
          throw new ApiError({
            httpStatus: 0,
            code: CLIENT_ERROR_CODES.tenantRequired,
            message: `Запрос ${pathname} требует выбранной организации`,
          })
        }
        const selected = context().tenantId()
        if (selected !== null && selected !== header) {
          throw new ApiError({
            httpStatus: 0,
            code: CLIENT_ERROR_CODES.tenantMismatch,
            message: `Запрос ${pathname} адресован другой организации`,
          })
        }
      }
      return request
    },
  }
}

/**
 * Создаёт типизированный клиент. В приложении используется один экземпляр
 * (`apiClient`), фабрика открыта для тестов с подменённым `fetch`.
 */
export function createApiClient(options: CreateApiClientOptions): ApiClient {
  const context = options.context ?? getApiContext
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const baseFetch = options.fetch ?? ((request: Request) => globalThis.fetch(request))
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    credentials: 'include',
    fetch: async (request) => {
      const timeout = timeoutSignal(timeoutMs)
      try {
        return await baseFetch(
          new Request(request, { signal: combineSignals(request.signal, timeout.signal) }),
        )
      } finally {
        timeout.clear()
      }
    },
  })
  client.use(browserMiddleware(context))
  return client
}

/** Результат вызова `openapi-fetch`: либо данные, либо ошибка, всегда с ответом. */
type FetchResult<Data> =
  | { data: Data; error?: never; response: Response }
  | { data?: never; error: unknown; response: Response }

/**
 * Превращает результат `openapi-fetch` в данные вместе с HTTP-статусом.
 *
 * Сетевой сбой и таймаут становятся `ApiError` с `httpStatus: 0`; отмена
 * запроса вызывающей стороной пробрасывается как есть, чтобы её можно было
 * отличить от ошибки. Потерю сессии распознаёт промежуточный слой клиента.
 * Статус нужен командам с ключом идемпотентности: `201` — первая запись,
 * `200` — повтор прежнего результата.
 */
export async function unwrapWithStatus<Data>(
  call: Promise<FetchResult<Data>>,
): Promise<{ data: Data; status: number }> {
  let result: FetchResult<Data>
  try {
    result = await call
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (isAbortError(error) && (error as DOMException).name === 'AbortError') throw error
    throw ApiError.network(error)
  }
  if (result.error === undefined && result.response.ok) {
    return { data: result.data as Data, status: result.response.status }
  }
  throw ApiError.fromResponse(result.response, result.error)
}

/** Данные результата `openapi-fetch` или `ApiError` (см. `unwrapWithStatus`). */
export async function unwrap<Data>(call: Promise<FetchResult<Data>>): Promise<Data> {
  return (await unwrapWithStatus(call)).data
}
