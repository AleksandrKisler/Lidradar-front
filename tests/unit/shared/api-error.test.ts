import { describe, expect, it } from 'vitest'
import {
  ApiError,
  CLIENT_ERROR_CODES,
  describeError,
  isApiError,
  isMachinePath,
  isSessionLossPath,
  isTenantScopedPath,
  normalizeFilters,
  parseRetryAfter,
  shouldRetryRead,
} from '@/shared/api'

function response(status: number, body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers })
}

describe('ApiError.fromResponse', () => {
  it('читает конверт ошибки и заголовки', () => {
    const error = ApiError.fromResponse(
      response(
        429,
        JSON.stringify({
          error: {
            code: 'RATE_LIMITED',
            message: 'много',
            details: { scope: 'ip' },
            traceId: 'trace-1',
          },
        }),
        { 'Retry-After': '58', 'X-Request-ID': 'req-1' },
      ),
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'много',
          details: { scope: 'ip' },
          traceId: 'trace-1',
        },
      },
    )
    expect(error.httpStatus).toBe(429)
    expect(error.code).toBe('RATE_LIMITED')
    expect(error.traceId).toBe('trace-1')
    expect(error.details).toEqual({ scope: 'ip' })
    expect(error.retryAfterSeconds).toBe(58)
    expect(error.isRateLimited).toBe(true)
    expect(error.isRetryable).toBe(false)
  })

  it('не выводит сырой текст при ответе без конверта', () => {
    const error = ApiError.fromResponse(
      response(502, 'Bad gateway private details', { 'X-Request-ID': 'req-2' }),
      'Bad gateway private details',
    )
    expect(error.code).toBe(CLIENT_ERROR_CODES.malformed)
    expect(error.message).toBe('HTTP 502')
    expect(error.message).not.toContain('private')
    expect(error.traceId).toBe('req-2')
    expect(error.isRetryable).toBe(true)
  })

  it('берёт идентификатор запроса, если конверт без traceId', () => {
    const error = ApiError.fromResponse(response(404, '', { 'X-Request-ID': 'req-3' }), {
      error: { code: 'NOT_FOUND', message: '' },
    })
    expect(error.traceId).toBe('req-3')
    expect(error.isNotFound).toBe(true)
  })

  it('описывает сетевой сбой без статуса', () => {
    const error = ApiError.network(new TypeError('offline'))
    expect(error.httpStatus).toBe(0)
    expect(error.isNetwork).toBe(true)
    expect(error.isRetryable).toBe(true)
    expect(error.cause).toBeInstanceOf(TypeError)
    expect(isApiError(error)).toBe(true)
    expect(isApiError(new Error('x'))).toBe(false)
  })
})

describe('parseRetryAfter', () => {
  it('понимает секунды и HTTP-дату, игнорирует мусор', () => {
    const now = new Date('2026-09-18T10:00:00Z')
    expect(parseRetryAfter('30')).toBe(30)
    expect(parseRetryAfter('Fri, 18 Sep 2026 10:00:45 GMT', now)).toBe(45)
    expect(parseRetryAfter('Fri, 18 Sep 2026 09:00:00 GMT', now)).toBe(0)
    expect(parseRetryAfter('скоро')).toBeUndefined()
    expect(parseRetryAfter(null)).toBeUndefined()
  })
})

