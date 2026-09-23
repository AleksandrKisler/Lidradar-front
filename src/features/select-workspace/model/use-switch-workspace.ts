/**
 * Смена организации.
 *
 * Порядок фиксирован архитектурой: отменить запросы прежней организации,
 * убрать её данные из кеша, затем выбрать проверенное членство. Так на
 * экране никогда не остаются данные предыдущей организации под новым именем.
 */
import { useQueryClient } from '@tanstack/vue-query'
import { tenantScope } from '@/shared/api'
import { useSessionStore } from '@/entities/session'

export function useSwitchWorkspace() {
  const session = useSessionStore()
  const queryClient = useQueryClient()

  /** Возвращает `false`, если идентификатор не входит в членства пользователя. */
  async function switchTo(tenantId: string): Promise<boolean> {
    const previous = session.tenantId
    if (previous === tenantId) return true
    if (previous !== null) {
      await queryClient.cancelQueries({ queryKey: tenantScope(previous) })
      queryClient.removeQueries({ queryKey: tenantScope(previous) })
    }
    return session.selectTenant(tenantId)
  }

  return { switchTo }
}
