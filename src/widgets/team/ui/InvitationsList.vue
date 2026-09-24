<script setup lang="ts">
/**
 * Приглашения: ожидающие — с датой окончания и отзывом, остальные — как
 * история. Кода в списке нет: он показан один раз при выпуске.
 */
import { computed } from 'vue'
import { formatDateTime } from '@/shared/lib'
import { UiBadge } from '@/shared/ui'
import { roleLabel } from '@/entities/session'
import {
  invitationStatusLabel,
  invitationStatusTone,
  type Invitation,
  type Member,
} from '@/entities/team'
import { RevokeInvitationButton } from '@/features/team/revoke-invitation'

const props = defineProps<{
  tenantId: string
  invitations: Invitation[]
  members: Member[]
  timeZone: string
}>()

const rows = computed(() =>
  [...props.invitations].sort(
    (left, right) =>
      Number(right.status === 'PENDING') - Number(left.status === 'PENDING') ||
      right.createdAt.localeCompare(left.createdAt),
  ),
)

/** Имя участника по идентификатору пользователя; неизвестный — короткий id. */
function personName(userId: string | null): string {
  if (!userId) return ''
  const member = props.members.find((item) => item.userId === userId)
  return member ? member.displayName : `#${userId.slice(0, 8)}`
}

function describe(invitation: Invitation): string {
  switch (invitation.status) {
    case 'PENDING':
      return `действует до ${formatDateTime(invitation.expiresAt, props.timeZone)}`
    case 'ACCEPTED':
      return `принято ${formatDateTime(invitation.acceptedAt, props.timeZone)}${
        invitation.acceptedBy ? ` · ${personName(invitation.acceptedBy)}` : ''
      }`
    case 'REVOKED':
      return `отозвано ${formatDateTime(invitation.revokedAt, props.timeZone)}`
    case 'EXPIRED':
      return `истекло ${formatDateTime(invitation.expiresAt, props.timeZone)}`
    default:
      return ''
  }
}
</script>

<template>
  <ul class="divide-y divide-line" aria-label="Приглашения">
    <li
      v-for="invitation in rows"
      :key="invitation.id"
      class="flex flex-wrap items-center justify-between gap-3 py-3"
    >
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-ink">{{ roleLabel(invitation.role) }}</span>
          <UiBadge :tone="invitationStatusTone(invitation.status)">
            {{ invitationStatusLabel(invitation.status) }}
          </UiBadge>
        </div>
        <p class="mt-0.5 text-xs text-muted">
          выпущено {{ formatDateTime(invitation.createdAt, timeZone) }} ·
          {{ personName(invitation.createdBy) }} · {{ describe(invitation) }}
        </p>
        <p v-if="invitation.note" class="mt-1 text-sm break-words text-ink">
          {{ invitation.note }}
        </p>
      </div>
      <RevokeInvitationButton
        v-if="invitation.status === 'PENDING'"
        :tenant-id="tenantId"
        :invitation="invitation"
      />
    </li>
  </ul>
</template>
