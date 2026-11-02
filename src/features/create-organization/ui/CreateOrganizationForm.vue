<script setup lang="ts">
/**
 * Данные компании на первом шаге мастера: создание или изменение уже выбранной организации.
 * После `201` обязательно перечитывается `/auth/me`, и новая организация
 * выбирается явно: членство не собирается на клиенте из ответа создания.
 */
import { computed, nextTick, onBeforeUnmount, reactive, ref, useTemplateRef, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiField, UiInput, UiSelect } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import {
  CURRENCY_OPTIONS,
  createOrganization,
  defaultTimeZone,
  organizationKeys,
  organizationChanges,
  organizationValues,
  timeZoneOptions,
  updateOrganization,
  type Organization,
} from '@/entities/organization'
import { createOrganizationSchema, type CreateOrganizationValues } from '../model/schema'

const props = defineProps<{
  /** Первичная загрузка: каркас формы без динамики (Figma «Первичная загрузка»). */
  loading?: boolean | undefined
  organization?: Organization | undefined
  draft?: CreateOrganizationValues | undefined
  acknowledge?: ((organization: Organization) => Promise<unknown>) | undefined
}>()
const emit = defineEmits<{
  created: [organization: Organization]
  saved: [organization: Organization]
  draft: [values: CreateOrganizationValues]
}>()

const session = useSessionStore()
const queryClient = useQueryClient()
const zones = timeZoneOptions()
const formEl = useTemplateRef<HTMLFormElement>('formEl')

const { defineField, handleSubmit, errors, isSubmitting, resetForm, meta, values } = useForm({
  validationSchema: toTypedSchema(createOrganizationSchema),
  initialValues:
    props.draft ??
    organizationValues(
      props.organization ?? {
        name: '',
        defaultTimezone: defaultTimeZone(),
        defaultCurrency: 'RUB',
      },
    ),
})
const [name] = defineField('name')
const [defaultTimezone] = defineField('defaultTimezone')
const [defaultCurrency] = defineField('defaultCurrency')
const fields = reactive([
  {
    key: 'name' as const,
    label: 'Название компании',
    value: name,
    description: '',
    attrs: { name: 'organization', autocomplete: 'organization' },
  },
  {
    key: 'defaultTimezone' as const,
    label: 'Часовой пояс',
    value: defaultTimezone,
    description: 'Время в отчётах и событиях.',
    attrs: { options: zones },
  },
  {
    key: 'defaultCurrency' as const,
    label: 'Основная валюта',
    value: defaultCurrency,
    description: 'Для расчёта потенциала сделок и выручки.',
    attrs: { options: CURRENCY_OPTIONS },
  },
])

const submitError = ref<unknown>(null)
const errorView = computed(() =>
  submitError.value === null ? null : describeError(submitError.value),
)
const traceId = computed(() => (isApiError(submitError.value) ? submitError.value.traceId : ''))

