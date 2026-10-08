<script setup lang="ts">
/**
 * Форма точки: создание (`location` не задана) или изменение. При изменении
 * отправляются только изменённые поля; флаг активности доступен только
 * существующей точке — при создании сервер его отклоняет.
 */
import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiField, UiInput, UiSelect } from '@/shared/ui'
import { timeZoneOptions } from '@/entities/organization'
import {
  AGREEMENT_THRESHOLD_DEFAULT,
  RESPONSE_THRESHOLD_DEFAULT,
  type Location,
  type UpdateLocationRequest,
} from '@/entities/location'
import { locationSchema } from '../model/schema'
import { useSaveLocation } from '../model/use-save-location'

const props = defineProps<{
  tenantId: string
  location: Location | null
  defaultTimezone: string
  submitLabel?: string | undefined
}>()
const emit = defineEmits<{ saved: [location: Location]; cancel: [] }>()

const zones = timeZoneOptions()
const save = useSaveLocation(() => props.tenantId)

const { defineField, handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(locationSchema),
  initialValues: {
    name: props.location?.name ?? '',
    timezone: props.location?.timezone ?? props.defaultTimezone,
    responseThresholdMinutes: String(
      props.location?.responseThresholdMinutes ?? RESPONSE_THRESHOLD_DEFAULT,
    ),
    agreementThresholdMinutes: String(
      props.location?.agreementThresholdMinutes ?? AGREEMENT_THRESHOLD_DEFAULT,
    ),
    active: props.location?.active ?? true,
  },
})
const [name] = defineField('name')
const [timezone] = defineField('timezone')
const [responseThresholdMinutes] = defineField('responseThresholdMinutes')
const [agreementThresholdMinutes] = defineField('agreementThresholdMinutes')
const [active] = defineField('active')

const errorView = computed(() => (save.error.value ? describeError(save.error.value) : null))
const traceId = computed(() => (isApiError(save.error.value) ? save.error.value.traceId : ''))

const isSubmitting = ref(false)
const submit = handleSubmit(async (values) => {
  const minutes = Number(values.responseThresholdMinutes)
  const agreementMinutes = Number(values.agreementThresholdMinutes)
  let result: Location | null
  if (props.location) {
    const body: UpdateLocationRequest = {}
    if (values.name !== props.location.name) body.name = values.name
    if (values.timezone !== props.location.timezone) body.timezone = values.timezone
    if (minutes !== props.location.responseThresholdMinutes) body.responseThresholdMinutes = minutes
    if (agreementMinutes !== props.location.agreementThresholdMinutes)
      body.agreementThresholdMinutes = agreementMinutes
    if (values.active !== props.location.active) body.active = values.active
    if (Object.keys(body).length === 0) {
      emit('saved', props.location)
      return
    }
    result = await save
      .mutateAsync({ kind: 'update', locationId: props.location.id, body })
      .catch(() => null)
  } else {
    result = await save
      .mutateAsync({
        kind: 'create',
        body: {
          name: values.name,
          timezone: values.timezone,
          responseThresholdMinutes: minutes,
          agreementThresholdMinutes: agreementMinutes,
        },
      })
      .catch(() => null)
  }
  if (result) emit('saved', result)
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
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
    <UiField v-slot="{ id, describedBy, invalid }" label="Название точки" :error="errors.name">
      <UiInput
        :id="id"
        v-model="name"
        name="locationName"
        placeholder="Студия на Пресне"
        :maxlength="200"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="isSubmitting"
      />
    </UiField>
    <div class="grid gap-5 sm:grid-cols-2">
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Часовой пояс точки"
        :error="errors.timezone"
      >
        <UiSelect
          :id="id"
          v-model="timezone"
          name="locationTimezone"
          :options="zones"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="isSubmitting"
        />
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Порог ответа, минут"
        description="Дольше — появится риск «нет ответа клиенту». Считается только в рабочее время точки."
        :error="errors.responseThresholdMinutes"
      >
        <UiInput
          :id="id"
          v-model="responseThresholdMinutes"
          name="responseThresholdMinutes"
          inputmode="numeric"
          :maxlength="4"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="isSubmitting"
        />
      </UiField>
    </div>
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Ожидание следующего шага, рабочих минут"
      description="Через сколько рабочего времени напомнить о договорённости, если следующий шаг ещё не сделан. Например, клиент не подтвердил время или точка не ответила на просьбу о переносе."
      :error="errors.agreementThresholdMinutes"
    >
      <UiInput
        :id="id"
        v-model="agreementThresholdMinutes"
        name="agreementThresholdMinutes"
        inputmode="numeric"
        :maxlength="4"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="isSubmitting"
      />
    </UiField>
    <label v-if="location" class="flex items-center gap-2 text-sm text-ink">
      <input
        v-model="active"
        type="checkbox"
        name="locationActive"
        class="size-4 accent-brand"
        :disabled="isSubmitting"
      />
      Точка активна
    </label>

    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>

    <div class="flex flex-wrap justify-end gap-3">
      <UiButton variant="secondary" :disabled="isSubmitting" @click="emit('cancel')">
        Отмена
      </UiButton>
      <UiButton type="submit" :loading="isSubmitting">
        {{ submitLabel ?? (location ? 'Сохранить' : 'Создать точку') }}
      </UiButton>
    </div>
  </form>
</template>
