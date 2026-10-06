/**
 * Запись действия с ключом идемпотентности. Ключ создаётся перед первым
 * POST и сохраняется, пока результат неизвестен; после однозначного ответа
 * инвалидируются карточка, лента и сводка.
 */
import { toValue, type MaybeRefOrGetter } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { isApiError, useIdempotentMutation } from '@/shared/api'
import { useSessionStore } from '@/entities/session'
import {
  createAction,
  invalidateRisk,
  type ActionDraft,
  type RecordedAction,
} from '@/entities/risk'

export function useRecordAction(riskId: MaybeRefOrGetter<string>) {
  const session = useSessionStore()
  const queryClient = useQueryClient()
  return useIdempotentMutation<ActionDraft, RecordedAction>({
    scope: () =>
      session.user && session.tenantId
        ? JSON.stringify([session.user.id, session.tenantId, 'action', toValue(riskId)])
        : null,
    execute: async (body, key) => {
      const tenantId = session.tenantId ?? ''
      const id = toValue(riskId)
      try {
        return await createAction(tenantId, id, key, body)
      } catch (error) {
        if (isApiError(error) && error.code === 'RISK_CLOSED') {
          // Закрытие могло произойти в другой вкладке без доставки SSE.
          // Ошибка обновления не должна скрыть однозначный отказ команды.
          await invalidateRisk(queryClient, tenantId, id).catch(() => undefined)
        }
        throw error
      }
    },
    onSuccess: async () => {
      if (session.tenantId) await invalidateRisk(queryClient, session.tenantId, toValue(riskId))
    },
  })
}
