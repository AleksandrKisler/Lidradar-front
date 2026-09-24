/**
 * Соединение с потоком сигналов организации.
 *
 * Поток — ускоритель, а не источник истины: клиент лишь получает подсказки
 * «что перечитать». Состояния: `connecting`, `open`, `backoff`, `offline`,
 * `stopped`. Повтор подключения идёт с ограниченным backoff и jitter только
 * пока браузер онлайн и вкладка видима; после успешного переподключения
 * потребитель обязан перечитать всё видимое — события за разрыв потеряны.
 * `401`/`403` останавливают поток до смены контекста, остальные ошибки —
 * повод для повтора. Тишина дольше двух heartbeat считается обрывом. Счётчик
 * попыток сбрасывается только после устойчивого соединения: если сервер или
 * прокси рвут поток сразу, задержка продолжает расти, а полные перечитывания
 * не превращаются в шторм.
 */
import { inject, ref, type InjectionKey, type Ref } from 'vue'
import { isApiError } from './api-error'
import { backoffDelay } from './backoff'
import { readEventStream, type SseMessage } from './sse'

export type RealtimeState = 'stopped' | 'connecting' | 'open' | 'backoff' | 'offline'

/** События, которые клиент понимает; остальные игнорируются. */
export const RISK_SIGNAL_EVENTS = [
  'risk.changed',
  'risk.acknowledged',
  'risk.resolved',
  'risk.false_positive',
] as const
export const RESYNC_EVENT = 'resync.required'

export interface RiskSignal {
  type: (typeof RISK_SIGNAL_EVENTS)[number]
  resourceId: string
}

/** Причина полной ресинхронизации: переполнение буфера сервера или разрыв. */
export type ResyncReason = 'BUFFER_OVERFLOW' | 'RECONNECTED'

export interface RealtimeHandlers {
  onSignal: (signal: RiskSignal) => void
  onResync: (reason: ResyncReason) => void
  onStateChange?: (state: RealtimeState) => void
  /** Поток остановлен ошибкой контекста (`401`, `403`). */
  onStop?: (error: unknown) => void
}

export interface RealtimeConnectionOptions {
  /** Origin API; пустая строка — тот же origin. */
  baseUrl: string
  handlers: RealtimeHandlers
  fetch?: typeof fetch
  random?: () => number
  /** Тишина без единого байта, после которой соединение считается мёртвым. */
  idleTimeoutMs?: number
}

const DEFAULT_IDLE_TIMEOUT_MS = 45_000
/** Соединение, прожившее дольше, считается устойчивым: следующий разрыв начинает backoff заново. */
const STABLE_CONNECTION_MS = 10_000

export class RealtimeConnection {
  private current: RealtimeState = 'stopped'
  private tenantId: string | null = null
  private controller: AbortController | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private attempt = 0
  private everOpened = false
  private openedAt: number | null = null
  private online = true
  private visible = true

  constructor(private readonly options: RealtimeConnectionOptions) {}

  get state(): RealtimeState {
    return this.current
  }

  /** Открывает поток для организации; прежний поток закрывается первым. */
  start(tenantId: string): void {
    this.teardown()
    this.tenantId = tenantId
    this.attempt = 0
    this.everOpened = false
    this.openedAt = null
    this.connect()
  }

  /** Закрывает поток без повторов (выход, смена организации, размонтирование). */
  stop(): void {
    this.teardown()
    this.tenantId = null
    this.setState('stopped')
  }

  notifyOnline(): void {
    this.online = true
    if (this.tenantId && (this.current === 'offline' || this.current === 'backoff')) {
      this.clearRetry()
      this.connect()
    }
  }

  notifyOffline(): void {
    this.online = false
    this.abortCurrent()
    this.clearRetry()
    if (this.tenantId) this.setState('offline')
  }

  notifyVisibility(visible: boolean): void {
    this.visible = visible
    if (visible && this.tenantId && this.current === 'backoff' && this.retryTimer === null) {
      this.connect()
    }
  }

