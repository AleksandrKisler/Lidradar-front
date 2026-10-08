<script setup lang="ts">
/**
 * Команда и доступ (макет 12): участники, приглашения по одноразовым кодам,
 * описание ролей. Только для владельца (`member.manage`). Действия над собой
 * завершают контекст организации безопасно: сначала убираются её данные из
 * кеша, затем перечитывается сессия, и маршрутизатор выбирает, куда вести.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { tenantScope } from '@/shared/api'
import {
  UiAlert,
  UiButton,
  UiCard,
  UiEmptyState,
  UiErrorState,
  UiIcon,
  UiPageHeader,
  UiSkeleton,
} from '@/shared/ui'
import { roleLabel, useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import {
  ROLE_CAPABILITIES,
  TEAM_ROLES,
  useInvitationsQuery,
  useMembersQuery,
  type Member,
} from '@/entities/team'
import { InviteMemberDialog } from '@/features/team/invite-member'
import { InvitationsList, MembersTable } from '@/widgets/team'
import SettingsTabs from './SettingsTabs.vue'

const session = useSessionStore()
const router = useRouter()
const queryClient = useQueryClient()

/** После действия над собой запросы этой организации больше не выполняются. */
const leaving = ref(false)
const activeTenant = () => (leaving.value ? null : session.tenantId)
const tenantId = computed(() => session.tenantId ?? '')
const currentUserId = computed(() => session.user?.id ?? '')

const organization = useOrganizationQuery(activeTenant)
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')
const members = useMembersQuery(activeTenant)
const invitations = useInvitationsQuery(activeTenant)

const inviteOpen = ref(false)

async function leaveTenant(): Promise<void> {
  const previous = session.tenantId
  leaving.value = true
  if (previous) {
    await queryClient.cancelQueries({ queryKey: tenantScope(previous) })
    queryClient.removeQueries({ queryKey: tenantScope(previous) })
  }
  await session.refresh()
  await router.replace({ name: 'radar' })
}

async function onRoleChanged(_member: Member, _role: string, self: boolean): Promise<void> {
  if (!self) return
  // Собственная роль изменилась: права берутся из перечитанной сессии.
  await session.refresh()
  if (!session.can('member.manage')) await router.replace({ name: 'settings' })
}

async function onRevoked(_member: Member, self: boolean): Promise<void> {
  if (self) await leaveTenant()
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiPageHeader
      title="Команда и доступ"
      subtitle="Каждый сотрудник видит только разрешённое рабочее пространство"
    />
    <SettingsTabs />

    <UiCard as="section" aria-labelledby="members-title">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div class="min-w-0">
          <h2 id="members-title" class="text-lg font-bold text-ink">Участники компании</h2>
          <p class="mt-1 text-sm text-muted">Доступ можно отозвать, не теряя историю действий.</p>
        </div>
        <UiButton class="w-full sm:w-auto" @click="inviteOpen = true">Пригласить</UiButton>
      </div>
      <div v-if="members.isPending.value" class="mt-6" role="status" aria-label="Загрузка команды">
        <UiSkeleton class="h-12 w-full" />
        <UiSkeleton class="mt-2 h-12 w-full" />
      </div>
      <UiErrorState
        v-else-if="members.isError.value"
        class="mt-6"
        :error="members.error.value"
        title="Не удалось загрузить участников"
        @retry="members.refetch()"
      />
      <div v-else-if="members.data.value" class="mt-6">
        <MembersTable
          :tenant-id="tenantId"
          :members="members.data.value"
          :current-user-id="currentUserId"
          :time-zone="timeZone"
          @role-changed="onRoleChanged"
          @revoked="onRevoked"
        />
      </div>
    </UiCard>

    <UiCard as="section" aria-labelledby="invitations-title">
      <h2 id="invitations-title" class="text-lg font-bold text-ink">Приглашения</h2>
      <p class="mt-1 text-sm text-muted">
        Код показывается один раз при выпуске и действует 7 дней. Письма LidRadar не отправляет.
      </p>
      <div
        v-if="invitations.isPending.value"
        class="mt-4"
        role="status"
        aria-label="Загрузка приглашений"
      >
        <UiSkeleton class="h-10 w-full" />
      </div>
      <UiErrorState
        v-else-if="invitations.isError.value"
        class="mt-4"
        :error="invitations.error.value"
        title="Не удалось загрузить приглашения"
        @retry="invitations.refetch()"
      />
      <UiEmptyState
        v-else-if="invitations.data.value && invitations.data.value.length === 0"
        title="Приглашений пока нет"
        description="Выпустите код и передайте его сотруднику: после входа он введёт код и увидит организацию."
      />
      <div v-else-if="invitations.data.value" class="mt-2">
        <InvitationsList
          :tenant-id="tenantId"
          :invitations="invitations.data.value"
          :members="members.data.value ?? []"
          :time-zone="timeZone"
        />
      </div>
    </UiCard>

    <div class="grid gap-6 md:grid-cols-2">
      <UiCard v-for="role in TEAM_ROLES" :key="role" as="section" :aria-labelledby="`role-${role}`">
        <h2 :id="`role-${role}`" class="text-lg font-bold text-ink">{{ roleLabel(role) }}</h2>
        <ul class="mt-4 flex flex-col gap-3 text-sm text-ink">
          <li v-for="item in ROLE_CAPABILITIES[role].can" :key="item" class="flex gap-3">
            <UiIcon name="check" class="size-5 text-success" />
            <span>{{ item }}</span>
          </li>
          <li
            v-for="item in ROLE_CAPABILITIES[role].cannot"
            :key="item"
            class="flex gap-3 text-muted"
          >
            <UiIcon name="lock" class="size-5" />
            <span>{{ item }}</span>
          </li>
        </ul>
      </UiCard>
    </div>

    <UiAlert tone="info" title="История сохраняется">
      Отозванный доступ закрывает вход в организацию, но не удаляет прежние подтверждения.
    </UiAlert>

    <InviteMemberDialog v-model:open="inviteOpen" :tenant-id="tenantId" :time-zone="timeZone" />
  </div>
</template>