describe('describeError', () => {
  it('подбирает подпись по коду, статусу и для неизвестной ошибки', () => {
    expect(describeError(new ApiError({ httpStatus: 409, code: 'LAST_OWNER' })).title).toBe(
      'Последний владелец',
    )
    expect(describeError(new ApiError({ httpStatus: 503, code: 'SOMETHING_NEW' })).title).toBe(
      'Сервер временно недоступен',
    )
    expect(describeError(new ApiError({ httpStatus: 418, code: 'TEAPOT' })).title).toBe(
      'Запрос не выполнен',
    )
    expect(
      describeError(new ApiError({ httpStatus: 0, code: CLIENT_ERROR_CODES.network })).title,
    ).toBe('Нет связи с сервером')
    expect(describeError(new ApiError({ httpStatus: 401, code: 'X' })).title).toBe(
      'Сессия завершена',
    )
    expect(describeError(new ApiError({ httpStatus: 403, code: 'X' })).title).toBe(
      'Раздел недоступен',
    )
    expect(describeError(new ApiError({ httpStatus: 404, code: 'X' })).title).toBe('Не найдено')
    expect(describeError(new ApiError({ httpStatus: 429, code: 'X' })).title).toBe(
      'Слишком много попыток',
    )
    expect(describeError(new Error('boom')).title).toBe('Что-то пошло не так')
  })

  it('никогда не возвращает серверное сообщение как текст интерфейса', () => {
    const error = new ApiError({
      httpStatus: 500,
      code: 'INTERNAL_ERROR',
      message: 'stack trace here',
    })
    const described = describeError(error)
    expect(described.description).not.toContain('stack trace')
  })
})

describe('классификация путей', () => {
  it('различает tenant-scoped, сеансовые и машинные пути', () => {
    expect(isTenantScopedPath('/api/v1/risks')).toBe(true)
    expect(isTenantScopedPath('/api/v1/organization')).toBe(true)
    expect(isTenantScopedPath('/api/v1/organization/onboarding')).toBe(true)
    expect(isTenantScopedPath('/api/v1/events')).toBe(true)
    expect(isTenantScopedPath('/api/v1/auth/me')).toBe(false)
    expect(isTenantScopedPath('/api/v1/organizations')).toBe(false)
    expect(isTenantScopedPath('/api/v1/invitations/accept')).toBe(false)
    expect(isTenantScopedPath('/api/v1/admin/queue')).toBe(false)
    expect(isTenantScopedPath('/health/ready')).toBe(false)
    expect(isTenantScopedPath('/api/v1/webhooks/TEST/t/c')).toBe(false)
    expect(isMachinePath('/internal/v1/ai/jobs/claim')).toBe(true)
    expect(isMachinePath('/api/v1/webhooks/TEST/t/c')).toBe(true)
    expect(isMachinePath('/api/v1/risks')).toBe(false)
  })

  it('401 на формах входа и /auth/me не считается потерей сессии', () => {
    expect(isSessionLossPath('/api/v1/auth/login')).toBe(false)
    expect(isSessionLossPath('/api/v1/auth/register')).toBe(false)
    expect(isSessionLossPath('/api/v1/auth/me')).toBe(false)
    expect(isSessionLossPath('/api/v1/risks')).toBe(true)
    expect(isSessionLossPath('/api/v1/auth/logout')).toBe(true)
  })
})

describe('соглашения запросов', () => {
  it('нормализует фильтры детерминированно', () => {
    const left = normalizeFilters({
      severity: 'HIGH',
      locationId: undefined,
      riskType: '',
      statuses: ['B', 'A'],
    })
    const right = normalizeFilters({
      statuses: ['A', 'B'],
      severity: 'HIGH',
      locationId: null,
      empty: [],
    })
    expect(JSON.stringify(left)).toBe(JSON.stringify(right))
    expect(Object.keys(left)).toEqual(['severity', 'statuses'])
  })

  it('повторяет только сеть и 5xx, не более двух раз', () => {
    const network = ApiError.network(new Error('x'))
    expect(shouldRetryRead(0, network)).toBe(true)
    expect(shouldRetryRead(1, new ApiError({ httpStatus: 503, code: 'X' }))).toBe(true)
    expect(shouldRetryRead(2, network)).toBe(false)
    expect(shouldRetryRead(0, new ApiError({ httpStatus: 404, code: 'X' }))).toBe(false)
    expect(shouldRetryRead(0, new ApiError({ httpStatus: 429, code: 'X' }))).toBe(false)
    expect(shouldRetryRead(0, new DOMException('abort', 'AbortError'))).toBe(false)
  })
})
