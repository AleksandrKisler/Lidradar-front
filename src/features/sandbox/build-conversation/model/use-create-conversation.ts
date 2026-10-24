/**
 * Сборка переписки с ключом идемпотентности. Пока результат неизвестен (сеть, `503 SANDBOX_DELIVERY_UNAVAILABLE`),
 * повтор идёт тем же ключом: сервер дошлёт недоставленные сообщения без дублей.
 */
import { useQueryClient } from '@tanstack/vue-query'
import { useIdempotentMutation } from '@/shared/api'
import { useSessionStore } from '@/entities/session'
import {
  createSandboxConversation,
  storeSandboxConversation,
  type SandboxConversation,
  type SandboxCreateRequest,
} from '@/entities/sandbox'

export function useCreateSandboxConversation(
  onCreated: (conversation: SandboxConversation) => void,
) {
  const session = useSessionStore()
  const queryClient = useQueryClient()
  return useIdempotentMutation<SandboxCreateRequest, SandboxConversation>({
    scope: () =>
      session.user && session.tenantId
        ? JSON.stringify([session.user.id, session.tenantId, 'sandbox-create'])
        : null,
    execute: async (body, key) =>
      (await createSandboxConversation(session.tenantId ?? '', key, body)).conversation,
    onSuccess: async (conversation) => {
      if (session.tenantId)
        await storeSandboxConversation(queryClient, session.tenantId, conversation)
      onCreated(conversation)
    },
  })
}
