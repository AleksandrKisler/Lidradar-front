<script setup lang="ts">
import { computed } from 'vue'
import { roleLabel } from '@/entities/session'
import {
  invitationStatusLabel,
  teamDate,
  isTeamEventToday,
  type Invitation,
  type Member,
} from '@/entities/team'
import { RevokeInvitationButton } from '@/features/team/revoke-invitation'
const props = defineProps<{
  tenantId: string
  invitations: Invitation[]
  members: Member[]
  timeZone: string
  asOf?: number
}>()
const emit = defineEmits<{ revoked: [invitation: Invitation] }>()
const rows = computed(() =>
  [...props.invitations].sort(
    (left, right) =>
      Number(right.status === 'PENDING') - Number(left.status === 'PENDING') ||
      right.createdAt.localeCompare(left.createdAt),
  ),
)
function contact(invitation: Invitation) {
  if (invitation.status === 'ACCEPTED') {
    const today = isTeamEventToday(invitation.acceptedAt, props.timeZone, props.asOf ?? Date.now())
    return `${today ? `Создано ${teamDate(invitation.createdAt, props.timeZone, false)} · ` : ''}Принято ${teamDate(invitation.acceptedAt, props.timeZone, today)}`
  }
  if (invitation.status === 'REVOKED')
    return `Отозвано ${teamDate(invitation.revokedAt, props.timeZone, isTeamEventToday(invitation.revokedAt, props.timeZone, props.asOf ?? Date.now()))}`
  return `Создано ${teamDate(invitation.createdAt, props.timeZone, false)} · До ${teamDate(invitation.expiresAt, props.timeZone)}`
}
function detail(invitation: Invitation) {
  if (invitation.status === 'PENDING')
    return 'Код доступен только при создании; восстановить его из списка нельзя.'
  if (invitation.status === 'EXPIRED') return 'Выпустите новое приглашение, если доступ ещё нужен.'
  if (invitation.status === 'REVOKED') return 'Код больше не даёт доступ.'
  return isTeamEventToday(invitation.acceptedAt, props.timeZone, props.asOf ?? Date.now())
    ? 'Код использован. Управляйте доступом в списке участников.'
    : 'Код использован.'
}
</script>
<template>
  <ul class="divide-y divide-line" aria-label="Приглашения">
    <li
      v-for="invitation in rows"
      :key="invitation.id"
      class="flex min-w-0 flex-col gap-2 py-[10px]"
    >
      <div class="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:gap-5">
        <div class="min-w-0 flex-1">
          <p class="text-base leading-[22px] font-semibold break-words text-ink">
            {{ invitation.note || 'Приглашение в команду' }}
          </p>
          <p class="mt-1 text-sm leading-5 text-muted">
            {{ contact(invitation) }}
          </p>
        </div>
        <div class="flex items-center gap-3 md:w-[250px]">
          <span class="text-sm leading-5 text-ink">{{ roleLabel(invitation.role) }}</span
          ><span
            class="flex h-7 items-center rounded-full bg-canvas px-[10px] text-xs leading-[18px] text-muted"
            >{{ invitationStatusLabel(invitation.status) }}</span
          >
        </div>
        <div
          v-show="invitation.status === 'PENDING'"
          class="flex justify-end md:w-16 md:justify-center"
        >
          <RevokeInvitationButton
            :tenant-id="tenantId"
            :invitation="invitation"
            :time-zone="timeZone"
            @revoked="emit('revoked', $event)"
          />
        </div>
      </div>
      <p class="text-xs leading-[18px] text-muted">{{ detail(invitation) }}</p>
    </li>
  </ul>
</template>
