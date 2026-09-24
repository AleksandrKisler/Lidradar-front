<script setup lang="ts">
/**
 * Выпуск одноразового кода приглашения. Код приходит в ответе единственный
 * раз: диалог показывает его с кнопкой копирования и уничтожает при закрытии.
 * Письма LidRadar не отправляет — код передаёт сам владелец.
 */
import { computed, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { describeError, isApiError } from '@/shared/api'
import { formatDateTime } from '@/shared/lib'
import {
  UiAlert,
  UiButton,
  UiDialog,
  UiField,
  UiSelect,
  UiTextarea,
  type UiSelectOption,
} from '@/shared/ui'
import { roleLabel } from '@/entities/session'
import { TEAM_ROLES, createInvitation, teamKeys, type IssuedInvitation } from '@/entities/team'
import { inviteMemberSchema, type InviteMemberValues } from '../model/schema'

const props = defineProps<{ tenantId: string; timeZone: string }>()
const emit = defineEmits<{ issued: [invitation: IssuedInvitation] }>()
const open = defineModel<boolean>('open', { default: false })

const queryClient = useQueryClient()
const roleOptions: UiSelectOption[] = TEAM_ROLES.map((role) => ({
  value: role,
  label: roleLabel(role),
}))

const { defineField, handleSubmit, errors, resetForm, isSubmitting } = useForm({
  validationSchema: toTypedSchema(inviteMemberSchema),
  initialValues: { role: 'MANAGER', note: '' },
})
const [role] = defineField('role')
const [note] = defineField('note')

const issued = ref<IssuedInvitation | null>(null)
const copied = ref(false)

const create = useMutation({
  mutationFn: (values: InviteMemberValues) =>
    createInvitation(props.tenantId, { role: values.role, note: values.note || null }),
  onSuccess: async (result) => {
    issued.value = result
    await queryClient.invalidateQueries({ queryKey: teamKeys.invitations(props.tenantId) })
    emit('issued', result)
  },
})
const errorView = computed(() => (create.error.value ? describeError(create.error.value) : null))
const traceId = computed(() => (isApiError(create.error.value) ? create.error.value.traceId : ''))

/** Синхронный замок: две отправки в окне проверки формы не выпускают два кода. */
let inFlight = false
const onSubmit = handleSubmit(async (values) => {
  if (inFlight) return
  inFlight = true
  try {
    copied.value = false
    await create.mutateAsync(values).catch(() => null)
  } finally {
    inFlight = false
  }
})

async function copyCode(): Promise<void> {
  if (!issued.value) return
  try {
    await navigator.clipboard.writeText(issued.value.code)
    copied.value = true
  } catch {
    copied.value = false
  }
}

function finish(): void {
  open.value = false
}

// Закрытие уничтожает код и черновик: повторно код получить нельзя.
watch(open, (isOpen) => {
  if (isOpen) return
  issued.value = null
  copied.value = false
  create.reset()
  resetForm()
})
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Пригласить в команду"
    description="Сотрудник войдёт в LidRadar и введёт код приглашения — письмо отправлять не нужно."
    :dismissible="!create.isPending.value"
  >
    <div v-if="issued" class="flex flex-col gap-4">
      <div class="rounded-control border border-warning/40 bg-warning-pale p-4">
        <p class="text-sm font-semibold text-ink">Код приглашения — показывается один раз</p>
        <p class="mt-1 text-xs text-ink/70">
          Передайте код сотруднику сами. После закрытия окна код получить нельзя — только выпустить
          новый.
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <code
            class="rounded-field bg-paper px-3 py-2 text-sm break-all text-ink"
            data-testid="invitation-code"
          >
            {{ issued.code }}
          </code>
          <UiButton size="sm" variant="secondary" @click="copyCode">Скопировать</UiButton>
          <span v-if="copied" class="text-xs text-success" role="status">Скопировано</span>
        </div>
      </div>
      <p class="text-sm text-ink">
        Роль — {{ roleLabel(issued.invitation.role) }}. Код действует до
        {{ formatDateTime(issued.invitation.expiresAt, timeZone) }} и работает один раз: сотрудник
        входит или регистрируется, затем открывает «Принять приглашение» и вводит код.
      </p>
      <div class="flex justify-end">
        <UiButton @click="finish">Готово</UiButton>
      </div>
    </div>

    <form v-else class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
      <UiField v-slot="{ id, describedBy, invalid }" label="Роль" :error="errors.role">
        <UiSelect
          :id="id"
          v-model="role"
          name="role"
          :options="roleOptions"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="create.isPending.value"
        />
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Заметка для себя"
        description="Кому предназначен код. Сотрудник заметку не увидит."
        :error="errors.note"
      >
        <UiTextarea
          :id="id"
          v-model="note"
          name="note"
          :rows="2"
          :maxlength="500"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="create.isPending.value"
        />
      </UiField>
      <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
        {{ errorView.description }}
      </UiAlert>
      <div class="flex flex-wrap justify-end gap-3">
        <UiButton variant="secondary" :disabled="create.isPending.value" @click="finish">
          Отмена
        </UiButton>
        <UiButton type="submit" :loading="create.isPending.value || isSubmitting">
          Выпустить код
        </UiButton>
      </div>
    </form>
  </UiDialog>
</template>
