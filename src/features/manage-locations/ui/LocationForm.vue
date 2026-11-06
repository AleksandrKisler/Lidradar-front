<script setup lang="ts">
/**
 * Форма точки: создание (`location` не задана) или изменение. При изменении
 * отправляются только изменённые поля; флаг активности доступен только
 * существующей точке — при создании сервер его отклоняет.
 */
import { computed, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError, isUnknownResult } from '@/shared/api'
import { UiAlert, UiGlyph, UiButton, UiField, UiInput, UiSelect } from '@/shared/ui'
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

const settingsDialog = computed(() => props.variant === 'dialog' && props.context !== 'onboarding')
const fieldLabelClass = computed(() =>
  props.context === 'onboarding'
    ? 'max-md:text-base max-md:leading-6'
    : settingsDialog.value
      ? ''
      : 'max-lg:text-base max-lg:leading-6',
)
const fieldDescriptionClass = computed(() =>
  props.variant === 'dialog' && props.context === 'onboarding'
    ? 'max-md:text-base max-md:leading-6'
    : '',
)
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
const uncertainCreate = computed(
  () =>
    settingsDialog.value &&
    !props.location &&
    Boolean(save.error.value) &&
    isUnknownResult(save.error.value),
)
const traceId = computed(() => (isApiError(save.error.value) ? save.error.value.traceId : ''))

