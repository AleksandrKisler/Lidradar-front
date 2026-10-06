/**
 * Подтверждение оплаты с ключом идемпотентности. После однозначного успеха
 * инвалидируются карточка риска, ленты, сводка, аналитика и итоги выручки.
 */
import { toValue, type MaybeRefOrGetter } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useIdempotentMutation } from '@/shared/api'
import { useSessionStore } from '@/entities/session'
import { invalidateRisk } from '@/entities/risk'
import {
  confirmRevenue,
  type ConfirmRevenueRequest,
  type ConfirmedRevenue,
} from '@/entities/revenue'

export function useConfirmRevenue(
  riskId: MaybeRefOrGetter<string>,
  opportunityId: MaybeRefOrGetter<string>,
) {
  const session = useSessionStore()
  const queryClient = useQueryClient()
  return useIdempotentMutation<ConfirmRevenueRequest, ConfirmedRevenue>({
    scope: () =>
      session.user && session.tenantId
        ? JSON.stringify([session.user.id, session.tenantId, 'revenue', toValue(opportunityId)])
        : null,
    execute: (body, key) =>
      confirmRevenue(session.tenantId ?? '', toValue(opportunityId), key, body),
    onSuccess: async () => {
      if (session.tenantId) {
        await invalidateRisk(queryClient, session.tenantId, toValue(riskId), { revenue: true })
      }
    },
  })
}
