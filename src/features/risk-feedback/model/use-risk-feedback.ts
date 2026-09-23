/**
 * Запись вердикта. Команда не идемпотентна по ключу — каждая запись
 * append-only факт, поэтому защита от двойной отправки только через
 * состояние pending. После ответа инвалидируются карточка, ленты, сводка,
 * сделка (каскад `NOT_A_LEAD`), точность и аналитика.
 */
import { toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useSessionStore } from '@/entities/session'
import {
  invalidateRisk,
  recordRiskFeedback,
  type RiskFeedback,
  type RiskFeedbackRequest,
} from '@/entities/risk'

export function useRiskFeedback(riskId: MaybeRefOrGetter<string>) {
  const session = useSessionStore()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (body: RiskFeedbackRequest) =>
      recordRiskFeedback(session.tenantId ?? '', toValue(riskId), body),
    onSuccess: async () => {
      if (session.tenantId) {
        await invalidateRisk(queryClient, session.tenantId, toValue(riskId), { feedback: true })
      }
    },
  })

  /** Отправляет вердикт; при ошибке возвращает `null`, ошибка доступна в `error`. */
  function submit(body: RiskFeedbackRequest): Promise<RiskFeedback | null> {
    if (mutation.isPending.value) return Promise.resolve(null)
    return mutation.mutateAsync(body).catch(() => null)
  }

  return {
    submit,
    isPending: mutation.isPending,
    error: mutation.error,
    result: mutation.data,
    reset: mutation.reset,
  }
}
