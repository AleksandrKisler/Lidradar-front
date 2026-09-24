/**
 * Команда: участники и приглашения выбранной организации, приём кода сеансом.
 * Список участников не подменяется данными `/auth/me`: там только членства
 * текущего пользователя. Приём кода — единственная сеансовая операция без
 * заголовка организации: организацию определяет приглашение.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { apiClient, tenantScope, unwrap } from '@/shared/api'
import type {
  AcceptedInvitation,
  CreateInvitationRequest,
  Invitation,
  IssuedInvitation,
  Member,
  Membership,
  TeamRole,
} from '../model/types'

export const teamKeys = {
  members: (tenantId: string) => [...tenantScope(tenantId), 'members'] as const,
  invitations: (tenantId: string) => [...tenantScope(tenantId), 'invitations'] as const,
}

export async function fetchMembers(tenantId: string, signal?: AbortSignal): Promise<Member[]> {
  const page = await unwrap(
    apiClient.GET('/api/v1/organization/members', {
      params: { header: { 'X-Tenant-ID': tenantId } },
      ...(signal ? { signal } : {}),
    }),
  )
  return page.items
}

export function changeMemberRole(
  tenantId: string,
  userId: string,
  role: TeamRole,
): Promise<Membership> {
  return unwrap(
    apiClient.PATCH('/api/v1/organization/members/{userId}', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { userId } },
      body: { role },
    }),
  )
}

/** Отзыв доступа: членство остаётся в списке как `DISABLED`; повтор идемпотентен. */
export function revokeMember(tenantId: string, userId: string): Promise<void> {
  return unwrap(
    apiClient.DELETE('/api/v1/organization/members/{userId}', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { userId } },
    }),
  )
}

export async function fetchInvitations(
  tenantId: string,
  signal?: AbortSignal,
): Promise<Invitation[]> {
  const page = await unwrap(
    apiClient.GET('/api/v1/organization/invitations', {
      params: { header: { 'X-Tenant-ID': tenantId } },
      ...(signal ? { signal } : {}),
    }),
  )
  return page.items
}

/** Выпуск кода: ответ содержит код единственный раз, сервер хранит только хеш. */
export function createInvitation(
  tenantId: string,
  body: CreateInvitationRequest,
): Promise<IssuedInvitation> {
  return unwrap(
    apiClient.POST('/api/v1/organization/invitations', {
      params: { header: { 'X-Tenant-ID': tenantId } },
      body,
    }),
  )
}

export function revokeInvitation(tenantId: string, invitationId: string): Promise<void> {
  return unwrap(
    apiClient.DELETE('/api/v1/organization/invitations/{invitationId}', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { invitationId } },
    }),
  )
}

export function acceptInvitation(code: string): Promise<AcceptedInvitation> {
  return unwrap(apiClient.POST('/api/v1/invitations/accept', { body: { code } }))
}

export function useMembersQuery(tenantId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => teamKeys.members(toValue(tenantId) ?? '')),
    queryFn: ({ signal }) => fetchMembers(toValue(tenantId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null),
  })
}

export function useInvitationsQuery(tenantId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => teamKeys.invitations(toValue(tenantId) ?? '')),
    queryFn: ({ signal }) => fetchInvitations(toValue(tenantId)!, signal),
    enabled: computed(() => toValue(tenantId) !== null),
  })
}
