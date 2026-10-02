<script setup lang="ts">
/**
 * Форма услуги: название, точка (или вся организация), диапазон цен и
 * валюта. Пустая цена уходит как `null`; при изменении отправляются все
 * редактируемые поля, чтобы PATCH был однозначен.
 */
import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { parseAmount } from '@/shared/lib'
import { UiAlert, UiButton, UiField, UiInput, UiSelect, type UiSelectOption } from '@/shared/ui'
import { CURRENCY_OPTIONS } from '@/entities/organization'
import type { Location } from '@/entities/location'
import { SERVICE_NAME_MAX_LENGTH, type ServiceCatalogItem } from '@/entities/service'
import { serviceSchema } from '../model/schema'
import { useServiceCommands } from '../model/use-services-commands'

const props = defineProps<{
  tenantId: string
  service: ServiceCatalogItem | null
  locations: Location[]
  defaultCurrency: string
  submitLabel?: string | undefined
}>()
const emit = defineEmits<{ saved: [service: ServiceCatalogItem]; cancel: [] }>()

const commands = useServiceCommands(() => props.tenantId)

const locationOptions = computed<UiSelectOption[]>(() => [
  { value: '', label: 'Все точки' },
  ...props.locations.map((location) => ({
    value: location.id,
    label: location.active ? location.name : `${location.name} (неактивна)`,
  })),
])

const { defineField, handleSubmit, errors, resetForm } = useForm({
  validationSchema: toTypedSchema(serviceSchema),
  initialValues: {
    name: props.service?.name ?? '',
    locationId: props.service?.locationId ?? '',
    priceFrom: props.service?.priceFrom ?? '',
    priceTo: props.service?.priceTo ?? '',
    currency: props.service?.currency ?? props.defaultCurrency,
  },
})
const [name] = defineField('name')
const [locationId] = defineField('locationId')
const [priceFrom] = defineField('priceFrom')
const [priceTo] = defineField('priceTo')
const [currency] = defineField('currency')

const errorView = computed(() =>
  commands.error.value ? describeError(commands.error.value) : null,
)
const traceId = computed(() =>
  isApiError(commands.error.value) ? commands.error.value.traceId : '',
)

const isSubmitting = ref(false)
const submit = handleSubmit(async (values) => {
  const body = {
    name: values.name,
    locationId: values.locationId || null,
    priceFrom: parseAmount(values.priceFrom),
    priceTo: parseAmount(values.priceTo),
    currency: values.currency.toUpperCase(),
  }
  const result = await commands
    .mutateAsync(
      props.service
        ? { kind: 'update', serviceId: props.service.id, body }
        : { kind: 'create', body },
    )
    .catch(() => null)
  if (result) {
    if (!props.service) {
      resetForm({
        values: { name: '', locationId: '', priceFrom: '', priceTo: '', currency: body.currency },
      })
    }
    emit('saved', result)
  }
})

async function onSubmit(event: Event) {
  // Блокируем повтор до асинхронной валидации, пока mutation ещё не pending.
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
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Название услуги"
      :description="`До ${SERVICE_NAME_MAX_LENGTH} символов.`"
      :error="errors.name"
    >
      <UiInput
        :id="id"
        v-model="name"
        name="serviceName"
        placeholder="Полировка кузова"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="isSubmitting"
      />
    </UiField>
    <UiField v-slot="{ id, describedBy, invalid }" label="Точка" :error="errors.locationId">
      <UiSelect
        :id="id"
        v-model="locationId"
        name="serviceLocation"
        :options="locationOptions"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="isSubmitting"
      />
    </UiField>
    <div class="grid gap-5 sm:grid-cols-3">
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Цена от"
        description="Пусто — цена неизвестна."
        :error="errors.priceFrom"
      >
        <UiInput
          :id="id"
          v-model="priceFrom"
          name="priceFrom"
          inputmode="decimal"
          placeholder="0,00"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="isSubmitting"
        />
      </UiField>
      <UiField v-slot="{ id, describedBy, invalid }" label="Цена до" :error="errors.priceTo">
        <UiInput
          :id="id"
          v-model="priceTo"
          name="priceTo"
          inputmode="decimal"
          placeholder="0,00"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="isSubmitting"
        />
      </UiField>
      <UiField v-slot="{ id, describedBy, invalid }" label="Валюта" :error="errors.currency">
        <UiSelect
          :id="id"
          v-model="currency"
          name="serviceCurrency"
          :options="CURRENCY_OPTIONS"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="isSubmitting"
        />
      </UiField>
    </div>

    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>

    <div class="flex flex-wrap justify-end gap-3">
      <UiButton variant="secondary" :disabled="isSubmitting" @click="emit('cancel')">
        Отмена
      </UiButton>
      <UiButton type="submit" :loading="isSubmitting">
        {{ submitLabel ?? (service ? 'Сохранить' : 'Добавить услугу') }}
      </UiButton>
    </div>
  </form>
</template>
