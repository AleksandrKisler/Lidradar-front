/** Команды привязаны к контексту, захваченному до отправки. */
import { onBeforeUnmount } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  changeMemberRole,
  revokeMember,
  teamKeys,
  type Member,
  type TeamRole,
} from '@/entities/team'

type Target = { tenantId: string; member: Member; self: boolean }
export function useMemberCommands(tenantId: () => string) {
  const queryClient = useQueryClient()
  let alive = true
  onBeforeUnmount(() => {
    alive = false
  })
  async function reconcile(input: Target): Promise<void> {
    if (!alive || input.tenantId !== tenantId()) return
    await queryClient.invalidateQueries({ queryKey: teamKeys.members(input.tenantId) })
  }
  const changeRole = useMutation({
    mutationFn: (input: Target & { role: TeamRole }) =>
      changeMemberRole(input.tenantId, input.member.userId, input.role),
    onSuccess: (membership, input) => {
      if (
        !alive ||
        input.self ||
        input.tenantId !== tenantId() ||
        membership.userId !== input.member.userId ||
        membership.tenantId !== input.tenantId
      )
        return
      // ACK is confirmed server data even if the following list GET fails.
      queryClient.setQueryData<Member[]>(teamKeys.members(input.tenantId), (rows) =>
        rows?.map((member) =>
          member.userId === membership.userId
            ? { ...member, role: membership.role, updatedAt: membership.updatedAt }
            : member,
        ),
      )
    },
    onSettled: (_data, error, input) => (input.self && !error ? undefined : reconcile(input)),
  })
  const revoke = useMutation({
    mutationFn: (input: Target) => revokeMember(input.tenantId, input.member.userId),
    onSettled: (_data, error, input) => (input.self && !error ? undefined : reconcile(input)),
  })
  return { changeRole, revoke }
}
