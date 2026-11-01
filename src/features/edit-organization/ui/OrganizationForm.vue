<script setup lang="ts">
/**
 * Настройки организации: название, часовой пояс и валюта.
 *
 * Отправляются только изменённые поля. Смена часового пояса или валюты
 * меняет календарные окна аналитики и часы уведомлений, а исторические
 * суммы не конвертируются, поэтому такие изменения подтверждаются отдельно.
 * После сохранения перечитываются организация, аналитика и `/auth/me`
 * (название видно в переключателе пространств).
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { describeError, isApiError, tenantScope } from '@/shared/api'
import { UiAlert, UiGlyph, UiButton, UiField, UiInput, UiSelect, UiSheetDialog } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import {
  CURRENCY_OPTIONS,
  organizationKeys,
  timeZoneOptions,
  updateOrganization,
  type Organization,
  type UpdateOrganizationRequest,
} from '@/entities/organization'
import { organizationSchema } from '../model/schema'

const props = defineProps<{ tenantId: string; organization: Organization }>()
const emit = defineEmits<{
  saved: [organization: Organization]
  status: [value: 'saving' | 'saved' | 'error' | 'dirty' | 'idle']
}>()

const session = useSessionStore()
const queryClient = useQueryClient()
const zones = timeZoneOptions()
/** Валюта в макете подписана кодом и знаком: «RUB · ₽». */
const currencies = CURRENCY_OPTIONS.map((option) => ({
  value: option.value,
  label: `${option.value} · ${option.label.split(' · ').at(-1)}`,
}))

const { defineField, handleSubmit, errors, resetForm, setFieldValue, values, meta } = useForm({
  validationSchema: toTypedSchema(organizationSchema),
  initialValues: {
    name: props.organization.name,
    defaultTimezone: props.organization.defaultTimezone,
    defaultCurrency: props.organization.defaultCurrency,
  },
})
const [name] = defineField('name')
const [defaultTimezone] = defineField('defaultTimezone')
const [defaultCurrency] = defineField('defaultCurrency')

type Command = { tenantId: string; generation: number; body: UpdateOrganizationRequest }
let generation = 0
onBeforeUnmount(() => {
  generation += 1
  clearFeedback()
})
const isSubmitting = ref(false)
const confirmOpen = ref(false)
const pendingCommand = ref<Command | null>(null)
const saved = ref(false)
const feedback = ref<'saved' | 'error' | null>(null)
let feedbackTimer: ReturnType<typeof setTimeout> | undefined
function clearFeedback(): void {
  clearTimeout(feedbackTimer)
  feedback.value = null
}
function showFeedback(value: 'saved' | 'error'): void {
  clearFeedback()
  feedback.value = value
  feedbackTimer = setTimeout(() => {
    feedback.value = null
  }, 2000)
}
const requestError = ref<unknown>(null)
const sameContext = (command: Command) =>
  command.tenantId === props.tenantId && command.generation === generation

function resetOrganization(organization: Organization) {
  resetForm({
    values: {
      name: organization.name,
      defaultTimezone: organization.defaultTimezone,
      defaultCurrency: organization.defaultCurrency,
    },
  })
}

const mutation = useMutation({
  mutationFn: ({ tenantId, body }: Command) => updateOrganization(tenantId, body),
  onSuccess: async (organization, command) => {
    const { tenantId, body } = command
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(tenantId) }),
      ...(body.defaultTimezone || body.defaultCurrency
        ? [queryClient.invalidateQueries({ queryKey: [...tenantScope(tenantId), 'analytics'] })]
        : []),
    ])
    if (!sameContext(command)) return
    if (body.name) await session.refresh().catch(() => undefined)
    if (!sameContext(command)) return
    resetOrganization(organization)
    emit('saved', organization)
  },
})

// В новом пространстве даже dirty-форма следует новым props. Поколение также
// защищает от старого ответа после A → B → A.
watch(
  () => [props.tenantId, props.organization] as const,
  ([tenantId, organization], [previousTenant]) => {
    if (tenantId !== previousTenant) {
      generation += 1
      isSubmitting.value = false
      confirmOpen.value = false
      pendingCommand.value = null
      requestError.value = null
      saved.value = false
      clearFeedback()
      mutation.reset()
      resetOrganization(organization)
    } else if (!meta.value.dirty) {
      resetOrganization(organization)
    }
  },
)

const errorView = computed(() => (requestError.value ? describeError(requestError.value) : null))
const traceId = computed(() => (isApiError(requestError.value) ? requestError.value.traceId : ''))
/** «Оставить прежние»: пояс и валюта возвращаются к сохранённым значениям, название остаётся как набрано. */
function keepPrevious(): void {
  setFieldValue('defaultTimezone', props.organization.defaultTimezone)
  setFieldValue('defaultCurrency', props.organization.defaultCurrency)
  pendingCommand.value = null
  requestError.value = null
  confirmOpen.value = false
}

/** Тело PATCH из изменённых полей; пустое — сохранять нечего. */
function diff(formValues: { name: string; defaultTimezone: string; defaultCurrency: string }) {
  const body: UpdateOrganizationRequest = {}
  if (formValues.name !== props.organization.name) body.name = formValues.name
  if (formValues.defaultTimezone !== props.organization.defaultTimezone) {
    body.defaultTimezone = formValues.defaultTimezone
  }
  const currency = formValues.defaultCurrency.toUpperCase()
  if (currency !== props.organization.defaultCurrency) body.defaultCurrency = currency
  return body
}

