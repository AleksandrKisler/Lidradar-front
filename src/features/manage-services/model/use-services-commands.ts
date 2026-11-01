/**
 * Команды каталога услуг: создание, изменение, отключение и повторное
 * включение. После каждой перечитываются каталог и статус начала работы.
 */
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { organizationKeys } from '@/entities/organization'
import {
  createService,
  deactivateService,
  serviceKeys,
  updateService,
  type CreateServiceCatalogItemRequest,
  type ServiceCatalogItem,
  type UpdateServiceCatalogItemRequest,
} from '@/entities/service'

export type ServiceCommand = { tenantId?: string } & (
  | { kind: 'create'; body: CreateServiceCatalogItemRequest }
  | { kind: 'update'; serviceId: string; body: UpdateServiceCatalogItemRequest }
  | { kind: 'deactivate'; serviceId: string }
)

export function useServiceCommands(tenantId: () => string) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (
      command: ServiceCommand & { tenantId: string },
    ): Promise<ServiceCatalogItem | null> => {
      switch (command.kind) {
        case 'create':
          return createService(command.tenantId, command.body)
        case 'update':
          return updateService(command.tenantId, command.serviceId, command.body)
        case 'deactivate':
          await deactivateService(command.tenantId, command.serviceId)
          return null
      }
    },
    onSuccess: async (_, command) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: serviceKeys.list(command.tenantId) }),
        queryClient.invalidateQueries({ queryKey: organizationKeys.onboarding(command.tenantId) }),
      ])
    },
  })
  const capture = (command: ServiceCommand) => ({
    ...command,
    tenantId: command.tenantId ?? tenantId(),
  })
  return {
    ...mutation,
    mutateAsync: (command: ServiceCommand) => mutation.mutateAsync(capture(command)),
    mutate: (command: ServiceCommand) => mutation.mutate(capture(command)),
  }
}
