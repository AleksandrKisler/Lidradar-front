import { onScopeDispose, watch } from 'vue'
import { useSessionStore, type Permission } from '@/entities/session'

/** A generation also rejects A→B→A and logout/login of the same actor. */
export function usePrivacyContext(tenant: () => string, permission: Permission, reset: () => void) {
  const session = useSessionStore()
  let generation = 0
  const allowed = () => !!session.user && session.tenantId === tenant() && session.can(permission)
  const clear = () => {
    generation++
    reset()
  }
  watch(
    () => [tenant(), session.tenantId, session.user?.id, session.status, session.can(permission)],
    clear,
    { flush: 'sync' },
  )
  onScopeDispose(clear)
  return {
    capture: () => (allowed() ? { tenantId: tenant(), generation } : null),
    current: (context: { generation: number }) => generation === context.generation && allowed(),
  }
}
