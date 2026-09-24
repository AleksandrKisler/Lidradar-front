<script setup lang="ts">
/**
 * Участники компании (макет 12): текущий пользователь помечен «вы», отозванные
 * остаются в списке с датой — на них ссылаются факты, история сохраняется.
 */
import { computed } from 'vue'
import { formatDateTime } from '@/shared/lib'
import { UiBadge } from '@/shared/ui'
import { roleLabel } from '@/entities/session'
import {
  memberInitials,
  memberStatusLabel,
  memberStatusTone,
  sortMembers,
  type Member,
  type TeamRole,
} from '@/entities/team'
import { MemberActions } from '@/features/team/manage-member'

const props = defineProps<{
  tenantId: string
  members: Member[]
  currentUserId: string
  timeZone: string
}>()
const emit = defineEmits<{
  roleChanged: [member: Member, role: TeamRole, self: boolean]
  revoked: [member: Member, self: boolean]
}>()

const rows = computed(() => sortMembers(props.members))
</script>

<template>
  <!-- Прокручиваемая область доступна с клавиатуры даже когда все кнопки в ней отключены. -->
  <div class="relative overflow-x-auto" tabindex="0" role="region" aria-label="Таблица участников">
    <table class="w-full min-w-[640px] text-left text-sm">
      <caption class="sr-only">
        Участники компании
      </caption>
      <thead>
        <tr class="text-xs font-semibold tracking-wide text-muted uppercase">
          <th scope="col" class="pb-2">Сотрудник</th>
          <th scope="col" class="pb-2">Роль</th>
          <th scope="col" class="pb-2">Доступ</th>
          <th scope="col" class="pb-2"><span class="sr-only">Действия</span></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line">
        <tr v-for="member in rows" :key="member.membershipId">
          <td class="py-3 pr-4">
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-pale text-sm font-bold text-brand-dark"
                aria-hidden="true"
              >
                {{ memberInitials(member.displayName, member.email) }}
              </span>
              <span class="min-w-0">
                <span
                  class="block font-semibold break-words"
                  :class="member.status === 'ACTIVE' ? 'text-ink' : 'text-muted'"
                >
                  {{ member.displayName
                  }}<span v-if="member.userId === currentUserId" class="text-muted"> · вы</span>
                </span>
                <span class="block text-xs break-all text-muted">{{ member.email }}</span>
              </span>
            </div>
          </td>
          <td class="py-3 pr-4">
            <UiBadge :tone="member.role === 'OWNER' ? 'brand' : 'neutral'">
              {{ roleLabel(member.role) }}
            </UiBadge>
          </td>
          <td class="py-3 pr-4">
            <div class="flex flex-col gap-1">
              <UiBadge :tone="memberStatusTone(member.status)">
                {{ memberStatusLabel(member.status) }}
              </UiBadge>
              <span v-if="member.revokedAt" class="text-xs text-muted">
                {{ formatDateTime(member.revokedAt, timeZone) }}
              </span>
            </div>
          </td>
          <td class="py-3">
            <MemberActions
              :tenant-id="tenantId"
              :member="member"
              :members="members"
              :current-user-id="currentUserId"
              @role-changed="(target, role, self) => emit('roleChanged', target, role, self)"
              @revoked="(target, self) => emit('revoked', target, self)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
