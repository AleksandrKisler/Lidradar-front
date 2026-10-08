<script setup lang="ts">
/**
 * Действия владельца над участником с подтверждением: смена роли и отзыв
 * доступа. Единственный активный владелец защищён на клиенте пояснением, а
 * на сервере — `409 LAST_OWNER`; скрытые кнопки не заменяют проверку прав.
 *
 * Раскладку задаёт ширина карточки таблицы (container query): на телефоне
 * кнопки делят строку поровну или встают друг под другом, в средней колонке
 * они своей ширины слева, в широкой — одна линия по правому краю, а пояснение
 * стоит под ними и не сдвигает кнопки.
 */
import { computed, ref } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiDialog, UiIcon } from '@/shared/ui'
import { roleLabel } from '@/entities/session'
import { memberActionAvailability, otherRole, type Member, type TeamRole } from '@/entities/team'
import { useMemberCommands } from '../model/use-member-commands'

const props = defineProps<{
  tenantId: string
  member: Member
  members: readonly Member[]
  currentUserId: string
}>()
const emit = defineEmits<{
  roleChanged: [member: Member, role: TeamRole, self: boolean]
  revoked: [member: Member, self: boolean]
}>()

const commands = useMemberCommands(() => props.tenantId)
const availability = computed(() => memberActionAvailability(props.member, props.members))
const self = computed(() => props.member.userId === props.currentUserId)
const targetRole = computed(() => otherRole(props.member.role))
const dialog = ref<'role' | 'revoke' | null>(null)

const pending = computed(
  () => commands.changeRole.isPending.value || commands.revoke.isPending.value,
)
const error = computed(() => commands.changeRole.error.value ?? commands.revoke.error.value)
const errorView = computed(() => (error.value ? describeError(error.value) : null))
const traceId = computed(() => (isApiError(error.value) ? error.value.traceId : ''))

const identity = computed(() => `${props.member.displayName} (${props.member.email})`)
const roleTitle = computed(() =>
  targetRole.value === 'OWNER' ? 'Сделать владельцем?' : 'Сделать менеджером?',
)
const roleDescription = computed(() => {
  if (targetRole.value === 'OWNER') {
    return `${identity.value} получит полный доступ: настройки компании, интеграции, аналитика и управление командой.`
  }
  return self.value
    ? 'Вы понижаете себя: разделы владельца закроются сразу после подтверждения. Работа с рисками и диалогами сохранится.'
    : `${identity.value} потеряет доступ к настройкам компании, интеграциям и составу команды. Работа с рисками и диалогами сохранится.`
})
const revokeDescription = computed(() =>
  self.value
    ? 'Вы отзываете собственный доступ: организация исчезнет из вашего списка, история действий сохранится.'
    : `${identity.value} больше не сможет войти в организацию. История действий и подтверждений сохранится; вернуть доступ можно новым кодом приглашения.`,
)

function openDialog(kind: 'role' | 'revoke'): void {
  commands.changeRole.reset()
  commands.revoke.reset()
  dialog.value = kind
}

async function confirmRole(): Promise<void> {
  const role = targetRole.value
  const ok = await commands.changeRole
    .mutateAsync({ member: props.member, role, self: self.value })
    .then(() => true)
    .catch(() => false)
  if (!ok) return
  dialog.value = null
  emit('roleChanged', props.member, role, self.value)
}

async function confirmRevoke(): Promise<void> {
  const ok = await commands.revoke
    .mutateAsync({ member: props.member, self: self.value })
    .then(() => true)
    .catch(() => false)
  if (!ok) return
  dialog.value = null
  emit('revoked', props.member, self.value)
}
</script>

<template>
  <div v-if="member.status === 'ACTIVE'" class="flex flex-col gap-2 @3xl:items-end">
    <div class="flex flex-wrap items-center gap-2 @3xl:min-h-11 @3xl:flex-nowrap @3xl:justify-end">
      <UiButton
        variant="secondary"
        size="sm"
        class="flex-1 @xl:flex-none"
        :disabled="!availability.changeRole"
        @click="openDialog('role')"
      >
        {{ targetRole === 'OWNER' ? 'Сделать владельцем' : 'Сделать менеджером' }}
      </UiButton>
      <UiButton
        variant="secondary"
        size="sm"
        class="flex-1 @xl:flex-none"
        :disabled="!availability.revoke"
        @click="openDialog('revoke')"
      >
        Отозвать доступ
      </UiButton>
    </div>
    <p v-if="availability.reason" class="flex max-w-72 items-start gap-1.5 text-xs text-muted">
      <UiIcon name="info" class="mt-px size-4" />
      <span>{{ availability.reason }}</span>
    </p>

    <UiDialog
      :open="dialog === 'role'"
      :title="roleTitle"
      :description="roleDescription"
      :dismissible="!pending"
      @update:open="(value) => (dialog = value ? 'role' : null)"
    >
      <p class="text-sm text-muted">
        Сейчас: {{ roleLabel(member.role) }} → станет: {{ roleLabel(targetRole) }}.
      </p>
      <UiAlert
        v-if="errorView && dialog === 'role'"
        tone="danger"
        :title="errorView.title"
        :trace-id="traceId"
      >
        {{ errorView.description }}
      </UiAlert>
      <template #footer>
        <UiButton variant="secondary" :disabled="pending" @click="dialog = null">Отмена</UiButton>
        <UiButton :loading="commands.changeRole.isPending.value" @click="confirmRole">
          Подтвердить
        </UiButton>
      </template>
    </UiDialog>

    <UiDialog
      :open="dialog === 'revoke'"
      title="Отозвать доступ?"
      :description="revokeDescription"
      :dismissible="!pending"
      @update:open="(value) => (dialog = value ? 'revoke' : null)"
    >
      <UiAlert
        v-if="errorView && dialog === 'revoke'"
        tone="danger"
        :title="errorView.title"
        :trace-id="traceId"
      >
        {{ errorView.description }}
      </UiAlert>
      <template #footer>
        <UiButton variant="secondary" :disabled="pending" @click="dialog = null">Отмена</UiButton>
        <UiButton
          variant="danger"
          :loading="commands.revoke.isPending.value"
          @click="confirmRevoke"
        >
          Отозвать доступ
        </UiButton>
      </template>
    </UiDialog>
  </div>
</template>
