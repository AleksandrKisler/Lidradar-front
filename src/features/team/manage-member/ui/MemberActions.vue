<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { UiButton, UiSheetDialog, UiTooltip } from '@/shared/ui'
import { roleLabel } from '@/entities/session'
import {
  memberActionAvailability,
  TeamIcon,
  TeamRolePicker,
  type Member,
  type TeamRole,
} from '@/entities/team'
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
  dialogChanged: [open: boolean]
}>()
const commands = useMemberCommands(() => props.tenantId)
const availability = computed(() => memberActionAvailability(props.member, props.members))
const self = computed(() => props.member.userId === props.currentUserId)
const dialog = ref<'role' | 'revoke' | 'demotion' | 'saved' | null>(null)
watch(dialog, (value) => emit('dialogChanged', value !== null))
const selected = ref<TeamRole>(props.member.role)
watch(selected, () => {
  if (dialog.value === 'saved') dialog.value = 'role'
})
const firstName = computed(
  () => props.member.displayName.trim().split(/\s+/)[0] || props.member.displayName,
)
const specializedError = computed(
  () => isApiError(error.value) && ['LAST_OWNER', 'MEMBER_DISABLED'].includes(error.value.code),
)
const pending = ref(false)
const error = ref<unknown>(null)
const errorView = computed(() => (error.value ? describeError(error.value) : null))
const traceId = computed(() => (isApiError(error.value) ? error.value.traceId : ''))
let generation = 0
let alive = true
const context = () => `${props.tenantId}:${props.currentUserId}:${props.member.userId}`
function start(kind: 'role' | 'revoke') {
  error.value = null
  selected.value = props.member.role
  dialog.value = kind
}
function close() {
  if (!pending.value) dialog.value = null
}
async function submit(kind: 'role' | 'revoke'): Promise<void> {
  if (pending.value || props.member.status !== 'ACTIVE') return
  if (kind === 'role' && (!availability.value.changeRole || selected.value === props.member.role))
    return
  if (kind === 'revoke' && !availability.value.revoke) return
  if (
    kind === 'role' &&
    self.value &&
    selected.value === 'MANAGER' &&
    dialog.value !== 'demotion'
  ) {
    dialog.value = 'demotion'
    return
  }
  const key = context(),
    version = generation
  const target = { tenantId: props.tenantId, member: { ...props.member }, self: self.value }
  const role = selected.value
  pending.value = true
  error.value = null
  try {
    if (kind === 'role') await commands.changeRole.mutateAsync({ ...target, role })
    else await commands.revoke.mutateAsync(target)
    if (!alive || key !== context() || generation !== version) return
    dialog.value = kind === 'role' && !target.self ? 'saved' : null
    if (kind === 'role') emit('roleChanged', target.member, role, target.self)
    else emit('revoked', target.member, target.self)
  } catch (cause) {
    if (alive && key === context() && generation === version) {
      error.value = cause
      if (isApiError(cause) && cause.code === 'LAST_OWNER') dialog.value = 'role'
    }
  } finally {
    if (alive && key === context() && generation === version) pending.value = false
  }
}
watch(context, () => {
  generation++
  pending.value = false
  error.value = null
  dialog.value = null
})
onBeforeUnmount(() => {
  alive = false
  generation++
})
</script>
<template>
  <div
    v-if="member.status === 'ACTIVE' || dialog !== null"
    class="flex items-center justify-end md:w-16 md:justify-center"
  >
    <template v-if="availability.changeRole">
      <UiTooltip v-slot="{ describedBy }" text="Изменить доступ">
        <button
          type="button"
          class="flex h-11 w-12 items-center justify-end rounded-field md:justify-center text-link hover:bg-canvas focus-visible:outline-2 focus-visible:outline-link"
          :aria-label="`Изменить доступ: ${member.displayName}`"
          :aria-describedby="describedBy"
          @click="start('role')"
        >
          <span class="flex size-7 items-center justify-center rounded-field"
            ><TeamIcon name="pencil"
          /></span>
        </button>
      </UiTooltip>
      <UiTooltip v-slot="{ describedBy }" text="Отозвать доступ">
        <button
          type="button"
          class="flex h-11 w-12 items-center justify-end rounded-field md:justify-center text-danger hover:bg-canvas focus-visible:outline-2 focus-visible:outline-link md:hidden"
          :aria-label="`Отозвать доступ: ${member.displayName}`"
          :aria-describedby="describedBy"
          @click="start('revoke')"
        >
          <span class="flex size-7 items-center justify-center rounded-field"
            ><TeamIcon name="trash"
          /></span>
        </button>
      </UiTooltip>
    </template>
    <UiSheetDialog
      :open="dialog !== null"
      :title="dialog === 'revoke' ? 'Отозвать доступ?' : 'Изменить доступ'"
      size="sm"
      settings-redesign
      team-redesign
      footer-fill
      :footer-inset="16"
      :content-height="dialog === 'revoke' ? 560 : 860"
      :dismissible="!pending"
      @update:open="(value) => !value && close()"
    >
      <div class="flex flex-col gap-4 text-sm leading-5">
        <p class="text-base font-semibold">{{ member.displayName }}{{ self ? ' · Вы' : '' }}</p>
        <p class="break-words text-muted">{{ member.email }}</p>
        <div v-if="dialog === 'saved'" class="rounded-card bg-success-pale p-4" role="status">
          <p class="text-success">✓ Роль изменена</p>
          <p class="mt-1.5">
            {{ member.displayName }} теперь {{ roleLabel(selected).toLowerCase() }} рабочего
            пространства.
          </p>
        </div>
        <div v-if="errorView" class="rounded-card bg-danger-pale p-4" role="alert">
          <p class="text-danger">
            !
            {{
              specializedError
                ? errorView.title
                : dialog === 'revoke'
                  ? 'Не удалось отозвать доступ'
                  : 'Не удалось изменить роль'
            }}
          </p>
          <p class="mt-1.5">
            {{
              specializedError
                ? errorView.description
                : dialog === 'revoke'
                  ? 'Операция не подтверждена. Повторите попытку.'
                  : 'Изменение не подтверждено. Выбранная роль сохранена в форме. Повторите попытку.'
            }}
          </p>
          <p v-if="traceId" class="mt-2 text-xs text-muted">
            Идентификатор запроса: <code>{{ traceId }}</code>
          </p>
        </div>
        <template v-if="dialog === 'role' || dialog === 'saved'">
          <p v-if="!availability.changeRole" class="text-muted">
            Вы — последний активный владелец. Сначала назначьте другого владельца: после этого можно
            изменить свою роль или отозвать доступ.
          </p>
          <TeamRolePicker v-model="selected" :disabled="pending || !availability.changeRole" />
          <div class="border-t border-line pt-4">
            <UiButton
              variant="ghost"
              class="w-full"
              :style="{
                fontSize: !availability.revoke && !pending ? '17px' : '14px',
                fontWeight: 400,
                color:
                  !availability.revoke && !pending ? 'var(--color-muted)' : 'var(--color-danger)',
                ...(!availability.revoke && !pending
                  ? { backgroundColor: 'var(--color-line)', opacity: 1 }
                  : {}),
              }"
              :disabled="pending || !availability.revoke"
              @click="dialog = 'revoke'"
              >Отозвать доступ...</UiButton
            >
          </div>
          <p class="text-xs leading-[18px] text-muted">
            Отзыв закроет доступ к пространству. История работы участника сохранится.
          </p>
        </template>
        <template v-else-if="dialog === 'demotion'">
          <h2 class="text-xl font-semibold">Вы станете менеджером</h2>
          <p>
            Управление командой, компанией и аналитика будут недоступны. В пространстве остаётся
            другой активный владелец.
          </p>
          <p class="text-muted">После подтверждения вы перейдёте в Radar.</p>
        </template>
        <template v-else>
          <p>
            {{
              self
                ? 'Вы отзываете собственный доступ и больше не сможете работать в этом пространстве.'
                : `${firstName} больше не сможет работать в этом пространстве.`
            }}
            История действий и результаты сохранятся.
          </p>
          <p class="text-xs leading-[18px] text-muted">
            Запись участника останется в списке «Без доступа».
          </p>
        </template>
      </div>
      <template #footer>
        <UiButton
          variant="secondary"
          class="disabled:bg-line disabled:text-muted disabled:opacity-100"
          :disabled="pending"
          @click="close"
          >{{ dialog === 'saved' ? 'Готово' : 'Отмена' }}</UiButton
        >
        <UiButton
          v-if="dialog === 'revoke'"
          variant="danger"
          :loading="pending"
          :disabled="!availability.revoke"
          @click="submit('revoke')"
          >{{ pending ? 'Отзываем…' : 'Отозвать доступ' }}</UiButton
        >
        <UiButton
          v-else
          :loading="pending"
          :disabled="!availability.changeRole || selected === member.role || dialog === 'saved'"
          :style="
            (!availability.changeRole || selected === member.role || dialog === 'saved') && !pending
              ? { backgroundColor: 'var(--color-line)', color: 'var(--color-muted)', opacity: 1 }
              : undefined
          "
          @click="submit('role')"
          >{{
            pending
              ? 'Сохраняем…'
              : dialog === 'saved'
                ? 'Сохранено'
                : dialog === 'demotion'
                  ? 'Стать менеджером'
                  : 'Сохранить роль'
          }}</UiButton
        >
      </template>
    </UiSheetDialog>
  </div>
</template>
