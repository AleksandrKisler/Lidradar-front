/**
 * Ручной перевод возможности на допустимый этап. Без оптимизма: после `200`
 * перечитываются сделка с историей, карточка риска, ленты и аналитика;
 * `409 INVALID_STAGE_TRANSITION` означает, что этап уже изменился, — список
 * целей перечитывается, успех не заявляется.
 */
import { toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { isApiError } from '@/shared/api'
import { useSessionStore } from '@/entities/session'
import { changeOpportunityStage, invalidateRisk, type OpportunityStage } from '@/entities/risk'

export function useChangeStage(
  riskId: MaybeRefOrGetter<string>,
  opportunityId: MaybeRefOrGetter<string>,
) {
  const session = useSessionStore()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (stage: OpportunityStage) =>
      changeOpportunityStage(session.tenantId ?? '', toValue(opportunityId), stage),
    onSettled: async (_data, error) => {
      // Ответ сервера — единственный источник истины и при успехе, и при конфликте.
      const conflict = isApiError(error) && error.httpStatus === 409
      if (session.tenantId && (!error || conflict)) {
        await invalidateRisk(queryClient, session.tenantId, toValue(riskId), {
          opportunity: true,
        })
      }
    },
  })
  return mutation
}
