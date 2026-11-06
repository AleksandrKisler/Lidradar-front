/**
 * Создание и изменение точки. После ответа перечитываются точки и статус
 * начала работы: первая точка закрывает шаг онбординга. Организация входит
 * в данные команды: вызывающий фиксирует её до первого асинхронного перехода,
 * и запрос, и инвалидация относятся к ней, а не к выбранной позже.
 */
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  createLocation,
  locationKeys,
  updateLocation,
  type CreateLocationRequest,
  type Location,
  type UpdateLocationRequest,
} from '@/entities/location'
import { organizationKeys } from '@/entities/organization'

export type SaveLocationInput = { tenantId: string } & (
  | { kind: 'create'; body: CreateLocationRequest }
  | { kind: 'update'; locationId: string; body: UpdateLocationRequest }
)

export function useSaveLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveLocationInput): Promise<Location> =>
      input.kind === 'create'
        ? createLocation(input.tenantId, input.body)
        : updateLocation(input.tenantId, input.locationId, input.body),
    onSuccess: async (_location, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: locationKeys.list(input.tenantId) }),
        queryClient.invalidateQueries({ queryKey: organizationKeys.onboarding(input.tenantId) }),
      ])
    },
  })
}
