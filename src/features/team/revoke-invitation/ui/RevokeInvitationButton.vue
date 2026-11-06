<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiSheetDialog, UiTooltip } from '@/shared/ui'
import { roleLabel } from '@/entities/session'
import { revokeInvitation, teamKeys, teamDate, TeamIcon, type Invitation } from '@/entities/team'
const props = defineProps<{ tenantId: string; invitation: Invitation; timeZone?: string }>()
const emit = defineEmits<{ revoked: [invitation: Invitation] }>()
const queryClient = useQueryClient()
const open = ref(false),
  pending = ref(false),
  error = ref<unknown>(null)
const refreshError = ref<unknown>(null)
let generation = 0,
  alive = true
const context = () => `${props.tenantId}:${props.invitation.id}`
const errorView = computed(() => (error.value ? describeError(error.value) : null))
const traceId = computed(() => (isApiError(error.value) ? error.value.traceId : ''))
const used = computed(() => isApiError(error.value) && error.value.code === 'INVITATION_USED')
function start() {
  error.value = null
  refreshError.value = null
  open.value = true
}
async function confirm(): Promise<void> {
  if (pending.value || used.value || props.invitation.status !== 'PENDING') return
  const key = context(),
    version = generation,
    tenantId = props.tenantId,
    invitation = { ...props.invitation }
  pending.value = true
  try {
    await revokeInvitation(tenantId, invitation.id)
    if (!alive || key !== context() || version !== generation) return
    open.value = false
    emit('revoked', invitation)
  } catch (cause) {
    if (alive && key === context() && version === generation) error.value = cause
  } finally {
    if (alive && key === context() && version === generation) {
      pending.value = false
      await queryClient.invalidateQueries({ queryKey: teamKeys.invitations(tenantId) })
    }
  }
}
async function refreshTeam(): Promise<void> {
  if (pending.value) return
  const key = context(),
    version = generation,
    tenantId = props.tenantId
  pending.value = true
  refreshError.value = null
  try {
    await Promise.all([
      queryClient.refetchQueries(
        { queryKey: teamKeys.members(tenantId), type: 'active' },
        { throwOnError: true },
      ),
      queryClient.refetchQueries(
        { queryKey: teamKeys.invitations(tenantId), type: 'active' },
        { throwOnError: true },
      ),
    ])
    if (alive && key === context() && version === generation) open.value = false
  } catch (cause) {
    if (alive && key === context() && version === generation) refreshError.value = cause
  } finally {
    if (alive && key === context() && version === generation) pending.value = false
  }
}
watch(context, () => {
  generation++
  open.value = pending.value = false
  error.value = null
})
onBeforeUnmount(() => {
  alive = false
  generation++
})
</script>
<template>
  <UiTooltip v-slot="{ describedBy }" text="Отозвать приглашение">
    <button
      v-if="invitation.status === 'PENDING'"
      type="button"
      class="flex h-11 w-12 items-center justify-end rounded-field md:justify-center text-danger hover:bg-canvas focus-visible:outline-2 focus-visible:outline-link"
      :aria-label="`Отозвать приглашение: ${invitation.note || roleLabel(invitation.role)}`"
      :aria-describedby="describedBy"
      @click="start"
    >
      <span class="flex size-7 items-center justify-center rounded-field"
        ><TeamIcon name="trash"
      /></span>
    </button>
  </UiTooltip>
  <UiSheetDialog
    v-model:open="open"
    title="Отозвать приглашение?"
    size="sm"
    settings-redesign
    team-redesign
    footer-fill
    :footer-inset="16"
    :content-height="560"
    :dismissible="!pending"
  >
    <div class="flex flex-col gap-4 text-sm leading-5">
      <p class="break-words text-base font-semibold">
        {{ invitation.note || 'Приглашение в команду' }}
      </p>
      <p class="text-muted">
        {{ roleLabel(invitation.role) }} · Создано
        {{ teamDate(invitation.createdAt, timeZone ?? 'UTC') }}
      </p>
      <div v-if="errorView" role="alert" class="rounded-card bg-danger-pale p-4">
        <p class="text-danger">
          ! {{ used ? 'Приглашение уже принято' : 'Не удалось отозвать приглашение' }}
        </p>
        <p class="mt-1.5">
          {{
            used
              ? 'Отозвать использованный код нельзя. Обновите команду, чтобы управлять доступом участника.'
              : 'Операция не подтверждена. Повторите попытку.'
          }}
        </p>
        <p v-if="traceId" class="mt-2 text-xs text-muted">
          Идентификатор запроса: <code>{{ traceId }}</code>
        </p>
      </div>
      <p v-if="!used">
        Код перестанет предоставлять доступ. Человек, которому вы его передали, не сможет принять
        это приглашение.
      </p>
      <p class="text-xs leading-[18px] text-muted">
        {{
          used
            ? 'Приглашение останется в списке со статусом «Принято».'
            : errorView
              ? 'Отозванное приглашение останется в списке со своим статусом.'
              : 'Отозванное приглашение останется в списке с датой отзыва.'
        }}
      </p>
      <UiAlert v-if="refreshError" compact tone="danger" title="Не удалось обновить команду"
        >Повторите обновление. Приглашение уже принято, отзыв не отправляется повторно.</UiAlert
      >
    </div>
    <template #footer
      ><UiButton
        variant="secondary"
        class="disabled:bg-line disabled:text-muted disabled:opacity-100"
        :disabled="pending"
        @click="open = false"
        >Отмена</UiButton
      ><UiButton
        :variant="used ? 'secondary' : 'danger'"
        :loading="pending"
        @click="used ? refreshTeam() : confirm()"
        >{{
          pending
            ? used
              ? 'Обновляем…'
              : 'Отзываем…'
            : used
              ? 'Обновить команду'
              : 'Отозвать приглашение'
        }}</UiButton
      ></template
    >
  </UiSheetDialog>
</template>
