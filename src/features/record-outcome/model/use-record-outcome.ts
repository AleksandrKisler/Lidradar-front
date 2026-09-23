/**
 * Запись исхода сделки с ключом идемпотентности. Исход меняет сделку и
 * аналитику, поэтому инвалидация шире, чем у действия (архитектура § 8).
 */
import { toValue, type MaybeRefOrGetter } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useIdempotentMutation } from '@/shared/api'
import { useSessionStore } from '@/entities/session'
import {
  createOutcome,
  invalidateRisk,
  type OutcomeDraft,
  type RecordedOutcome,
} from '@/entities/risk'

export function useRecordOutcome(
  riskId: MaybeRefOrGetter<string>,
  opportunityId: MaybeRefOrGetter<string>,
) {
  const session = useSessionStore()
  const queryClient = useQueryClient()
  return useIdempotentMutation<OutcomeDraft, RecordedOutcome>({
    execute: (body, key) =>
      createOutcome(session.tenantId ?? '', toValue(opportunityId), key, body),
    onSuccess: async () => {
      if (session.tenantId) {
        await invalidateRisk(queryClient, session.tenantId, toValue(riskId), {
          opportunity: true,
        })
      }
    },
  })
}
