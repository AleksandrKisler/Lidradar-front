/**
 * Безопасная телеметрия уровня операций.
 *
 * Запись содержит только шаблон пути (идентификаторы заменены на `{id}`,
 * query-строка отброшена), метод, HTTP-статус, безопасный код ошибки,
 * `traceId` сервера и класс попытки. Тела запросов, заголовки, ключи
 * идемпотентности, тексты сообщений и любые персональные данные сюда не
 * попадают по построению: у функций записи нет к ним доступа.
 *
 * Приёмник настраивается один раз слоем `app`: без него записи копятся в
 * ограниченном буфере (диагностика в консоли разработчика) и никуда не
 * отправляются.
 */

export type AttemptClass = 'network' | 'timeout' | 'client' | 'auth' | 'conflict' | 'server'

export interface ApiFailureEvent {
  kind: 'api.failure'
  method: string
  /** Шаблон пути вида `/api/v1/risks/{id}/actions`. */
  path: string
  status: number
  code: string
  traceId: string | null
  attempt: AttemptClass
  at: string
}

export interface RouteTimingEvent {
  kind: 'route.timing'
  /** Шаблон маршрута вида `/risks/:riskId`, без параметров и query. */
  route: string
  durationMs: number
  at: string
}

export interface MutationEvent {
  kind: 'mutation'
  operation: string
  status: 'success' | 'error'
  code: string | null
  at: string
}

export type TelemetryEvent = ApiFailureEvent | RouteTimingEvent | MutationEvent

export type TelemetrySink = (event: TelemetryEvent) => void

const BUFFER_LIMIT = 200
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const NUMERIC_SEGMENT = /\/\d{4,}(?=\/|$)/g

const buffer: TelemetryEvent[] = []
let sink: TelemetrySink | null = null

/** Шаблон пути: идентификаторы и длинные числа заменены, query и hash отброшены. */
export function templatePath(pathOrUrl: string): string {
  let pathname: string
  try {
    pathname = new URL(pathOrUrl, 'http://placeholder.invalid').pathname
  } catch {
    pathname = pathOrUrl.split(/[?#]/)[0] ?? pathOrUrl
  }
  return pathname.replace(UUID, '{id}').replace(NUMERIC_SEGMENT, '/{id}')
}

/** Класс попытки по статусу: подсказывает, повторять ли и кому чинить. */
export function classifyAttempt(status: number, code?: string | null): AttemptClass {
  if (status === 0) return code === 'TIMEOUT' ? 'timeout' : 'network'
  if (status === 401 || status === 403) return 'auth'
  if (status === 409) return 'conflict'
  if (status >= 500) return 'server'
  return 'client'
}

/** Код ошибки ограничен безопасным алфавитом: свободный текст сервера не записывается. */
function safeCode(code: unknown): string {
  return typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'UNKNOWN'
}

function emit(event: TelemetryEvent): void {
  buffer.push(event)
  if (buffer.length > BUFFER_LIMIT) buffer.splice(0, buffer.length - BUFFER_LIMIT)
  sink?.(event)
}

export function recordApiFailure(input: {
  method: string
  url: string
  status: number
  code?: string | null
  traceId?: string | null
}): ApiFailureEvent {
  const code = safeCode(input.code)
  const event: ApiFailureEvent = {
    kind: 'api.failure',
    method: input.method.toUpperCase(),
    path: templatePath(input.url),
    status: input.status,
    code,
    traceId: input.traceId && /^[\w-]{1,128}$/.test(input.traceId) ? input.traceId : null,
    attempt: classifyAttempt(input.status, code),
    at: new Date().toISOString(),
  }
  emit(event)
  return event
}

export function recordRouteTiming(route: string, durationMs: number): RouteTimingEvent {
  const event: RouteTimingEvent = {
    kind: 'route.timing',
    route: templatePath(route),
    durationMs: Math.max(0, Math.round(durationMs)),
    at: new Date().toISOString(),
  }
  emit(event)
  return event
}

export function recordMutation(
  operation: string,
  status: 'success' | 'error',
  code?: string | null,
): MutationEvent {
  const event: MutationEvent = {
    kind: 'mutation',
    operation: operation.replace(/[^\w.-]/g, '').slice(0, 64),
    status,
    code: code ? safeCode(code) : null,
    at: new Date().toISOString(),
  }
  emit(event)
  return event
}

/** Устанавливает приёмник; `null` отключает отправку, буфер продолжает копиться. */
export function setTelemetrySink(next: TelemetrySink | null): void {
  sink = next
}

/** Снимок буфера для диагностики и тестов. */
export function telemetryBuffer(): readonly TelemetryEvent[] {
  return buffer
}

export function resetTelemetry(): void {
  buffer.length = 0
  sink = null
}

/**
 * Приёмник для HTTP-эндпоинта: `sendBeacon` не блокирует выгрузку страницы и
 * не несёт cookie-зависимой логики. Ошибки отправки игнорируются: телеметрия
 * не должна влиять на работу приложения.
 */
export function createBeaconSink(endpoint: string): TelemetrySink {
  return (event) => {
    try {
      const payload = JSON.stringify(event)
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }))
        return
      }
      void fetch(endpoint, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        credentials: 'omit',
      }).catch(() => undefined)
    } catch {
      // Приёмник никогда не бросает.
    }
  }
}
