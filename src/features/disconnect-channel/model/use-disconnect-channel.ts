import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { isApiError } from '@/shared/api'
import { useSessionStore, type SessionStore } from '@/entities/session'
import { organizationKeys } from '@/entities/organization'
import {
  disconnectChannel,
  integrationKeys,
  type ChannelConnection,
  type ConnectionHealth,
} from '@/entities/integration'

export type DisconnectOutcome = 'partial' | 'retried' | 'disconnected' | null

// Session-owned JS memory only. The detached subscription also notices identity/permission
// changes while no card is mounted. A reload creates a new module/store and loses markers.
const partialSessions = new WeakMap<SessionStore, { scope: string; connections: Set<string> }>()
const sessionScope = (session: SessionStore) =>
  JSON.stringify([
    session.user?.id,
    session.tenantId,
    session.isAuthenticated,
    [...session.permissions].sort(),
  ])
function partialMemory(session: SessionStore) {
  let memory = partialSessions.get(session)
  if (!memory) {
    memory = { scope: sessionScope(session), connections: new Set() }
    const owned = memory
    session.$subscribe(
      () => {
        const scope = sessionScope(session)
        if (owned.scope !== scope) {
          owned.scope = scope
          owned.connections.clear()
        }
      },
      { detached: true, flush: 'sync' },
    )
    partialSessions.set(session, memory)
  }
  return memory
}

export function useDisconnectChannel(
  tenantId: () => string | null | undefined,
  connectionId: () => string | null | undefined,
) {
  const queryClient = useQueryClient()
  const session = useSessionStore()
  const memory = partialMemory(session)
  const markerKey = () => JSON.stringify([tenantId(), connectionId()])
  const knownPartial = () =>
    memory.scope === sessionScope(session) &&
    session.can('integration.manage') &&
    session.tenantId === tenantId() &&
    memory.connections.has(markerKey())
  const outcome = ref<DisconnectOutcome>(knownPartial() ? 'partial' : null)
  const error = shallowRef<unknown>(null)
  const isPending = ref(false)
  let generation = 0
  let disposed = false
  const context = () => JSON.stringify([tenantId(), connectionId(), sessionScope(session)])
  function reset() {
    error.value = null
    outcome.value = knownPartial() ? 'partial' : null
  }
  watch(
    context,
    () => {
      generation++
      isPending.value = false
      reset()
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => {
    disposed = true
    generation++
  })

  async function run(): Promise<void> {
    const tenant = tenantId()
    const connection = connectionId()
    if (
      disposed ||
      isPending.value ||
      !tenant ||
      !connection ||
      !session.user ||
      !session.isAuthenticated ||
      session.tenantId !== tenant ||
      !session.can('integration.manage')
    )
      return
    isPending.value = true
    error.value = null
    const version = generation
    const scope = context()
    const key = markerKey()
    const current = () => !disposed && version === generation && scope === context()
    try {
      let partial = false
      try {
        await disconnectChannel(tenant, connection)
      } catch (cause) {
        if (!isApiError(cause) || cause.httpStatus !== 503) throw cause
        partial = true // This DELETE response alone confirms the local disconnect.
      }
      if (!current()) return
      if (partial) memory.connections.add(key)
      outcome.value = partial ? 'partial' : memory.connections.has(key) ? 'retried' : 'disconnected'
      const listKey = integrationKeys.list(tenant)
      const healthKey = integrationKeys.health(tenant, connection)
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey, exact: true }),
        queryClient.cancelQueries({ queryKey: healthKey, exact: true }),
      ])
      if (!current()) return
      const publish = () => {
        queryClient.setQueryData<ChannelConnection[]>(listKey, (items) =>
          items?.map((item) =>
            item.id === connection ? { ...item, status: 'DISCONNECTED' } : item,
          ),
        )
        queryClient.setQueryData<ConnectionHealth>(healthKey, (health) =>
          health ? { ...health, status: 'DISCONNECTED' } : undefined,
        )
      }
      publish()
      // A failed refresh cannot undo the confirmed local outcome. Never invalidate health
      // through the list prefix, and never use reactive keys after awaiting the command.
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: listKey, exact: true }),
        queryClient.invalidateQueries({
          queryKey: organizationKeys.onboarding(tenant),
          exact: true,
        }),
      ])
      if (current()) publish()
    } catch (cause) {
      if (current()) error.value = cause
    } finally {
      if (current()) isPending.value = false
    }
  }

  return { outcome, error, isPending, run, reset }
}
