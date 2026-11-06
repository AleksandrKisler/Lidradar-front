<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { tenantScope } from '@/shared/api'
import { UiButton, UiErrorState, UiSkeleton, UiTooltip } from '@/shared/ui'
import { roleLabel, useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import {
  TeamIcon,
  useInvitationsQuery,
  useMembersQuery,
  type Member,
  type IssuedInvitation,
} from '@/entities/team'
import { InviteMemberDialog } from '@/features/team/invite-member'
import { InvitationsList, MembersTable } from '@/widgets/team'
import SettingsPageHead from './SettingsPageHead.vue'
const session = useSessionStore(),
  router = useRouter(),
  queryClient = useQueryClient()
const leaving = ref(false),
  inviteOpen = ref(false)
const notice = ref<{ title: string; message: string } | null>(null)
const sessionError = ref<unknown>(null)
const selfContext = ref<{ tenantId: string | null; userId: string; key: string } | null>(null)
const refreshingSession = ref(false)
const allowed = computed(() => session.can('member.manage'))
const activeTenant = () => (!leaving.value && allowed.value ? session.tenantId : null)
const tenantId = computed(() => session.tenantId ?? '')
const currentUserId = computed(() => session.user?.id ?? '')
const context = computed(() => `${tenantId.value}:${currentUserId.value}`)
const organization = useOrganizationQuery(activeTenant)
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')
const members = useMembersQuery(activeTenant),
  invitations = useInvitationsQuery(activeTenant)
const initialFailure = computed(
  () =>
    !members.data.value &&
    !invitations.data.value &&
    members.isError.value &&
    invitations.isError.value,
)
const staleFailure = computed(
  () =>
    (members.isError.value && !!members.data.value) ||
    (invitations.isError.value && !!invitations.data.value),
)
const refreshLists = () => Promise.all([members.refetch(), invitations.refetch()])
const active = computed(() =>
  (members.data.value ?? []).filter((member) => member.status !== 'DISABLED'),
)
const disabled = computed(() =>
  (members.data.value ?? []).filter((member) => member.status === 'DISABLED'),
)
const subtitle = computed(
  () =>
    `${organization.data.value?.name ?? session.memberships.find((item) => item.tenantId === tenantId.value)?.organizationName ?? 'Организация'} · Управление командой`,
)
watch(context, () => {
  inviteOpen.value = false
  notice.value = null
  leaving.value = false
  sessionError.value = null
  selfContext.value = null
})
async function refreshOwnSession() {
  const target = selfContext.value
  if (!target || refreshingSession.value || target.key !== context.value) return
  refreshingSession.value = true
  sessionError.value = null
  try {
    await session.refresh()
    if (
      currentUserId.value === target.userId &&
      (target.key === context.value ||
        !session.memberships.some((item) => item.tenantId === target.tenantId))
    )
      await router.replace({ name: 'radar' })
  } catch (error) {
    if (target.key === context.value) sessionError.value = error
  } finally {
    refreshingSession.value = false
  }
}
async function refreshAfterSelfChange(self: boolean) {
  if (!self) return
  const target = { tenantId: session.tenantId, userId: currentUserId.value, key: context.value }
  selfContext.value = target
  leaving.value = true
  if (target.tenantId) {
    await queryClient.cancelQueries({ queryKey: tenantScope(target.tenantId) })
    queryClient.removeQueries({ queryKey: tenantScope(target.tenantId) })
  }
  if (target.key === context.value) await refreshOwnSession()
}
async function onRoleChanged(member: Member, _role: string, self: boolean) {
  if (!self)
    notice.value = {
      title: `Роль изменена: ${member.displayName}`,
      message: 'Изменение применено.',
    }
  await refreshAfterSelfChange(self)
}
async function onRevoked(member: Member, self: boolean) {
  if (!self)
    notice.value = {
      title: `Доступ отозван: ${member.displayName}`,
      message: 'История работы сохранена.',
    }
  await refreshAfterSelfChange(self)
}
function onInvitationIssued(result: IssuedInvitation) {
  // Keep only presentation text; the one-time code stays inside the open dialog.
  notice.value = {
    title: 'Приглашение создано',
    message: `Роль: ${roleLabel(result.invitation.role)}. Код показан только в открытом диалоге.`,
  }
}
function onInvitationRevoked() {
  notice.value = { title: 'Приглашение отозвано', message: 'Код больше не предоставляет доступ.' }
}
</script>
<template>
  <div class="flex min-w-0 flex-col gap-6 pb-2 md:max-lg:-mx-2">
    <SettingsPageHead
      title="Команда и доступ"
      :subtitle="subtitle"
      :hide-tabs="!allowed"
      scrolling-tabs
      compact-mobile-title
      :mobile-tab-offset="564"
    />
    <section v-if="leaving" class="rounded-card border border-line bg-paper p-4 md:p-6">
      <UiErrorState
        v-if="sessionError"
        :error="sessionError"
        title="Доступ изменён. Не удалось обновить сессию"
        @retry="refreshOwnSession"
      />
      <p v-else role="status" class="text-sm text-muted">Обновляем доступ…</p>
      <p v-if="sessionError" class="mt-3 text-sm text-muted">
        Изменение подтверждено. Повторяется только загрузка прав, без повторной команды.
      </p>
    </section>
    <section
      v-else-if="!allowed"
      class="flex flex-col gap-4 rounded-card border border-line bg-paper p-4 md:p-6"
    >
      <h2 class="text-xl leading-7 font-semibold">Раздел доступен владельцу</h2>
      <p class="text-sm leading-5 text-muted">
        Ваша роль — менеджер. Управлять участниками и приглашениями может владелец рабочего
        пространства.
      </p>
      <UiButton
        variant="secondary"
        class="w-full md:w-[220px]"
        @click="router.push({ name: 'radar' })"
        >Перейти в Radar</UiButton
      >
    </section>
    <section
      v-else-if="initialFailure"
      class="flex flex-col gap-4 rounded-card border border-line bg-paper p-4 md:p-6"
    >
      <h2 class="text-xl leading-7 font-semibold">Не удалось загрузить команду</h2>
      <p class="text-sm leading-5 text-muted">Проверьте соединение и повторите попытку.</p>
      <UiButton variant="secondary" class="w-full md:w-auto md:self-start" @click="refreshLists"
        >Повторить загрузку</UiButton
      >
    </section>
    <template v-else>
      <div
        v-if="staleFailure || notice"
        :role="staleFailure ? 'alert' : 'status'"
        class="rounded-card p-4 text-sm leading-5"
        :class="staleFailure ? 'bg-danger-pale' : 'bg-success-pale'"
      >
        <p :class="staleFailure ? 'text-danger' : 'text-success'">
          {{ staleFailure ? '! Не удалось обновить команду' : `✓ ${notice!.title}` }}
        </p>
        <p class="mt-1.5">
          {{
            staleFailure
              ? 'Показаны последние загруженные данные. Повторите обновление.'
              : notice!.message
          }}
        </p>
      </div>
      <section
        class="flex min-w-0 flex-col gap-4 rounded-card border border-line bg-paper p-4 md:p-6"
        aria-labelledby="members-title"
      >
        <div class="flex items-center justify-between gap-4">
          <h2 id="members-title" class="min-w-0 text-xl leading-7 font-semibold text-ink">
            {{ members.isPending.value ? 'Участники' : 'Участники с доступом' }}
          </h2>
          <UiTooltip v-slot="{ describedBy }" text="Пригласить участника"
            ><button
              type="button"
              class="flex h-11 w-12 shrink-0 items-center justify-center rounded-field text-link hover:bg-canvas focus-visible:outline-2 focus-visible:outline-link"
              aria-label="Пригласить участника"
              :aria-describedby="describedBy"
              :disabled="members.isPending.value"
              :class="members.isPending.value ? 'bg-canvas opacity-45' : ''"
              @click="inviteOpen = true"
            >
              <TeamIcon name="plus" /></button
          ></UiTooltip>
        </div>
        <p class="text-sm leading-5 text-muted">
          Владелец управляет командой. Менеджер работает с рисками, диалогами, действиями и
          оплатами.
        </p>
        <div v-if="members.isPending.value" role="status" aria-label="Загрузка команды">
          <div
            class="hidden items-center gap-5 border-b border-line pb-4 text-xs leading-[18px] text-muted md:flex"
            aria-hidden="true"
          >
            <span class="min-w-0 flex-1">Участник</span><span class="w-[250px]">Роль и доступ</span
            ><span class="w-16 text-center">Действие</span>
          </div>
          <div class="pt-4">
            <div
              v-for="i in 4"
              :key="i"
              class="px-4 pt-4"
              :style="{ height: i === 4 ? '46px' : '62px' }"
            >
              <UiSkeleton
                class="w-[210px] max-w-full rounded bg-line md:w-[400px]"
                style="height: 14px; border-radius: 4px; background-color: var(--color-line)"
              />
            </div>
          </div>
        </div>
        <UiErrorState
          v-if="members.isError.value && !members.data.value"
          :error="members.error.value"
          :title="
            members.data.value
              ? 'Не удалось обновить участников'
              : 'Не удалось загрузить участников'
          "
          @retry="members.refetch()"
        />
        <MembersTable
          v-if="members.data.value"
          :key="context"
          :tenant-id="tenantId"
          :members="active"
          :all-members="members.data.value"
          :current-user-id="currentUserId"
          :time-zone="timeZone"
          headings
          @role-changed="onRoleChanged"
          @revoked="onRevoked"
        />
      </section>
      <section
        v-if="disabled.length"
        class="flex min-w-0 flex-col gap-4 rounded-card border border-line bg-paper p-4 md:p-6"
        aria-labelledby="disabled-title"
      >
        <h2 id="disabled-title" class="text-xl leading-7 font-semibold text-ink">Без доступа</h2>
        <p class="text-sm leading-5 text-muted">
          Эти участники больше не могут войти в рабочее пространство. История работы сохранена.
        </p>
        <MembersTable
          :tenant-id="tenantId"
          :members="disabled"
          :all-members="members.data.value ?? []"
          :current-user-id="currentUserId"
          :time-zone="timeZone"
        />
      </section>
      <section
        class="flex min-w-0 flex-col gap-4 rounded-card border border-line bg-paper p-4 md:p-6"
        aria-labelledby="invitations-title"
      >
        <h2 id="invitations-title" class="text-xl leading-7 font-semibold text-ink">Приглашения</h2>
        <p class="text-sm leading-5 text-muted">
          Одноразовый код действует 7 дней. Вы передаёте его коллеге самостоятельно.
        </p>
        <div v-if="invitations.isPending.value" role="status" aria-label="Загрузка приглашений">
          <p class="text-sm leading-5 text-muted">Загружаем приглашения...</p>
        </div>
        <template v-if="invitations.isError.value && !invitations.data.value">
          <div role="alert" class="rounded-card bg-danger-pale p-4 text-sm leading-5">
            <p class="text-danger">! Не удалось загрузить приглашения</p>
            <p class="mt-1.5">Список участников доступен.</p>
          </div>
          <UiButton
            variant="secondary"
            class="w-full md:w-auto md:self-start"
            @click="invitations.refetch()"
            >Повторить загрузку</UiButton
          >
        </template>
        <InvitationsList
          v-if="invitations.data.value?.length"
          :key="context"
          :tenant-id="tenantId"
          :invitations="invitations.data.value"
          :as-of="invitations.dataUpdatedAt.value"
          :members="members.data.value ?? []"
          :time-zone="timeZone"
          @revoked="onInvitationRevoked"
        />
        <template v-else-if="invitations.data.value">
          <h3 class="text-base leading-[22px] font-semibold">Ожидающих приглашений нет</h3>
          <p class="text-sm leading-5 text-muted">
            Чтобы предоставить доступ коллеге, создайте новое приглашение.
          </p>
        </template>
      </section>
      <UiButton
        v-if="staleFailure"
        variant="secondary"
        class="w-full md:w-auto md:self-start"
        @click="refreshLists"
        >Повторить обновление</UiButton
      >
      <p class="text-xs leading-[18px] text-muted">
        Роли и доступ меняются отдельными действиями. Удаление истории работы не выполняется.
      </p>
      <InviteMemberDialog
        :key="context"
        v-model:open="inviteOpen"
        :tenant-id="tenantId"
        :context-key="currentUserId"
        :time-zone="timeZone"
        @issued="onInvitationIssued"
      />
    </template>
  </div>
</template>
