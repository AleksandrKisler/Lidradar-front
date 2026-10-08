<script setup lang="ts">
/**
 * Участники компании (макет 12): текущий пользователь помечен «вы», отозванные
 * остаются в списке с датой — на них ссылаются факты, история сохраняется.
 *
 * Раскладка выбирается по ширине самой карточки (container query), а не окна.
 * В широкой — таблица из четырёх столбцов: бейджи и кнопки стоят на одной
 * линии с центром аватара, заметка о защите владельца висит под кнопками.
 * В узкой — каждый участник блоком: человек, затем роль и доступ, затем
 * действия; горизонтальной прокрутки нет, кнопки не уходят за край. Роли ARIA
 * заданы явно, чтобы смена `display` не стёрла табличную семантику.
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

/** Места переноса длинной почты: после «@», «.», «_» и «-», а не посреди слова. */
const emailParts = (email: string) => email.match(/[^@._-]+[@._-]?|[@._-]/g) ?? [email]
</script>

<template>
  <div class="@container">
    <table role="table" class="block w-full text-left text-sm @3xl:table">
      <caption class="sr-only">
        Участники компании
      </caption>
      <thead role="rowgroup" class="sr-only @3xl:not-sr-only @3xl:table-header-group">
        <tr role="row" class="@3xl:table-row">
          <th
            scope="col"
            role="columnheader"
            class="border-b border-line pr-4 pb-3 text-xs font-medium text-muted"
          >
            Сотрудник
          </th>
          <th
            scope="col"
            role="columnheader"
            class="w-32 border-b border-line pr-4 pb-3 text-xs font-medium text-muted"
          >
            Роль
          </th>
          <th
            scope="col"
            role="columnheader"
            class="w-44 border-b border-line pr-4 pb-3 text-xs font-medium text-muted"
          >
            Доступ
          </th>
          <th scope="col" role="columnheader" class="w-px border-b border-line pb-3">
            <span class="sr-only">Действия</span>
          </th>
        </tr>
      </thead>
      <tbody role="rowgroup" class="block divide-y divide-line @3xl:table-row-group">
        <tr
          v-for="member in rows"
          :key="member.membershipId"
          role="row"
          class="flex flex-wrap items-center gap-x-2 gap-y-3 py-4 @3xl:table-row"
        >
          <td
            role="cell"
            class="basis-full @3xl:table-cell @3xl:basis-auto @3xl:py-4 @3xl:pr-4 @3xl:align-top"
          >
            <div class="flex items-start gap-3">
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-pale text-sm font-medium text-brand-dark"
                aria-hidden="true"
              >
                {{ memberInitials(member.displayName, member.email) }}
              </span>
              <span class="mt-0.5 min-w-0">
                <span
                  class="block text-base font-medium [overflow-wrap:anywhere]"
                  :class="member.status === 'ACTIVE' ? 'text-ink' : 'text-muted'"
                >
                  {{ member.displayName
                  }}<span v-if="member.userId === currentUserId" class="font-normal text-muted">
                    · вы</span
                  >
                </span>
                <span class="block text-sm text-muted [overflow-wrap:anywhere]"
                  ><template v-for="(part, index) in emailParts(member.email)" :key="index"
                    >{{ part }}<wbr /></template
                ></span>
              </span>
            </div>
          </td>
          <td role="cell" class="@3xl:table-cell @3xl:py-4 @3xl:pr-4 @3xl:align-top">
            <div class="flex items-center @3xl:min-h-11">
              <UiBadge :tone="member.role === 'OWNER' ? 'brand' : 'neutral'">
                {{ roleLabel(member.role) }}
              </UiBadge>
            </div>
          </td>
          <td
            role="cell"
            class="flex flex-wrap items-center gap-x-2 gap-y-1 @3xl:table-cell @3xl:py-4 @3xl:pr-4 @3xl:align-top"
          >
            <div class="flex items-center @3xl:min-h-11">
              <UiBadge :tone="memberStatusTone(member.status)">
                {{ memberStatusLabel(member.status) }}
              </UiBadge>
            </div>
            <p v-if="member.revokedAt" class="text-xs text-muted">
              {{ formatDateTime(member.revokedAt, timeZone) }}
            </p>
          </td>
          <td
            role="cell"
            class="basis-full @3xl:table-cell @3xl:basis-auto @3xl:py-4 @3xl:align-top"
          >
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
