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

/** Команда целиком: фиксируется синхронно в момент нажатия, до любого асинхронного перехода. */
interface StageCommand {
  tenantId: string
  riskId: string
  opportunityId: string
  stage: OpportunityStage
}

export function useChangeStage(
  riskId: MaybeRefOrGetter<string>,
  opportunityId: MaybeRefOrGetter<string>,
) {
  const session = useSessionStore()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    // Адрес, заголовок организации, тело и перечитывание берутся только из зафиксированной команды:
    // переключение сделки или организации после нажатия не перенацеливает запрос. Если организация
    // уже сменилась, клиент API не отправит запрос (несовпадение X-Tenant-ID с выбранной).
    mutationFn: (command: StageCommand) =>
      changeOpportunityStage(command.tenantId, command.opportunityId, command.stage),
    onSettled: async (_data, error, command) => {
      // Ответ сервера — единственный источник истины и при успехе, и при конфликте.
      const conflict = isApiError(error) && error.httpStatus === 409
      if (command.tenantId && (!error || conflict)) {
        await invalidateRisk(queryClient, command.tenantId, command.riskId, {
          opportunity: true,
        })
      }
    },
  })
  /** Единственная точка входа: контекст читается здесь, синхронно, и дальше не пересчитывается. */
  function send(stage: OpportunityStage) {
    return mutation.mutateAsync({
      tenantId: session.tenantId ?? '',
      riskId: toValue(riskId),
      opportunityId: toValue(opportunityId),
      stage,
    })
  }
  // Прямой `mutate` наружу не отдаётся: любая отправка идёт через `send` с зафиксированным контекстом.
  const { mutate, mutateAsync, ...rest } = mutation
  void mutate
  void mutateAsync
  return { ...rest, mutateAsync: send }
}
