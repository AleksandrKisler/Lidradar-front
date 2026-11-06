<script setup lang="ts">
/** Одноразовый код живёт только в открытом окне текущего контекста. */
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { useQueryClient } from '@tanstack/vue-query'
import { describeError, isApiError, isUnknownResult } from '@/shared/api'
import { dayKey, formatCalendarDate, formatTime } from '@/shared/lib'
import { UiAlert, UiButton, UiSheetDialog, UiField, UiTextarea } from '@/shared/ui'
import { roleLabel } from '@/entities/session'
import {
  TeamRolePicker,
  createInvitation,
  teamKeys,
  type IssuedInvitation,
  type TeamRole,
} from '@/entities/team'
import { inviteMemberSchema } from '../model/schema'

const props = defineProps<{ tenantId: string; timeZone: string; contextKey?: string }>()
const emit = defineEmits<{ issued: [invitation: IssuedInvitation] }>()
const open = defineModel<boolean>('open', { default: false })
const queryClient = useQueryClient()
const { defineField, handleSubmit, errors, resetForm, submitCount } = useForm({
  validationSchema: toTypedSchema(inviteMemberSchema),
  initialValues: { role: 'MANAGER', note: '' },
})
const invalidNote = computed(() => submitCount.value > 0 && !!errors.value.note)
const [role] = defineField('role')
const [note] = defineField('note')
const pickedRole = computed<TeamRole>({
  get: () => role.value ?? 'MANAGER',
  set: (value) => {
    role.value = value
  },
})
const issued = ref<IssuedInvitation | null>(null)
const pending = ref(false)
const copied = ref(false)
const copyError = ref(false)
const copying = ref(false)
const error = ref<unknown>(null)
const unknown = ref(false)
const readError = ref(false)
const deadline = computed(() => {
  const value = issued.value?.invitation.expiresAt
  const day = dayKey(value, props.timeZone)
  return day
    ? `${formatCalendarDate(day).replace(/\s*г\.$/, '')}, ${formatTime(value, props.timeZone)}`
    : '—'
})
let generation = 0
let alive = true
const context = () => `${props.tenantId}:${props.contextKey ?? ''}`
const errorView = computed(() => (error.value ? describeError(error.value) : null))
const traceId = computed(() => (isApiError(error.value) ? error.value.traceId : ''))
const current = (key: string, version: number) =>
  alive && open.value && key === context() && version === generation