  private connect(): void {
    const tenantId = this.tenantId
    if (!tenantId) return
    if (!this.online) {
      this.setState('offline')
      return
    }
    if (!this.visible) {
      // Скрытая вкладка не переподключается: дождёмся возвращения.
      this.setState('backoff')
      return
    }
    const controller = new AbortController()
    this.controller = controller
    const reconnect = this.everOpened || this.attempt > 0
    this.setState('connecting')
    const url = `${this.options.baseUrl}/api/v1/events`
    readEventStream({
      url,
      tenantId,
      signal: controller.signal,
      ...(this.options.fetch ? { fetch: this.options.fetch } : {}),
      onOpen: () => {
        this.openedAt = Date.now()
        this.setState('open')
        this.armIdle(controller)
        if (reconnect) this.options.handlers.onResync('RECONNECTED')
        this.everOpened = true
      },
      onChunk: () => this.armIdle(controller),
      onMessage: (message) => this.dispatch(message),
    })
      .then(() => this.scheduleReconnect(controller))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (isApiError(error) && (error.httpStatus === 401 || error.httpStatus === 403)) {
          this.teardown()
          this.tenantId = null
          this.setState('stopped')
          this.options.handlers.onStop?.(error)
          return
        }
        this.scheduleReconnect(controller)
      })
      .finally(() => {
        if (this.controller === controller) this.clearIdle()
      })
  }

  private dispatch(message: SseMessage): void {
    if (message.event === RESYNC_EVENT) {
      this.options.handlers.onResync('BUFFER_OVERFLOW')
      return
    }
    const type = RISK_SIGNAL_EVENTS.find((known) => known === message.event)
    if (!type) return
    const resourceId = parseResourceId(message.data)
    if (!resourceId) return
    this.options.handlers.onSignal({ type, resourceId })
  }

  private scheduleReconnect(controller: AbortController): void {
    if (controller !== this.controller || controller.signal.aborted || !this.tenantId) return
    this.controller = null
    this.clearIdle()
    const stable = this.openedAt !== null && Date.now() - this.openedAt >= STABLE_CONNECTION_MS
    this.openedAt = null
    this.attempt = stable ? 1 : this.attempt + 1
    if (!this.online) {
      this.setState('offline')
      return
    }
    this.setState('backoff')
    if (!this.visible) return
    const delay = backoffDelay(this.attempt, {
      ...(this.options.random ? { random: this.options.random } : {}),
    })
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.connect()
    }, delay)
  }

  /** Без байтов дольше таймаута соединение обрывается и открывается заново. */
  private armIdle(controller: AbortController): void {
    this.clearIdle()
    this.idleTimer = setTimeout(() => {
      if (this.controller !== controller) return
      controller.abort()
      this.controller = null
      this.attempt += 1
      this.setState('backoff')
      this.retryTimer = setTimeout(
        () => {
          this.retryTimer = null
          this.connect()
        },
        backoffDelay(1, { ...(this.options.random ? { random: this.options.random } : {}) }),
      )
    }, this.options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS)
  }

  private abortCurrent(): void {
    this.controller?.abort()
    this.controller = null
    this.clearIdle()
  }

  private clearRetry(): void {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer)
    this.retryTimer = null
  }

  private clearIdle(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer)
    this.idleTimer = null
  }

  private teardown(): void {
    this.abortCurrent()
    this.clearRetry()
  }

  private setState(state: RealtimeState): void {
    if (this.current === state) return
    this.current = state
    this.options.handlers.onStateChange?.(state)
  }
}

function parseResourceId(data: string): string | null {
  try {
    const parsed: unknown = JSON.parse(data)
    if (parsed && typeof parsed === 'object' && 'resourceId' in parsed) {
      const value = (parsed as { resourceId: unknown }).resourceId
      return typeof value === 'string' && value !== '' ? value : null
    }
  } catch {
    // Некорректный JSON — сигнал пропускается, REST остаётся источником истины.
  }
  return null
}

/** Состояние соединения для интерфейса; слой `app` предоставляет его через provide. */
export const REALTIME_STATE_KEY: InjectionKey<Readonly<Ref<RealtimeState>>> =
  Symbol('realtime-state')

const stoppedState: Readonly<Ref<RealtimeState>> = ref<RealtimeState>('stopped')

/** Текущее состояние потока или `stopped`, если слой `app` его не предоставил. */
export function useRealtimeState(): Readonly<Ref<RealtimeState>> {
  return inject(REALTIME_STATE_KEY, stoppedState)
}
