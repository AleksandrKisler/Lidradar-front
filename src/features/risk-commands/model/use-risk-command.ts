/**
 * Команда над риском без тела запроса: взять в работу, закрыть, получить
 * рекомендацию. Сервер выполняет их идемпотентно, поэтому ключ не нужен;
 * после ответа инвалидируются карточка, лента и сводка (архитектура § 8).
 * Организация берётся из сессии; без неё транспорт вернёт понятную ошибку.
 */
import { toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useSessionStore } from '@/entities/session'
import { invalidateRisk } from '@/entities/risk'

export function useRiskCommand<Result>(
  riskId: MaybeRefOrGetter<string>,
  run: (tenantId: string, riskId: string) => Promise<Result>,
) {
  const session = useSessionStore()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => run(session.tenantId ?? '', toValue(riskId)),
    onSuccess: async () => {
      if (session.tenantId) await invalidateRisk(queryClient, session.tenantId, toValue(riskId))
    },
  })

  /** Выполняет команду; при ошибке возвращает `null`, ошибка доступна в `error`. */
  function execute(): Promise<Result | null> {
    if (mutation.isPending.value) return Promise.resolve(null)
    return mutation.mutateAsync().catch(() => null)
  }

  return { execute, isPending: mutation.isPending, error: mutation.error, reset: mutation.reset }
}
