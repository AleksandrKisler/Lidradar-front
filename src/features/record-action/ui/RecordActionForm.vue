<script setup lang="ts">
/**
 * Форма «Записать действие».
 *
 * Отправка идемпотентна: при неизвестном результате (сеть, таймаут, ошибка
 * сервера) кнопка «Повторить» шлёт тот же запрос с тем же ключом; новый ключ
 * появляется после однозначного ответа, отмены или изменения полей. Успех и
 * повтор прежнего результата объявляются в live-области разными фразами.
 */
import { computed } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiField, UiSelect, UiTextarea, type UiSelectOption } from '@/shared/ui'
import { MANUAL_ACTION_TYPES, actionTypeLabel, type Action, type ActionType } from '@/entities/risk'
import { NOTE_MAX_LENGTH, recordActionSchema } from '../model/schema'
import { useRecordAction } from '../model/use-record-action'

const props = defineProps<{ riskId: string; disabled?: boolean | undefined }>()
const emit = defineEmits<{ recorded: [action: Action] }>()

const record = useRecordAction(() => props.riskId)
const typeOptions: UiSelectOption[] = MANUAL_ACTION_TYPES.map((value) => ({
  value,
  label: actionTypeLabel(value),
}))

const { defineField, handleSubmit, errors, resetForm } = useForm({
  validationSchema: toTypedSchema(recordActionSchema),
  initialValues: { type: '', note: '' },
})
const [type] = defineField('type')
const [note] = defineField('note')

const errorView = computed(() =>
  record.status.value === 'error' && record.error.value ? describeError(record.error.value) : null,
)
const traceId = computed(() => (isApiError(record.error.value) ? record.error.value.traceId : ''))
const successText = computed(() => {
  if (record.status.value !== 'success' || !record.result.value) return null
  return record.result.value.replayed
    ? 'Это действие уже было записано ранее.'
    : 'Действие записано.'
})

function finish(result: { action: Action } | null): void {
  if (!result) return
  emit('recorded', result.action)
  resetForm({ values: { type: '', note: '' } })
}

const onSubmit = handleSubmit(async (values) => {
  const draft = { type: values.type as ActionType, ...(values.note ? { note: values.note } : {}) }
  finish(await record.submit(draft))
})

async function retry(): Promise<void> {
  finish(await record.retry())
}
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
    <UiField v-slot="{ id, describedBy, invalid }" label="Что сделано" :error="errors.type">
      <UiSelect
        :id="id"
        v-model="type"
        name="actionType"
        :options="typeOptions"
        placeholder="Выберите действие"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="disabled || record.isPending.value"
      />
    </UiField>
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Заметка"
      description="Необязательно: что именно сказали или отправили клиенту."
      :error="errors.note"
    >
      <UiTextarea
        :id="id"
        v-model="note"
        name="actionNote"
        :rows="3"
        :maxlength="NOTE_MAX_LENGTH"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="disabled || record.isPending.value"
      />
    </UiField>

    <UiAlert v-if="successText" tone="success">{{ successText }}</UiAlert>
    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>
    <UiAlert v-if="record.canRetry.value" tone="warning" title="Результат неизвестен">
      Ответ сервера не получен. Повторите отправку — запись не задвоится.
      <div class="mt-3 flex flex-wrap gap-2">
        <UiButton size="sm" :loading="record.isPending.value" @click="retry">
          Повторить отправку
        </UiButton>
        <UiButton size="sm" variant="ghost" @click="record.reset()">Отменить</UiButton>
      </div>
    </UiAlert>

    <UiButton
      type="submit"
      block
      :disabled="disabled || record.canRetry.value"
      :loading="record.isPending.value"
    >
      Записать действие
    </UiButton>
  </form>
</template>
