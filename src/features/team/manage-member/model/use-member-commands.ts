/**
 * Команды над участником: смена роли и отзыв доступа. После любого ответа
 * список перечитывается — при `409` тем более, потому что состояние команды
 * изменилось параллельно. Действия над собой не перечитывают список старой
 * организации: после отзыва собственного доступа его уже нельзя прочитать,
 * дальнейший переход делает вызывающий экран.
 */
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  changeMemberRole,
  revokeMember,
  teamKeys,
  type Member,
  type TeamRole,
} from '@/entities/team'

export function useMemberCommands(tenantId: () => string) {
  const queryClient = useQueryClient()

  async function refetchMembers(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: teamKeys.members(tenantId()) })
  }

  const changeRole = useMutation({
    mutationFn: (input: { member: Member; role: TeamRole; self: boolean }) =>
      changeMemberRole(tenantId(), input.member.userId, input.role),
    onSettled: (_data, _error, input) => (input.self ? undefined : refetchMembers()),
  })

  const revoke = useMutation({
    mutationFn: (input: { member: Member; self: boolean }) =>
      revokeMember(tenantId(), input.member.userId),
    onSettled: (_data, _error, input) => (input.self ? undefined : refetchMembers()),
  })

  return { changeRole, revoke }
}
