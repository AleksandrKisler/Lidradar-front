/**
 * Создание и изменение точки. После ответа перечитываются точки и статус
 * начала работы: первая точка закрывает шаг онбординга.
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

export type SaveLocationInput =
  | { kind: 'create'; body: CreateLocationRequest }
  | { kind: 'update'; locationId: string; body: UpdateLocationRequest }

export function useSaveLocation(tenantId: () => string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveLocationInput): Promise<Location> =>
      input.kind === 'create'
        ? createLocation(tenantId(), input.body)
        : updateLocation(tenantId(), input.locationId, input.body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: locationKeys.list(tenantId()) }),
        queryClient.invalidateQueries({ queryKey: organizationKeys.onboarding(tenantId()) }),
      ])
    },
  })
}
