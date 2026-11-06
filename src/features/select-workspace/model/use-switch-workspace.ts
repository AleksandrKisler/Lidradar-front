/**
 * Смена организации.
 *
 * Порядок фиксирован архитектурой: отменить запросы прежней организации,
 * убрать её данные из кеша, затем выбрать проверенное членство. Так на
 * экране никогда не остаются данные предыдущей организации под новым именем.
 */
import { onScopeDispose } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { tenantScope } from '@/shared/api'
import { useSessionStore } from '@/entities/session'

const guards = new Set<() => boolean | Promise<boolean>>()
/** Подтверждение ухода до удаления кеша и смены организации; живёт только со страницей. */
export function useWorkspaceSwitchGuard(guard: () => boolean | Promise<boolean>): void {
  guards.add(guard)
  onScopeDispose(() => guards.delete(guard))
}

export function useSwitchWorkspace() {
  const session = useSessionStore()
  const queryClient = useQueryClient()

  /** Возвращает `false`, если идентификатор не входит в членства пользователя. */
  async function switchTo(tenantId: string): Promise<boolean> {
    const previous = session.tenantId
    if (previous === tenantId) return true
    if (!session.memberships.some((item) => item.tenantId === tenantId)) return false
    for (const guard of guards) if (!(await guard())) return false
    if (session.tenantId !== previous) return false
    if (previous !== null) {
      await queryClient.cancelQueries({ queryKey: tenantScope(previous) })
      queryClient.removeQueries({ queryKey: tenantScope(previous) })
    }
    return session.selectTenant(tenantId)
  }

  return { switchTo }
}
