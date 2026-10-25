/**
 * Сообщение в собранную переписку песочницы: текущее время, ключ идемпотентности на переписку.
 */
import { toValue, type MaybeRefOrGetter } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useIdempotentMutation } from '@/shared/api'
import { useSessionStore } from '@/entities/session'
import {
  sendSandboxMessage,
  storeSandboxConversation,
  type SandboxConversation,
  type SandboxSendRequest,
} from '@/entities/sandbox'

export function useSendSandboxMessage(
  conversationId: MaybeRefOrGetter<string>,
  onSent?: (conversation: SandboxConversation) => void,
) {
  const session = useSessionStore()
  const queryClient = useQueryClient()
  return useIdempotentMutation<SandboxSendRequest, SandboxConversation>({
    scope: () =>
      session.user && session.tenantId
        ? JSON.stringify([
            session.user.id,
            session.tenantId,
            'sandbox-send',
            toValue(conversationId),
          ])
        : null,
    execute: async (body, key) =>
      (await sendSandboxMessage(session.tenantId ?? '', toValue(conversationId), key, body))
        .conversation,
    onSuccess: async (conversation) => {
      const refresh = session.tenantId
        ? storeSandboxConversation(queryClient, session.tenantId, conversation)
        : Promise.resolve()
      // Очищаем поле сразу после подтверждения команды, пока проверенный scope
      // ещё текущий. Обновление кеша может завершиться уже в другом диалоге.
      onSent?.(conversation)
      await refresh
    },
  })
}
