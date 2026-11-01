<script setup lang="ts">
import { computed, ref } from 'vue'
import { roleLabel } from '@/entities/session'
import {
  memberActionAvailability,
  teamDate,
  memberStatusLabel,
  type Member,
  type TeamRole,
} from '@/entities/team'
import { MemberActions } from '@/features/team/manage-member'
const props = defineProps<{
  tenantId: string
  members: Member[]
  allMembers?: Member[]
  currentUserId: string
  timeZone: string
  headings?: boolean
}>()
const emit = defineEmits<{
  roleChanged: [member: Member, role: TeamRole, self: boolean]
  revoked: [member: Member, self: boolean]
}>()
// A concurrent revoke may move the target to another section while its command is
// settling. Keep that mounted editor until the user closes it; rows disappear after close.
const openTargets = ref(new Map<string, Member>())
function trackDialog(member: Member, open: boolean) {
  if (open) openTargets.value.set(member.userId, member)
  else openTargets.value.delete(member.userId)
}
const rows = computed(() => {
  const retained = [...openTargets.value.values()]
    .filter((target) => !props.members.some((member) => member.userId === target.userId))
    .map((target) => props.allMembers?.find((member) => member.userId === target.userId) ?? target)
  const all = [...props.members, ...retained]
  // Owners remain first; preserve API order inside each group (including historical rows).
  return [
    ...all.filter((member) => member.status === 'ACTIVE' && member.role === 'OWNER'),
    ...all.filter((member) => member.status !== 'ACTIVE' || member.role !== 'OWNER'),
  ]
})
const emailParts = (email: string) => email.match(/[^@._-]+[@._-]?|[@._-]/g) ?? [email]
</script>
<template>
  <div>
    <div
      v-if="headings"
      class="hidden items-center gap-5 border-b border-line pb-4 text-xs leading-[18px] text-muted md:flex"
      aria-hidden="true"
    >
      <span class="min-w-0 flex-1">Участник</span><span class="w-[250px]">Роль и доступ</span
      ><span class="w-16 text-center">Действие</span>
    </div>
    <ul
      class="divide-y divide-line"
      :class="headings ? 'md:pt-4' : ''"
      aria-label="Участники компании"
    >
      <li
        v-for="member in rows"
        :key="member.membershipId"
        class="relative flex min-w-0 flex-col gap-2 py-[10px]"
      >
        <div class="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:gap-5">
          <div class="order-2 min-w-0 flex-1 md:order-none">
            <p class="text-base leading-[22px] font-semibold break-words text-ink">
              {{ member.displayName }}<span v-if="member.userId === currentUserId"> · Вы</span>
            </p>
            <p
              v-if="member.email"
              class="mt-1 text-sm leading-5 text-muted [overflow-wrap:anywhere]"
            >
              <template v-for="(part, index) in emailParts(member.email)" :key="index"
                >{{ part }}<wbr
              /></template>
            </p>
            <p v-else class="mt-1 text-sm leading-5 text-muted" data-testid="member-closed-account">
              Учётная запись закрыта
            </p>
          </div>
          <div
            class="order-1 flex min-w-0 items-center justify-between gap-3 md:order-none md:w-[250px] md:justify-start"
          >
            <span class="text-sm leading-5 text-ink">{{ roleLabel(member.role) }}</span>
            <span
              class="flex h-7 items-center rounded-full px-[10px] text-xs leading-[18px]"
              :class="
                member.status === 'ACTIVE' ? 'bg-success-pale text-success' : 'bg-canvas text-muted'
              "
              >{{
                member.status === 'ACTIVE'
                  ? '✓ Активен'
                  : member.status === 'DISABLED'
                    ? 'Отозван'
                    : memberStatusLabel(member.status)
              }}</span
            >
          </div>
          <div
            v-if="
              memberActionAvailability(member, allMembers ?? members).changeRole ||
              openTargets.has(member.userId)
            "
            class="order-3 flex justify-end md:order-none"
          >
            <MemberActions
              :tenant-id="tenantId"
              :member="member"
              :members="allMembers ?? members"
              :current-user-id="currentUserId"
              @dialog-changed="(open) => trackDialog(member, open)"
              @role-changed="(target, role, self) => emit('roleChanged', target, role, self)"
              @revoked="(target, self) => emit('revoked', target, self)"
            />
          </div>
          <span v-else class="hidden w-16 md:block" />
        </div>
        <p
          v-if="memberActionAvailability(member, allMembers ?? members).reason"
          class="text-xs leading-[18px] text-muted"
        >
          Последний владелец. Сначала назначьте ещё одного владельца.
        </p>
        <p v-if="member.revokedAt" class="text-xs leading-[18px] text-muted">
          Отозван {{ teamDate(member.revokedAt, timeZone, !!member.email) }}
        </p>
      </li>
    </ul>
  </div>
</template>