const isSubmitting = ref(false)
const suffixClass = computed(() =>
  settingsDialog.value
    ? isSubmitting.value
      ? 'text-ink opacity-50'
      : 'text-ink'
    : 'right-3.5 text-secondary',
)
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
  if (isSubmitting.value || uncertainCreate.value) return
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
    :id="formId"
    :class="[
      settingsDialog ? 'lr-lf' : '',
      variant === 'dialog' ? 'flex flex-col gap-4' : 'flex flex-col gap-5',
    ]"
    novalidate
    @submit.prevent="onSubmit"
  >
    <UiField
      v-slot="{ id, describedBy, invalid }"
      :label-class="fieldLabelClass"
      :description-class="fieldDescriptionClass"
      :muted-description="settingsDialog"
      label="Название точки"
      :label-style="variant === 'dialog' ? 'compact' : 'default'"
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
      :label-class="fieldLabelClass"
      :description-class="fieldDescriptionClass"
      :muted-description="settingsDialog"
      :label="variant === 'dialog' ? 'Часовой пояс' : 'Часовой пояс точки'"
      :label-style="variant === 'dialog' ? 'compact' : 'default'"
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
    <div :class="variant === 'dialog' ? 'grid grid-cols-2 gap-4' : 'grid gap-5 sm:grid-cols-2'">
      <UiField
        v-slot="{ id, describedBy, invalid }"
        :label-class="fieldLabelClass"
        :description-class="fieldDescriptionClass"
        :muted-description="settingsDialog"
        :label="variant === 'dialog' ? 'Нет ответа' : 'Порог ответа, минут'"
        :touch-help="settingsDialog"
        :help="
          variant === 'dialog'
            ? settingsDialog
              ? 'Через сколько рабочих минут ожидания ответа клиенту появляется риск «Нет ответа». Вне графика точки время не считается.'
              : 'Дольше — появится риск «нет ответа клиенту». Считается только в рабочее время точки.'
            : undefined
        "
        :label-style="variant === 'dialog' ? 'compact' : 'default'"
        description="От 1 до 1 440 рабочих минут"
        :error="errors.responseThresholdMinutes"
      >
        <div class="relative">
          <UiInput
            :id="id"
            v-model="responseThresholdMinutes"
            class="pr-12"
            name="responseThresholdMinutes"
            inputmode="numeric"
            :maxlength="4"
            :described-by="describedBy"
            :invalid="invalid"
            :disabled="isSubmitting"
          />
          <span
            class="pointer-events-none absolute top-1/2 -translate-y-1/2 text-field"
            :class="suffixClass"
            :style="{
              left: settingsDialog
                ? `calc(14px + ${String(responseThresholdMinutes ?? '').length}ch + 4px)`
                : undefined,
            }"
            aria-hidden="true"
            >мин</span
          >
        </div>
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        :label-class="fieldLabelClass"
        :description-class="fieldDescriptionClass"
        :muted-description="settingsDialog"
        :label="variant === 'dialog' ? 'Следующий шаг' : 'Ожидание следующего шага, рабочих минут'"
        :touch-help="settingsDialog"
        :help="
          variant === 'dialog'
            ? settingsDialog
              ? 'Через сколько рабочих минут без следующего действия появляется риск «Следующий шаг». Вне графика точки время не считается.'
              : 'Через сколько рабочего времени напомнить о договорённости, если следующий шаг ещё не сделан. Например, клиент не подтвердил время или точка не ответила на просьбу о переносе.'
            : undefined
        "
        :label-style="variant === 'dialog' ? 'compact' : 'default'"
        description="От 1 до 1 440 рабочих минут"
        :help-align-end="true"
        :error="errors.agreementThresholdMinutes"
      >
        <div class="relative">
          <UiInput
            :id="id"
            v-model="agreementThresholdMinutes"
            class="pr-12"
            name="agreementThresholdMinutes"
            inputmode="numeric"
            :maxlength="4"
            :described-by="describedBy"
            :invalid="invalid"
            :disabled="isSubmitting"
          />
          <span
            class="pointer-events-none absolute top-1/2 -translate-y-1/2 text-field"
            :class="suffixClass"
            :style="{
              left: settingsDialog
                ? `calc(14px + ${String(agreementThresholdMinutes ?? '').length}ch + 4px)`
                : undefined,
            }"
            aria-hidden="true"
            >мин</span
          >
        </div>
      </UiField>
    </div>
    <UiField
      v-if="location && variant === 'dialog'"
      v-slot="{ id, describedBy }"
      :label-class="fieldLabelClass"
      :description-class="fieldDescriptionClass"
      :muted-description="settingsDialog"
      label="Состояние точки"
      :label-style="variant === 'dialog' ? 'compact' : 'default'"
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
      v-if="location && variant === 'dialog'"
      :class="
        context === 'onboarding'
          ? 'text-sm leading-5 text-muted max-md:text-base max-md:leading-6 max-md:font-semibold'
          : 'text-sm leading-5 text-muted'
      "
    >
      {{
        context === 'onboarding'
          ? 'График этой точки настраивается справа на шаге «Точка и график».'
          : 'График этой точки настраивается отдельно, на странице «Компания и график».'
      }}
    </p>
    <label v-if="location && variant !== 'dialog'" class="flex items-center gap-2 text-sm text-ink">
      <input
        v-model="active"
        type="checkbox"
        name="locationActive"
        class="size-4 accent-brand"
        :disabled="isSubmitting"
      />
      Точка активна
    </label>
    <UiAlert
      v-if="errorView"
      :class="settingsDialog ? 'max-md:border-danger/35 md:mt-2' : ''"
      :text-class="fieldDescriptionClass"
      tone="danger"
      :title="
        uncertainCreate
          ? 'Результат создания неизвестен'
          : settingsDialog
            ? 'Не удалось сохранить точку'
            : errorView.title
      "
      :trace-id="traceId"
    >
      {{
        uncertainCreate
          ? 'Проверьте список точек перед новой попыткой: точка могла быть создана. Повторная отправка заблокирована.'
          : settingsDialog
            ? 'Введённые данные остались в форме. Повторите сохранение.'
            : errorView.description
      }}
      <template v-if="settingsDialog" #icon
        ><UiGlyph name="circle-alert" class="size-5"
      /></template>
    </UiAlert>
    <div v-if="variant !== 'dialog'" class="flex flex-wrap justify-end gap-3">
      <UiButton variant="secondary" :disabled="isSubmitting" @click="emit('cancel')">
        Отмена
      </UiButton>
      <UiButton type="submit" :loading="isSubmitting">
        {{ submitLabel ?? (location ? 'Сохранить' : 'Создать точку') }}
      </UiButton>
    </div>
  </form>
</template>

<style>
.lr-lf input::placeholder {
  color: var(--color-muted);
}
.lr-lf :is(input, select):disabled {
  background-color: var(--color-canvas);
  opacity: 0.5;
}
</style>
