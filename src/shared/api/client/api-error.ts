/**
 * Ошибка API как значение.
 *
 * Любой неуспешный ответ сервера, сетевой сбой или некорректное тело
 * приводятся к одному типу. Компоненты не разбирают `Response` и не читают
 * серверное `message` как готовый текст интерфейса: пользователю показывается
 * безопасная подпись по коду, а `traceId` доступен в технических деталях.
 */
import * as v from 'valibot'

/** Конверт ошибки, который отдаёт backend (`docs/backend/04-api.md` § 1.3). */
const envelopeSchema = v.object({
  error: v.object({
    code: v.pipe(v.string(), v.minLength(1)),
    message: v.optional(v.string(), ''),
    details: v.optional(v.record(v.string(), v.unknown()), {}),
    traceId: v.optional(v.string(), ''),
  }),
})

/** Коды, которые клиент назначает сам, когда сервер не ответил конвертом. */
export const CLIENT_ERROR_CODES = {
  /** Сеть недоступна, CORS или обрыв соединения: ответа не было. */
  network: 'NETWORK_ERROR',
  /** Ответ не содержит ожидаемого JSON-конверта ошибки. */
  malformed: 'MALFORMED_RESPONSE',
  /** Tenant-scoped запрос выполнен без выбранной организации. */
  tenantRequired: 'TENANT_CONTEXT_REQUIRED',
  /** Запрос отправлен с организацией, отличной от выбранной. */
  tenantMismatch: 'TENANT_CONTEXT_MISMATCH',
  /** Путь предназначен для вебхуков или AI-узла и браузером не вызывается. */
  forbiddenPath: 'BROWSER_FORBIDDEN_PATH',
} as const

export interface ApiErrorInit {
  httpStatus: number
  code: string
  message?: string | undefined
  details?: Record<string, unknown> | undefined
  traceId?: string | undefined
  retryAfterSeconds?: number | undefined
  cause?: unknown
}

export class ApiError extends Error {
  /** HTTP-статус ответа; `0`, если ответа не было. */
  readonly httpStatus: number
  /** Машинный код ошибки backend либо один из `CLIENT_ERROR_CODES`. */
  readonly code: string
  /** Дополнительные сведения конверта; для интерфейса не обязательны. */
  readonly details: Record<string, unknown>
  /** Идентификатор трассировки для обращения в поддержку. */
  readonly traceId: string
  /** Секунды до повторной попытки из заголовка `Retry-After` (для 429). */
  readonly retryAfterSeconds: number | undefined

  constructor(init: ApiErrorInit) {
    super(init.message ?? init.code, init.cause === undefined ? undefined : { cause: init.cause })
    this.name = 'ApiError'
    this.httpStatus = init.httpStatus
    this.code = init.code
    this.details = init.details ?? {}
    this.traceId = init.traceId ?? ''
    this.retryAfterSeconds = init.retryAfterSeconds
  }

  /** Сессии нет или она истекла. */
  get isUnauthenticated(): boolean {
    return this.httpStatus === 401
  }

  /** Право или членство отсутствуют; сведений о чужих данных нет. */
  get isForbidden(): boolean {
    return this.httpStatus === 403
  }

  get isNotFound(): boolean {
    return this.httpStatus === 404
  }

  get isRateLimited(): boolean {
    return this.httpStatus === 429
  }

  /** Сетевой сбой: ответа сервера не было. */
  get isNetwork(): boolean {
    return this.httpStatus === 0
  }

  /**
   * Можно ли повторить чтение автоматически: только сеть и ошибки сервера.
   * Ошибки клиента (`4xx`) повторять бессмысленно и небезопасно.
   */
  get isRetryable(): boolean {
    return this.httpStatus === 0 || this.httpStatus >= 500
  }

  /**
   * Собирает ошибку из HTTP-ответа. `body` — уже прочитанное тело: объект
   * конверта, текст либо `undefined`. Нестандартное тело даёт код
   * `MALFORMED_RESPONSE`, чтобы интерфейс никогда не показал сырой текст.
   */
  static fromResponse(response: Response, body: unknown): ApiError {
    const parsed = v.safeParse(envelopeSchema, body)
    const requestId = response.headers.get('X-Request-ID') ?? ''
    const retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'))
    if (parsed.success) {
      return new ApiError({
        httpStatus: response.status,
        code: parsed.output.error.code,
        message: parsed.output.error.message,
        details: parsed.output.error.details,
        traceId: parsed.output.error.traceId || requestId,
        retryAfterSeconds,
      })
    }
    return new ApiError({
      httpStatus: response.status,
      code: CLIENT_ERROR_CODES.malformed,
      message: `HTTP ${response.status}`,
      traceId: requestId,
      retryAfterSeconds,
    })
  }

  /** Ошибка без ответа сервера: сеть, CORS, обрыв, таймаут. */
  static network(cause: unknown): ApiError {
    return new ApiError({
      httpStatus: 0,
      code: CLIENT_ERROR_CODES.network,
      message: 'Сервер недоступен',
      cause,
    })
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * Разбирает `Retry-After`: сервер LidRadar отдаёт секунды, но заголовок по
 * стандарту может содержать и HTTP-дату. Некорректное значение игнорируется.
 */
export function parseRetryAfter(value: string | null, now: Date = new Date()): number | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  const date = Date.parse(trimmed)
  if (Number.isNaN(date)) return undefined
  return Math.max(0, Math.ceil((date - now.getTime()) / 1000))
}
