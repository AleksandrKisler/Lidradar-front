/**
 * Подключение источника. После ответа — любого, кроме сетевого сбоя, —
 * перечитываются подключения и статус начала работы: соединение могло
 * появиться со статусом `ERROR`, и это тоже подключение.
 */
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { organizationKeys } from '@/entities/organization'
import {
  connectChannel,
  integrationKeys,
  type ConnectChannelRequest,
  type ConnectorProvider,
} from '@/entities/integration'

export function useConnectChannel(tenantId: () => string) {
  const queryClient = useQueryClient()
  async function refresh(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: integrationKeys.list(tenantId()) }),
      queryClient.invalidateQueries({ queryKey: organizationKeys.onboarding(tenantId()) }),
    ])
  }
  return useMutation({
    mutationFn: (input: { provider: ConnectorProvider; body: ConnectChannelRequest }) =>
      connectChannel(tenantId(), input.provider, input.body),
    onSuccess: refresh,
  })
}
