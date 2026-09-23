/**
 * Запись действия с ключом идемпотентности. Ключ создаётся перед первым
 * POST и сохраняется, пока результат неизвестен; после однозначного ответа
 * инвалидируются карточка, лента и сводка.
 */
import { toValue, type MaybeRefOrGetter } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useIdempotentMutation } from '@/shared/api'
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
    execute: (body, key) => createAction(session.tenantId ?? '', toValue(riskId), key, body),
    onSuccess: async () => {
      if (session.tenantId) await invalidateRisk(queryClient, session.tenantId, toValue(riskId))
    },
  })
}