/** Замок отправки: двойной щелчок создаёт одну организацию. */
let inFlight = false
/** Созданная организация: если после `201` перечитать сессию не удалось, повтор не создаёт вторую. */
let created: Organization | null = null
let active = true
onBeforeUnmount(() => {
  active = false
})
watch(
  () => props.organization,
  (organization) => {
    if (organization && !meta.value.dirty) {
      resetForm({ values: props.draft ?? organizationValues(organization) })
    }
  },
)
watch(
  values,
  () => {
    if (!props.loading) emit('draft', { ...values } as CreateOrganizationValues)
  },
  { deep: true, flush: 'sync' },
)
const onSubmit = handleSubmit(async (values) => {
  submitError.value = null
  const userId = session.user?.id
  const tenantId = session.tenantId
  const organization = props.organization
  const current = () =>
    active &&
    session.user?.id === userId &&
    (organization
      ? session.tenantId === organization.id && props.organization?.id === organization.id
      : session.tenantId === tenantId || session.tenantId === created?.id)
  try {
    if (organization) {
      const body = organizationChanges(organization, values)
      const saved = Object.keys(body).length
        ? await updateOrganization(organization.id, body)
        : organization
      if (Object.keys(body).length) {
        await queryClient.invalidateQueries({ queryKey: organizationKeys.detail(organization.id) })
      }
      if (!current()) return
      queryClient.setQueryData(organizationKeys.detail(organization.id), saved)
      if (body.name) await session.refresh().catch(() => undefined)
      if (!current()) return
      resetForm({ values: organizationValues(saved) })
      emit('saved', saved)
      return
    }
    created ??= await createOrganization({
      name: values.name,
      defaultTimezone: values.defaultTimezone,
      defaultCurrency: values.defaultCurrency.toUpperCase(),
    })
    if (!current()) return
    await props.acknowledge?.(created)
    await session.refresh()
    if (!current()) return
    if (!session.selectTenant(created.id)) throw new Error('Компания недоступна')
    const changes = organizationChanges(created, values)
    if (Object.keys(changes).length) created = await updateOrganization(created.id, changes)
    if (!current()) return
    queryClient.setQueryData(organizationKeys.detail(created.id), created)
    emit('created', created)
  } catch (error) {
    if (current()) submitError.value = error
  }
})

/** Поля были заблокированы на время отправки: после неудачи фокус возвращается к первому полю с ошибкой. */
async function submit(event?: Event): Promise<void> {
  // Повторная отправка при уже идущей не должна даже входить в проверку формы: она сбросила бы признак занятости.
  if (inFlight) return
  inFlight = true
  try {
    await onSubmit(event)
  } finally {
    inFlight = false
  }
  if (submitError.value === null && Object.keys(errors.value).length === 0) return
  if (!active) return
  await nextTick()
  const target =
    formEl.value?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
    formEl.value?.querySelector<HTMLElement>('input:not([disabled])')
  target?.focus()
}
</script>

<template>
  <div v-if="loading" class="flex flex-col gap-4 md:gap-6" role="status" aria-label="Загрузка">
    <div class="flex flex-col rounded-card border border-line bg-paper px-5 md:px-[23px]">
      <div
        v-for="row in 3"
        :key="row"
        :class="row < 3 ? 'border-b border-hairline' : ''"
        class="flex flex-col gap-2 py-3 md:grid md:grid-cols-[200px_minmax(0,1fr)] md:gap-0 md:py-[17px]"
      >
        <div class="flex h-5 items-center md:h-[46px]">
          <div class="h-3 w-[210px] rounded-full md:w-[120px] bg-line" />
        </div>
        <div class="flex flex-col gap-2.5">
          <div class="h-[46px] rounded-field bg-line" />
          <div v-if="row > 1" class="flex flex-col gap-1">
            <div
              :class="[
                'h-3 max-w-full rounded-full bg-line md:my-1',
                row === 2 ? 'w-[322px] md:w-[348px]' : 'w-40 md:w-[348px]',
              ]"
            />
            <div v-if="row === 2" class="h-3 w-[216px] rounded-full bg-line md:hidden" />
          </div>
        </div>
      </div>
    </div>
    <slot :submitting="false" />
  </div>
  <form
    v-else
    ref="formEl"
    class="flex flex-col gap-4 md:gap-6"
    novalidate
    @submit.prevent="submit"
  >
    <div class="flex flex-col rounded-card border border-line bg-paper px-5 md:px-[23px]">
      <UiField
        v-for="field in fields"
        :key="field.key"
        v-slot="{ id, describedBy, invalid }"
        class="py-3 md:py-[17px]"
        :class="field.key !== 'defaultCurrency' ? 'border-b border-hairline' : ''"
        row
        :label="field.label"
        :description="field.description"
        :error="errors[field.key]"
      >
        <component
          :is="field.key === 'name' ? UiInput : UiSelect"
          :id="id"
          v-model="field.value"
          v-bind="field.attrs"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="isSubmitting"
        />
      </UiField>
    </div>
    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>
    <slot :submitting="isSubmitting" />
  </form>
</template>
