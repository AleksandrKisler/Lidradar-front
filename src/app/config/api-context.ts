/**
 * Связывает транспорт с хранилищем сессии и маршрутизатором.
 *
 * `shared/api` не может импортировать верхние слои, поэтому получает
 * организацию и реакцию на потерю сессии через контекст. При `401` на
 * защищённом пути: сессия помечается истёкшей, защищённый кеш очищается,
 * пользователь попадает на вход с путём возврата. Цикл «401 → refresh →
 * повтор» не выполняется: refresh не восстанавливает отсутствующую сессию.
 */
import type { QueryClient } from '@tanstack/vue-query'
import type { Router } from 'vue-router'
import { setApiContext } from '@/shared/api'
import type { SessionStore } from '@/entities/session'

export interface ApiContextDependencies {
  session: SessionStore
  queryClient: QueryClient
  router: Router
}

export function installApiContext({ session, queryClient, router }: ApiContextDependencies): void {
  setApiContext({
    tenantId: () => session.tenantId,
    onSessionLost: () => {
      if (!session.isAuthenticated) return
      session.markExpired()
      queryClient.clear()
      const current = router.currentRoute.value
      const query =
        current.meta.access === 'guest' || current.fullPath === '/'
          ? {}
          : { redirect: current.fullPath }
      void router.replace({ name: 'login', query })
    },
  })
}
