<script setup lang="ts">
/**
 * Форма «Записать исход». Исход `PAID` не создаёт выручку: об этом форма
 * напоминает явно, подтверждение суммы — отдельное действие. Отправка
 * идемпотентна так же, как у действия.
 */
import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiField, UiSelect, UiTextarea, type UiSelectOption } from '@/shared/ui'
import {
  OUTCOME_STATUSES,
  outcomeStatusLabel,
  type Outcome,
  type OutcomeStatus,
} from '@/entities/risk'
import { NOTE_MAX_LENGTH, recordOutcomeSchema } from '../model/schema'
import { useRecordOutcome } from '../model/use-record-outcome'

const props = defineProps<{
  riskId: string
  opportunityId: string
  disabled?: boolean | undefined
}>()
const emit = defineEmits<{ recorded: [outcome: Outcome] }>()

const record = useRecordOutcome(
  () => props.riskId,
  () => props.opportunityId,
)
const statusOptions: UiSelectOption[] = OUTCOME_STATUSES.map((value) => ({
  value,
  label: outcomeStatusLabel(value),
}))

const { defineField, handleSubmit, errors, resetForm, values } = useForm({
  validationSchema: toTypedSchema(recordOutcomeSchema),
  initialValues: { status: '', note: '' },
})
const [status] = defineField('status')
const [note] = defineField('note')

const paidHint = computed(() => values.status === 'PAID')
const errorView = computed(() =>
  record.status.value === 'error' && record.error.value ? describeError(record.error.value) : null,
)
const traceId = computed(() => (isApiError(record.error.value) ? record.error.value.traceId : ''))
const successText = computed(() => {
  if (record.status.value !== 'success' || !record.result.value) return null
  return record.result.value.replayed ? 'Этот исход уже был записан ранее.' : 'Исход записан.'
})

function finish(result: { outcome: Outcome } | null): void {
  if (!result) return
  emit('recorded', result.outcome)
  resetForm({ values: { status: '', note: '' } })
}

const isSubmitting = ref(false)
const commandLocked = computed(
  () =>
    isSubmitting.value ||
    record.isPending.value ||
    record.canRetry.value ||
    record.draft.value?.state === 'conflict',
)
const submit = handleSubmit(async (formValues) => {
  const draft = {
    status: formValues.status as OutcomeStatus,
    ...(formValues.note ? { note: formValues.note } : {}),
  }
  finish(await record.submit(draft))
})

async function onSubmit(event: Event) {
  if (isSubmitting.value) return
  isSubmitting.value = true
  try {
    await submit(event)
  } finally {
    isSubmitting.value = false
  }
}

async function retry(): Promise<void> {
  finish(await record.retry())
}
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Чем ответил клиент"
      :description="paidHint ? 'Оплата не считается выручкой: сумму подтверждают отдельно.' : ''"
      :error="errors.status"
    >
      <UiSelect
        :id="id"
        v-model="status"
        name="outcomeStatus"
        :options="statusOptions"
        placeholder="Выберите исход"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="disabled || commandLocked"
      />
    </UiField>
    <UiField v-slot="{ id, describedBy, invalid }" label="Заметка" :error="errors.note">
      <UiTextarea
        :id="id"
        v-model="note"
        name="outcomeNote"
        :rows="2"
        :maxlength="NOTE_MAX_LENGTH"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="disabled || commandLocked"
      />
    </UiField>

    <UiAlert v-if="successText" tone="success">{{ successText }}</UiAlert>
    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>
    <UiAlert v-if="record.canRetry.value" tone="warning" title="Результат неизвестен">
      Ответ сервера не получен. Повторите отправку — запись не задвоится.
      <p v-if="record.draft.value" class="mt-2">
        Сохранено: {{ outcomeStatusLabel(record.draft.value.body.status) }}.
        {{ record.draft.value.body.note }}
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <UiButton size="sm" :loading="record.isPending.value" @click="retry">
          Повторить отправку
        </UiButton>
      </div>
    </UiAlert>

    <UiButton
      type="submit"
      variant="secondary"
      block
      :disabled="disabled || commandLocked"
      :loading="record.isPending.value"
    >
      Записать исход
    </UiButton>
  </form>
</template>