async function onSubmit(event: Event): Promise<void> {
  if (isSubmitting.value || confirmOpen.value) return
  isSubmitting.value = true
  const context = { tenantId: props.tenantId, generation }
  try {
    await handleSubmit(async (formValues) => {
      const command: Command = { ...context, body: diff(formValues) }
      if (!sameContext(command)) return
      saved.value = false
      requestError.value = null
      if (Object.keys(command.body).length === 0) return
      if (command.body.defaultTimezone || command.body.defaultCurrency) {
        pendingCommand.value = command
        confirmOpen.value = true
        return
      }
      await send(command)
    })(event)
  } finally {
    if (context.generation === generation) isSubmitting.value = false
  }
}

async function confirmChanges(): Promise<void> {
  const command = pendingCommand.value
  if (isSubmitting.value || !command || !sameContext(command)) return
  isSubmitting.value = true
  try {
    await send(command)
  } finally {
    if (sameContext(command)) isSubmitting.value = false
  }
}

async function send(command: Command): Promise<void> {
  requestError.value = null
  clearFeedback()
  try {
    await mutation.mutateAsync(command)
    if (!sameContext(command)) return
    saved.value = true
    showFeedback('saved')
    confirmOpen.value = false
    pendingCommand.value = null
  } catch (error) {
    if (sameContext(command)) {
      requestError.value = error
      showFeedback('error')
    }
  }
}

const hasChanges = computed(() => {
  if (!meta.value.dirty) return false
  const current = values
  return (
    current.name?.trim() !== props.organization.name ||
    current.defaultTimezone !== props.organization.defaultTimezone ||
    (current.defaultCurrency ?? '').toUpperCase() !== props.organization.defaultCurrency
  )
})
const status = computed(() =>
  isSubmitting.value ? 'saving' : (feedback.value ?? (hasChanges.value ? 'dirty' : 'idle')),
)
watch(status, (value) => emit('status', value), { immediate: true })
watch(
  () => JSON.stringify(values),
  () => {
    if (meta.value.dirty && feedback.value === 'saved') clearFeedback()
  },
)
</script>

<template>
  <form class="lr-of flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
    <div
      class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1.875fr_minmax(0,1fr)_minmax(192px,1fr)] [&>div]:min-w-0"
    >
      <UiField
        v-slot="{ id, describedBy, invalid }"
        class="md:col-span-2 lg:col-span-1"
        label="Название компании"
        label-style="compact"
        :error="errors.name"
      >
        <UiInput
          :id="id"
          v-model="name"
          name="organizationName"
          :maxlength="200"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="isSubmitting"
        />
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Основная валюта"
        label-style="compact"
        :error="errors.defaultCurrency"
      >
        <UiSelect
          :id="id"
          v-model="defaultCurrency"
          name="organizationCurrency"
          class="min-w-0"
          :options="currencies"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="isSubmitting"
        />
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Часовой пояс"
        label-style="compact"
        :error="errors.defaultTimezone"
      >
        <UiSelect
          :id="id"
          v-model="defaultTimezone"
          name="organizationTimezone"
          class="min-w-0"
          :options="zones"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="isSubmitting"
        />
      </UiField>
    </div>
    <UiAlert
      v-if="errorView"
      tone="danger"
      title="Не удалось сохранить компанию"
      :trace-id="traceId"
    >
      Введённые данные остались в форме. Повторите сохранение.
      <template #icon><UiGlyph name="circle-alert" class="size-5" /></template>
    </UiAlert>
    <div class="flex flex-col gap-4 md:flex-row md:items-center">
      <p class="min-w-0 flex-1 text-xs leading-[18px] text-muted max-md:leading-4">
        Валюта не пересчитывает прежние суммы. Часовой<br class="hidden md:block lg:hidden" />
        пояс используется в отчётах и уведомлениях.
      </p>
      <UiButton
        type="submit"
        class="w-full md:w-[220px] md:shrink-0"
        :class="!isSubmitting ? 'disabled:bg-line disabled:text-muted disabled:opacity-100' : ''"
        :disabled="!hasChanges || confirmOpen"
        :loading="isSubmitting"
      >
        {{
          isSubmitting ? 'Сохраняем…' : errorView ? 'Повторить сохранение' : 'Сохранить компанию'
        }}
      </UiButton>
    </div>

    <p v-if="saved" class="sr-only" role="status">Настройки компании сохранены.</p>

    <UiSheetDialog
      v-model:open="confirmOpen"
      title="Изменить валюту и часовой пояс?"
      description="Эти параметры общие для всей компании."
      description-in-body
      settings-form
      description-strong
      size="sm"
      footer-fill
      :dismissible="!isSubmitting"
    >
      <p
        class="text-base leading-6 font-semibold text-ink lg:text-sm lg:leading-5 lg:font-normal lg:text-ink"
      >
        Новая валюта не пересчитывает прежние суммы. Часовой пояс компании влияет на отчёты, сводки
        и тихие часы; часовые пояса точек задаются отдельно.
      </p>
      <UiAlert
        v-if="errorView"
        tone="danger"
        class="mt-4"
        :title="errorView.title"
        :trace-id="traceId"
      >
        {{ errorView.description }}
      </UiAlert>
      <template #footer>
        <UiButton variant="secondary" :disabled="isSubmitting" @click="keepPrevious">
          Оставить прежние
        </UiButton>
        <UiButton :loading="isSubmitting" @click="confirmChanges"> Сохранить изменения </UiButton>
      </template>
    </UiSheetDialog>
  </form>
</template>

<style>
.lr-of :is(input, select):disabled {
  opacity: 0.5;
}
</style>
