/**
 * Привязка потока сигналов к сессии и кешу запросов.
 *
 * Один поток на выбранную организацию: открывается после загрузки сессии и
 * выбора организации, закрывается при выходе или смене. Сигнал `risk.*`
 * инвалидирует карточку риска, ленты и сводку; `resync.required` и
 * переподключение — всё, что относится к организации. Кеш никогда не
 * правится вручную. `401` передаётся в обработчик потери сессии, `403`
 * оставляет работу по REST. Браузер офлайн или вкладка скрыта — повторы
 * приостанавливаются.
 */
import { ref, watch, type Ref } from 'vue'
import type { QueryClient } from '@tanstack/vue-query'
import {
  RealtimeConnection,
  getApiContext,
  isApiError,
  tenantScope,
  type RealtimeState,
} from '@/shared/api'
import { env } from '@/shared/config'
import type { SessionStore } from '@/entities/session'
import { invalidateRisk } from '@/entities/risk'

// Product decision 2026-10-05: visible Radar freshness <= 30 seconds.
// Poll every 15 seconds, leaving the HTTP client's 15-second timeout budget.
export const SNAPSHOT_REFETCH_INTERVAL_MS = 15_000

export interface RealtimeDependencies {
  session: SessionStore
  queryClient: QueryClient
  /** Фабрика соединения; в тестах подменяется заглушкой. */
  createConnection?: (
    options: ConstructorParameters<typeof RealtimeConnection>[0],
  ) => RealtimeConnection
  /** Окно и документ для событий online/visibility; в тестах — заглушки. */
  window?: Pick<Window, 'addEventListener' | 'removeEventListener'>
  document?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>
}

export interface RealtimeInstallation {
  state: Readonly<Ref<RealtimeState>>
  connection: RealtimeConnection
  /** Снимает подписки и закрывает поток. */
  dispose: () => void
}

export function installRealtime(deps: RealtimeDependencies): RealtimeInstallation {
  const { session, queryClient } = deps
  const state = ref<RealtimeState>('stopped')
  let activeTenant: string | null = null
  let online = typeof navigator === 'undefined' || navigator.onLine
  const targetWindow = deps.window ?? window
  const targetDocument = deps.document ?? document

  function reconcileVisible() {
    if (!activeTenant || !online || targetDocument.visibilityState === 'hidden') return
    // Only mounted queries issue REST requests. Never abort an ongoing refetch
    // or accumulate overlapping requests on a slow/unavailable server.
    void queryClient.invalidateQueries(
      { queryKey: tenantScope(activeTenant), refetchType: 'active' },
      { cancelRefetch: false },
    )
  }
  const safetyTimer = setInterval(reconcileVisible, SNAPSHOT_REFETCH_INTERVAL_MS)

  const connection = (deps.createConnection ?? ((options) => new RealtimeConnection(options)))({
    baseUrl: env.VITE_API_ORIGIN,
    handlers: {
      onSignal: ({ resourceId }) => {
        if (activeTenant) void invalidateRisk(queryClient, activeTenant, resourceId)
      },
      onResync: () => {
        if (activeTenant) {
          void queryClient.invalidateQueries({ queryKey: tenantScope(activeTenant) })
        }
      },
      onStateChange: (next) => {
        state.value = next
      },
      onStop: (error) => {
        if (isApiError(error) && error.httpStatus === 401) getApiContext().onSessionLost?.(error)
      },
    },
  })

  const stopWatching = watch(
    () => (session.isAuthenticated ? session.tenantId : null),
    (tenantId) => {
      activeTenant = tenantId
      if (tenantId) connection.start(tenantId)
      else connection.stop()
    },
    { immediate: true },
  )

  const onOnline = () => {
    online = true
    connection.notifyOnline()
    reconcileVisible()
  }
  const onOffline = () => {
    online = false
    connection.notifyOffline()
  }
  const onVisibility = () => {
    connection.notifyVisibility(targetDocument.visibilityState !== 'hidden')
    reconcileVisible()
  }
  targetWindow.addEventListener('online', onOnline)
  targetWindow.addEventListener('offline', onOffline)
  targetDocument.addEventListener('visibilitychange', onVisibility)
  if (targetDocument.visibilityState === 'hidden') connection.notifyVisibility(false)

  return {
    state,
    connection,
    dispose: () => {
      stopWatching()
      clearInterval(safetyTimer)
      targetWindow.removeEventListener('online', onOnline)
      targetWindow.removeEventListener('offline', onOffline)
      targetDocument.removeEventListener('visibilitychange', onVisibility)
      connection.stop()
    },
  }
}
