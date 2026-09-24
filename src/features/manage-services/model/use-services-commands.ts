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

export type ServiceCommand =
  | { kind: 'create'; body: CreateServiceCatalogItemRequest }
  | { kind: 'update'; serviceId: string; body: UpdateServiceCatalogItemRequest }
  | { kind: 'deactivate'; serviceId: string }

export function useServiceCommands(tenantId: () => string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (command: ServiceCommand): Promise<ServiceCatalogItem | null> => {
      switch (command.kind) {
        case 'create':
          return createService(tenantId(), command.body)
        case 'update':
          return updateService(tenantId(), command.serviceId, command.body)
        case 'deactivate':
          await deactivateService(tenantId(), command.serviceId)
          return null
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: serviceKeys.list(tenantId()) }),
        queryClient.invalidateQueries({ queryKey: organizationKeys.onboarding(tenantId()) }),
      ])
    },
  })
}
