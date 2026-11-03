import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useSessionStore } from '@/entities/session'
import {
  checkConnectionHealth,
  integrationKeys,
  type ChannelConnection,
  type HealthCheck,
} from '@/entities/integration'

/** POST-result stays separate from the persisted GET snapshot (including verification). */
export function useCheckChannelHealth(
  tenantId: () => string | null | undefined,
  connectionId: () => string | null | undefined,
) {
  const queryClient = useQueryClient()
  const session = useSessionStore()
  const result = shallowRef<HealthCheck | null>(null)
  const error = shallowRef<unknown>(null)
  const isPending = ref(false)
  let generation = 0
  let disposed = false
  const context = () =>
    JSON.stringify([
      tenantId(),
      connectionId(),
      session.tenantId,
      session.user?.id,
      session.isAuthenticated,
      [...session.permissions].sort(),
    ])

  function reset() {
    result.value = null
    error.value = null
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
    isPending.value = true // synchronous: a second click cannot enqueue another POST
    error.value = null
    result.value = null
    const version = generation
    const scope = context()
    const current = () => !disposed && version === generation && scope === context()
    const listKey = integrationKeys.list(tenant)
    const healthKey = integrationKeys.health(tenant, connection)
    try {
      const checked = await checkConnectionHealth(tenant, connection)
      if (!current()) return
      // Cancel older GETs before publishing the command result. Do not invalidate health:
      // its GET cannot preserve verification and may still contain a stale source state.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey, exact: true }),
        queryClient.cancelQueries({ queryKey: healthKey, exact: true }),
      ])
      if (!current()) return
      const publish = () => {
        queryClient.setQueryData(healthKey, checked.health)
        queryClient.setQueryData<ChannelConnection[]>(listKey, (items) =>
          items?.map((item) => (item.id === connection ? { ...item, ...checked.health } : item)),
        )
      }
      result.value = checked
      publish()
      await queryClient.invalidateQueries({ queryKey: listKey, exact: true }).catch(() => undefined)
      if (current()) publish()
    } catch (cause) {
      if (current()) error.value = cause
    } finally {
      if (current()) isPending.value = false
    }
  }

  return { result, error, isPending, run, reset }
}
