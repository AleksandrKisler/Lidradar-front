/**
 * Команды восстановления над одним мёртвым объектом. Оптимистичного удаления
 * нет: после любого ответа перечитываются очередь, мёртвые письма и список
 * объекта; `409` означает, что состояние уже изменилось на сервере, `403` —
 * что право администратора потеряно, и признак перечитывается.
 */
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { isApiError } from '@/shared/api'
import {
  adminKeys,
  discardAIJob,
  discardDelivery,
  discardJob,
  discardOutboxEvent,
  replayOutboxEvent,
  retryAIJob,
  retryJob,
  type DeadLetterKind,
  type RecoveryAction,
} from '@/entities/admin'

export interface RecoveryTarget {
  kind: DeadLetterKind
  id: string
  tenantId: string
  status: string
  discardedAt?: string | null | undefined
}

/** Какие команды предусмотрены для объекта: только мёртвые и ещё не отложенные. */
export function availableActions(target: RecoveryTarget): RecoveryAction[] {
  if (target.status !== 'DEAD' || target.discardedAt) return []
  switch (target.kind) {
    case 'job':
    case 'aiJob':
      return ['retry', 'discard']
    case 'outbox':
      return ['replay', 'discard']
    case 'delivery':
      return ['discard']
    default:
      return []
  }
}

function execute(target: RecoveryTarget, action: RecoveryAction): Promise<unknown> {
  switch (target.kind) {
    case 'job':
      return action === 'retry' ? retryJob(target.id) : discardJob(target.id)
    case 'aiJob':
      return action === 'retry' ? retryAIJob(target.id) : discardAIJob(target.id)
    case 'outbox':
      return action === 'replay' ? replayOutboxEvent(target.id) : discardOutboxEvent(target.id)
    case 'delivery':
      return discardDelivery(target.id)
    default:
      return Promise.reject(new Error(`Неизвестный объект: ${String(target.kind)}`))
  }
}

const listKeyByKind: Record<DeadLetterKind, readonly unknown[]> = {
  job: ['admin', 'jobs'],
  aiJob: ['admin', 'ai', 'runs'],
  outbox: ['admin', 'jobs'],
  delivery: ['admin', 'jobs'],
}

export function useRecoveryCommand() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { target: RecoveryTarget; action: RecoveryAction }) =>
      execute(input.target, input.action),
    onSettled: async (_data, error, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.queue() }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'dead-letters'] }),
        queryClient.invalidateQueries({ queryKey: listKeyByKind[input.target.kind] }),
      ])
      if (isApiError(error) && error.httpStatus === 403) {
        await queryClient.invalidateQueries({ queryKey: adminKeys.me() })
      }
    },
  })
}
