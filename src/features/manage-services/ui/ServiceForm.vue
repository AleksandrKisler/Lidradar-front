<script setup lang="ts">
/** One field/validation pipeline for onboarding and the settings dialog. */
import { computed, nextTick, onBeforeUnmount, reactive, ref, useTemplateRef, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError, isUnknownResult } from '@/shared/api'
import { formatAmount, parseAmount } from '@/shared/lib'
import {
  UiAlert,
  UiButton,
  UiField,
  UiGlyph,
  UiInput,
  UiSelect,
  type UiSelectOption,
} from '@/shared/ui'
import { UNKNOWN_PRICE, SERVICE_NAME_MAX_LENGTH, type ServiceCatalogItem } from '@/entities/service'
import { CURRENCY_OPTIONS } from '@/entities/organization'
import type { Location } from '@/entities/location'
import { serviceSchema } from '../model/schema'
import { useServiceCommands } from '../model/use-services-commands'
import serviceChevron from './assets/service-chevron.svg?no-inline'

const props = defineProps<{
  tenantId: string
  service: ServiceCatalogItem | null
  locations: Location[]
  defaultCurrency: string
  submitLabel?: string | undefined
  wizard?: boolean | undefined
  dialog?: boolean | undefined
  formId?: string | undefined
  operationKey?: number | undefined
}>()
const emit = defineEmits<{
  saved: [service: ServiceCatalogItem, operationKey?: number]
  cancel: []
  busy: [busy: boolean, operationKey?: number]
  failed: [error: unknown, operationKey?: number]
}>()
const commands = useServiceCommands(() => props.tenantId)
const locationOptions = computed<UiSelectOption[]>(() => [
  { value: '', label: 'Все точки' },
  ...props.locations.map((location) => ({
    value: location.id,
    label: location.active ? location.name : `${location.name} (неактивна)`,
  })),
])
const currencyOptions = computed(() =>
  props.dialog
    ? CURRENCY_OPTIONS.map(({ value, label }) => ({
        value,
        label: `${value} · ${label.split(' · ')[1]}`,
      }))
    : CURRENCY_OPTIONS,
)
const { defineField, handleSubmit, errors, resetForm } = useForm({
  validationSchema: toTypedSchema(serviceSchema),
  initialValues: {
    name: props.service?.name ?? '',
    locationId: props.service?.locationId ?? '',
    priceFrom:
      (props.dialog ? formatAmount(props.service?.priceFrom) : props.service?.priceFrom) ?? '',
    priceTo: (props.dialog ? formatAmount(props.service?.priceTo) : props.service?.priceTo) ?? '',
    currency: props.service?.currency ?? props.defaultCurrency,
  },
})
const fields = reactive([
  {
    key: 'name' as const,
    label: 'Название услуги',
    name: 'serviceName',
    value: defineField('name')[0],
  },
  {
    key: 'locationId' as const,
    label: 'Точка',
    name: 'serviceLocation',
    value: defineField('locationId')[0],
  },
  {
    key: 'priceFrom' as const,
    label: 'Цена от',
    name: 'priceFrom',
    value: defineField('priceFrom')[0],
  },
  { key: 'priceTo' as const, label: 'Цена до', name: 'priceTo', value: defineField('priceTo')[0] },
  {
    key: 'currency' as const,
    label: 'Валюта',
    name: 'serviceCurrency',
    value: defineField('currency')[0],
  },
])
const errorView = computed(() =>
  commands.error.value ? describeError(commands.error.value) : null,
)
const traceId = computed(() =>
  isApiError(commands.error.value) ? commands.error.value.traceId : '',
)
const uncertainCreate = computed(
  () =>
    props.dialog &&
    !props.service &&
    Boolean(commands.error.value) &&
    isUnknownResult(commands.error.value),
)
const isSubmitting = ref(false)
watch(isSubmitting, (busy) => emit('busy', busy, props.operationKey), { flush: 'sync' })
const formEl = useTemplateRef<HTMLFormElement>('formEl')
let mounted = true
onBeforeUnmount(() => {
  mounted = false
})
let command = {
  tenantId: '',
  serviceId: undefined as string | undefined,
  operationKey: undefined as number | undefined,
}
const submit = handleSubmit(async (values) => {
  const context = command
  const body = {
    name: values.name,
    locationId: values.locationId || null,
    priceFrom: parseAmount(values.priceFrom),
    priceTo: parseAmount(values.priceTo),
    currency: values.currency.toUpperCase(),
  }
  const current = () =>
    mounted && props.tenantId === context.tenantId && props.service?.id === context.serviceId
  const result = await commands
    .mutateAsync(
      context.serviceId
        ? { tenantId: context.tenantId, kind: 'update', serviceId: context.serviceId, body }
        : { tenantId: context.tenantId, kind: 'create', body },
    )
    .catch((error: unknown) => {
      if (current()) emit('failed', error, context.operationKey)
      return null
    })
  if (!result || !current()) return
  if (!context.serviceId && !props.dialog) {
    resetForm({
      values: { name: '', locationId: '', priceFrom: '', priceTo: '', currency: body.currency },
    })
  }
  if (props.dialog) emit('saved', result, context.operationKey)
  else emit('saved', result)
})
async function onSubmit(event: Event) {
  if (isSubmitting.value || uncertainCreate.value) return
  command = {
    tenantId: props.tenantId,
    serviceId: props.service?.id,
    operationKey: props.operationKey,
  }
  isSubmitting.value = true
  try {
    await submit(event)
  } finally {
    isSubmitting.value = false
  }
  if (props.wizard && mounted) await restoreFocus()
}
async function restoreFocus() {
  await nextTick()
  const target =
    formEl.value?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
    formEl.value?.querySelector<HTMLElement>('input[name="serviceName"]')
  target?.focus()
}
async function onCancel() {
  if (!props.wizard) return emit('cancel')
  resetForm({
    values: {
      name: '',
      locationId: '',
      priceFrom: '',
      priceTo: '',
      currency: props.defaultCurrency,
    },
  })
  await restoreFocus()
}
</script>

