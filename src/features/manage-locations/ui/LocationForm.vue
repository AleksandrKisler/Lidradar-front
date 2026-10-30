<script setup lang="ts">
/**
 * Форма точки: создание (`location` не задана) или изменение. При изменении
 * отправляются только изменённые поля; флаг активности доступен только
 * существующей точке — при создании сервер его отклоняет.
 */
import { computed, ref, watch } from 'vue'
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
  /**
   * `dialog` — поля окна «Добавить/Изменить точку» (Figma «Настройки»): без собственных кнопок, форма
   * отправляется кнопкой нижней панели окна по `formId`, а занятость отдаётся событием `busy`.
   */
  variant?: 'inline' | 'dialog' | undefined
  formId?: string | undefined
  /** `onboarding` — окно на шаге «Точка и график»: пояснение о графике относится к этому шагу. */
  context?: 'settings' | 'onboarding' | undefined
}>()
const emit = defineEmits<{
  saved: [location: Location]
  cancel: []
  busy: [busy: boolean]
  /** Отправка не удалась: вызывающий сам решает, нужна ли сверка при неизвестном исходе. */
  failed: [error: unknown]
}>()

const zones = timeZoneOptions()
const save = useSaveLocation()

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
watch(isSubmitting, (busy) => emit('busy', busy))
const activeValue = computed({
  get: () => (active.value ? 'active' : 'inactive'),
  set: (value) => (active.value = value === 'active'),
})
const stateOptions = [
  { value: 'active', label: 'Активна' },
  { value: 'inactive', label: 'Неактивна' },
]
/**
 * Организация команды фиксируется при нажатии, до асинхронной валидации и запроса: смена
 * выбранной организации не перенаправляет начатую команду, а её ответ не применяется к новой.
 */
let commandTenant = ''
const submit = handleSubmit(async (values) => {
  const tenantId = commandTenant
  const sameContext = () => props.tenantId === tenantId
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
      if (sameContext()) emit('saved', props.location)
      return
    }
    result = await save
      .mutateAsync({ tenantId, kind: 'update', locationId: props.location.id, body })
      .catch((error: unknown) => {
        if (sameContext()) emit('failed', error)
        return null
      })
  } else {
    result = await save
      .mutateAsync({
        tenantId,
        kind: 'create',
        body: {
          name: values.name,
          timezone: values.timezone,
          responseThresholdMinutes: minutes,
          agreementThresholdMinutes: agreementMinutes,
        },
      })
      .catch((error: unknown) => {
        if (sameContext()) emit('failed', error)
        return null
      })
  }
  if (result && sameContext()) emit('saved', result)
})

async function onSubmit(event: Event) {
  if (isSubmitting.value) return
  isSubmitting.value = true
  commandTenant = props.tenantId
  try {
    await submit(event)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <form
    v-if="variant === 'dialog'"
    :id="formId"
    :class="[
      'flex flex-col gap-4 max-md:[&_p]:text-base max-md:[&_p]:leading-6',
      context === 'onboarding'
        ? 'max-md:[&_label]:text-base max-md:[&_label]:leading-6'
        : 'max-lg:[&_label]:text-base max-lg:[&_label]:leading-6',
    ]"
    novalidate
    @submit.prevent="onSubmit"
  >
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Название точки"
      label-style="compact"
      :error="errors.name"
    >
      <UiInput
        :id="id"
        v-model="name"
        name="locationName"
        placeholder="Например, Студия на Арбате"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="isSubmitting"
      />
    </UiField>
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Часовой пояс"
      label-style="compact"
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
    <div class="grid grid-cols-2 gap-4">
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Нет ответа, мин"
        label-style="compact"
        description="От 1 до 1 440 рабочих минут"
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
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Следующий шаг, мин"
        label-style="compact"
        description="От 1 до 1 440 рабочих минут"
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
    </div>
    <UiField
      v-if="location"
      v-slot="{ id, describedBy }"
      label="Состояние точки"
      label-style="compact"
    >
      <UiSelect
        :id="id"
        v-model="activeValue"
        name="locationActive"
        :options="stateOptions"
        :described-by="describedBy"
        :disabled="isSubmitting"
      />
    </UiField>
    <p
      v-if="location"
      :class="
        context === 'onboarding'
          ? 'text-sm leading-5 text-muted max-md:text-base max-md:leading-6 max-md:font-semibold'
          : 'text-sm leading-5 text-muted max-lg:text-base max-lg:leading-6 max-lg:font-semibold max-lg:text-ink'
      "
    >
      {{
        context === 'onboarding'
          ? 'График этой точки настраивается справа на шаге «Точка и график».'
          : 'График этой точки настраивается отдельно, на странице «Компания и график».'
      }}
    </p>
    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>
  </form>

  <form v-else class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
    <UiField v-slot="{ id, describedBy, invalid }" label="Название точки" :error="errors.name">
      <UiInput
        :id="id"
        v-model="name"
        name="locationName"
        placeholder="Студия на Пресне"
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