async function refreshList(): Promise<void> {
  const key = context(),
    version = generation,
    tenantId = props.tenantId
  try {
    await queryClient.refetchQueries(
      { queryKey: teamKeys.invitations(tenantId), type: 'active' },
      { throwOnError: true },
    )
    if (current(key, version)) readError.value = false
  } catch {
    if (current(key, version)) readError.value = true
  }
}
const onSubmit = handleSubmit(async (values) => {
  if (pending.value || unknown.value || issued.value) return
  const key = context(),
    version = generation,
    tenantId = props.tenantId
  pending.value = true
  error.value = null
  try {
    const result = await createInvitation(tenantId, {
      role: values.role,
      note: values.note || null,
    })
    if (!current(key, version)) return
    issued.value = result
    emit('issued', result)
    await refreshList()
  } catch (cause) {
    if (!current(key, version)) return
    error.value = cause
    unknown.value = isUnknownResult(cause)
  } finally {
    if (current(key, version)) pending.value = false
  }
})
async function copyCode(): Promise<void> {
  if (!issued.value || copying.value) return
  const key = context(),
    version = generation,
    code = issued.value.code
  copying.value = true
  copied.value = false
  copyError.value = false
  try {
    await navigator.clipboard.writeText(code)
    if (current(key, version)) copied.value = true
  } catch {
    if (current(key, version)) copyError.value = true
  } finally {
    if (current(key, version)) copying.value = false
  }
}
function clear(): void {
  generation++
  issued.value = null
  pending.value = false
  copied.value = copyError.value = copying.value = unknown.value = readError.value = false
  error.value = null
  resetForm()
}
watch(open, (value) => {
  if (!value) clear()
})
watch(context, () => {
  open.value = false
  clear()
})
onBeforeUnmount(() => {
  alive = false
  clear()
})
</script>
<template>
  <UiSheetDialog
    v-model:open="open"
    :title="issued ? 'Приглашение создано' : 'Пригласить участника'"
    size="sm"
    settings-redesign
    team-redesign
    footer-fill
    :footer-inset="16"
    :content-height="760"
    :dismissible="!pending"
    initial-focus="input[name=role]"
  >
    <div v-if="issued" class="flex flex-col gap-4 text-sm leading-5">
      <div class="rounded-card bg-success-pale p-4 text-success" role="status">
        <p>✓ Код создан</p>
        <p class="mt-1.5 text-ink">
          Приглашение ожидает принятия. Сообщение коллеге не отправлялось.
        </p>
      </div>
      <p class="text-base font-semibold">Роль: {{ roleLabel(issued.invitation.role) }}</p>
      <p v-if="issued.invitation.note" class="break-words text-muted">
        {{ issued.invitation.note }}
      </p>
      <code
        class="rounded-field bg-canvas p-4 font-sans break-all text-ink"
        data-testid="invitation-code"
        >{{ issued.code }}</code
      >
      <p class="text-muted">Действует до {{ deadline }} · 7 дней</p>
      <p>
        Код показывается один раз. Скопируйте его и передайте коллеге до закрытия окна. Затем
        получить этот код повторно нельзя.
      </p>
      <p v-if="copied" role="status" class="text-success">
        <span aria-hidden="true">✓ </span><span>Код скопирован</span>
      </p>
      <div v-if="copyError" role="alert" class="rounded-card bg-danger-pale p-4">
        <p class="text-danger">
          <span aria-hidden="true">! </span><span>Не удалось скопировать код</span>
        </p>
        <p class="mt-1.5 text-ink">Выделите код и скопируйте вручную или повторите попытку.</p>
      </div>
      <UiButton :loading="copying" @click="copyCode">{{
        copyError ? 'Повторить копирование' : copied ? 'Скопировать ещё раз' : 'Скопировать код'
      }}</UiButton>
      <UiAlert v-if="readError" tone="warning" title="Список приглашений не обновлён"
        >Код уже создан и остаётся доступен в этом окне.<button
          type="button"
          class="ml-1 text-link"
          @click="refreshList"
        >
          Обновить список
        </button></UiAlert
      >
    </div>
    <form
      v-else
      id="team-invite-form"
      class="flex flex-col gap-4 text-sm leading-5"
      novalidate
      @submit.prevent="onSubmit"
    >
      <p class="text-muted">
        Выберите роль и добавьте заметку для владельцев. Затем передайте созданный<br
          class="hidden md:block"
        />
        код коллеге.
      </p>
      <div v-if="errorView && !unknown" role="alert" class="rounded-card bg-danger-pale p-4">
        <p class="text-danger">! Не удалось создать приглашение</p>
        <p class="mt-1.5">Выбранная роль и заметка сохранены. Повторите создание.</p>
        <p v-if="isApiError(error) && [401, 403, 429].includes(error.httpStatus)" class="mt-1.5">
          {{ errorView.description }}
        </p>
        <p v-if="traceId" class="mt-2 text-xs text-muted">
          Идентификатор запроса: <code>{{ traceId }}</code>
        </p>
      </div>
      <div v-if="invalidNote" role="alert" class="rounded-card bg-danger-pale p-4">
        <p class="text-danger">! Проверьте заметку</p>
        <p class="mt-1.5">
          Допустимо не более 500 символов. Сократите текст, чтобы создать приглашение.
        </p>
      </div>
      <TeamRolePicker v-model="pickedRole" :disabled="pending || unknown" />
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Заметка · необязательно"
        label-style="compact"
        description="Видна только владельцам. До 500 символов."
        :error="errors.note"
      >
        <UiTextarea
          :id="id"
          v-model="note"
          name="note"
          :rows="4"
          style="height: 100px; font-size: 14px; line-height: 20px"
          :style="pending ? { opacity: 0.65, backgroundColor: 'var(--color-paper)' } : undefined"
          :maxlength="500"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="pending || unknown"
        />
      </UiField>
      <p class="text-xs leading-[18px] text-muted">
        Код действует 7 дней и используется один раз. Новый участник получит выбранную роль только
        после принятия.
      </p>
      <UiAlert v-if="unknown" tone="warning" title="Результат создания неизвестен"
        >Сервер мог создать приглашение, но ответ с кодом не получен. Код нельзя восстановить из
        списка. Обновите список и закройте окно. Новый выпуск — отдельное действие.<button
          type="button"
          class="ml-1 text-link"
          @click="refreshList"
        >
          Обновить список
        </button></UiAlert
      >
    </form>
    <template #footer>
      <UiButton v-if="issued" variant="secondary" @click="open = false">Готово</UiButton>
      <template v-else
        ><UiButton
          variant="secondary"
          class="disabled:bg-line disabled:text-muted disabled:opacity-100"
          :disabled="pending"
          @click="open = false"
          >Отмена</UiButton
        ><UiButton
          type="submit"
          form="team-invite-form"
          :loading="pending"
          :disabled="unknown || invalidNote"
          :class="pending ? undefined : 'disabled:bg-line disabled:text-muted disabled:opacity-100'"
          >{{ pending ? 'Создаём…' : 'Создать приглашение' }}</UiButton
        ></template
      >
    </template>
  </UiSheetDialog>
</template>