<template>
  <form
    :id="formId"
    ref="formEl"
    class="flex flex-col"
    :class="dialog ? 'gap-4 md:gap-6' : wizard ? 'gap-4' : 'gap-5'"
    novalidate
    @submit.prevent="onSubmit"
  >
    <div
      class="grid"
      :class="
        dialog
          ? 'grid-cols-2 gap-4'
          : wizard
            ? 'gap-4 md:grid-cols-[172px_172px_44px_minmax(0,1fr)]'
            : 'gap-5 sm:grid-cols-3'
      "
    >
      <UiField
        v-for="field in fields"
        :key="field.key"
        v-slot="{ id, describedBy, invalid }"
        class="min-w-0"
        :class="
          dialog
            ? field.key.startsWith('price')
              ? ''
              : 'col-span-2'
            : wizard
              ? field.key === 'name'
                ? 'md:col-span-3'
                : field.key === 'currency'
                  ? 'md:col-span-2'
                  : ''
              : field.key === 'name' || field.key === 'locationId'
                ? 'sm:col-span-3'
                : ''
        "
        :label="field.label"
        :label-style="dialog ? 'compact' : 'default'"
        :description="
          !wizard && !dialog
            ? field.key === 'name'
              ? `До ${SERVICE_NAME_MAX_LENGTH} символов.`
              : field.key === 'priceFrom'
                ? 'Пусто — цена неизвестна.'
                : ''
            : ''
        "
        :error="wizard && field.key.startsWith('price') ? '' : errors[field.key]"
      >
        <UiSelect
          v-if="field.key === 'locationId' || field.key === 'currency'"
          :id="id"
          v-model="field.value"
          :name="field.name"
          :options="field.key === 'locationId' ? locationOptions : currencyOptions"
          :style="dialog ? { backgroundImage: `url(${serviceChevron})` } : undefined"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="isSubmitting"
          :class="dialog ? 'disabled:bg-canvas! disabled:opacity-50!' : ''"
        />
        <UiInput
          v-else
          :id="id"
          v-model="field.value"
          :name="field.name"
          :inputmode="field.key === 'name' ? undefined : 'decimal'"
          :placeholder="
            field.key === 'name'
              ? dialog
                ? 'Например, Полировка кузова'
                : 'Полировка кузова'
              : wizard || dialog
                ? UNKNOWN_PRICE
                : '0,00'
          "
          :described-by="
            wizard && field.key.startsWith('price') ? 'service-price-note' : describedBy
          "
          :invalid="
            invalid ||
            (wizard && field.key.startsWith('price') && Boolean(errors.priceFrom || errors.priceTo))
          "
          :disabled="isSubmitting"
          :class="dialog ? 'disabled:bg-canvas! disabled:opacity-50!' : ''"
          :style="dialog ? { '--color-secondary': 'var(--color-muted)' } : undefined"
        />
      </UiField>
      <p v-if="dialog" class="col-span-2 text-xs leading-[18px] text-muted">
        Цена «от» не может быть выше цены «до». Неуказанная цена не считается нулевой.
      </p>
    </div>
    <p
      v-if="wizard"
      id="service-price-note"
      :class="[
        '-mt-1.5 text-meta leading-[18px]',
        errors.priceFrom || errors.priceTo ? 'text-danger' : 'text-secondary',
      ]"
      aria-live="polite"
    >
      {{ errors.priceFrom || errors.priceTo || 'Пустое поле — цена неизвестна.' }}
    </p>
    <UiAlert
      v-if="errorView"
      tone="danger"
      :title="dialog ? 'Не удалось сохранить услугу' : errorView.title"
      :trace-id="traceId"
      :text-class="dialog ? 'text-sm leading-5' : undefined"
    >
      {{
        uncertainCreate
          ? 'Результат сохранения неизвестен. Проверьте каталог перед новой попыткой.'
          : dialog
            ? 'Введённые данные остались в форме. Повторите сохранение.'
            : errorView.description
      }}
      <template v-if="dialog" #icon><UiGlyph name="circle-alert" class="size-5" /></template>
    </UiAlert>
    <div
      v-if="!dialog"
      :class="wizard ? 'flex items-center justify-end gap-4' : 'flex flex-wrap justify-end gap-3'"
    >
      <UiButton :variant="wizard ? 'plain' : 'secondary'" :disabled="isSubmitting" @click="onCancel"
        >Отмена</UiButton
      >
      <UiButton
        type="submit"
        :variant="wizard ? 'outline' : 'primary'"
        :class="wizard ? 'min-w-48' : ''"
        :loading="isSubmitting"
      >
        <template v-if="wizard && isSubmitting"
          ><span aria-hidden="true">Добавляем…</span
          ><span class="sr-only">{{ submitLabel ?? 'Добавить услугу' }}</span></template
        >
        <template v-else>{{ submitLabel ?? (service ? 'Сохранить' : 'Добавить услугу') }}</template>
      </UiButton>
    </div>
  </form>
</template>
