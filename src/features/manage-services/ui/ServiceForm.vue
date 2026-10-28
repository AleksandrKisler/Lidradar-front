<script setup lang="ts">
/**
 * Форма услуги: название, точка (или вся организация), диапазон цен и
 * валюта. Пустая цена уходит как `null`; при изменении отправляются все
 * редактируемые поля, чтобы PATCH был однозначен.
 */
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { parseAmount } from '@/shared/lib'
import { UiAlert, UiButton, UiField, UiInput, UiSelect, type UiSelectOption } from '@/shared/ui'
import { UNKNOWN_PRICE } from '@/entities/service'
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
  /** Раскладка шага мастера (Figma «Услуги и цены»): сетка полей, подсказка про цены, «Отмена» и «Добавить услугу». */
  wizard?: boolean | undefined
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
const formEl = useTemplateRef<HTMLFormElement>('formEl')
const blank = () => ({
  name: '',
  locationId: '',
  priceFrom: '',
  priceTo: '',
  currency: props.defaultCurrency,
})
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
  if (props.wizard) await restoreFocus()
}

/**
 * Поля были заблокированы на время отправки и потеряли фокус: после успеха он возвращается к названию
 * (следующая услуга), после ошибки — к первому полю с ошибкой, а при сбое сервера — к названию.
 */
async function restoreFocus(): Promise<void> {
  await nextTick()
  const target =
    formEl.value?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
    formEl.value?.querySelector<HTMLElement>('input[name="serviceName"]')
  target?.focus()
}

/** «Отмена» в мастере очищает введённое и возвращает фокус к названию; шаг остаётся на месте. */
async function onCancel(): Promise<void> {
  if (!props.wizard) return emit('cancel')
  resetForm({ values: blank() })
  await restoreFocus()
}
</script>

<template>
  <form
    v-if="wizard"
    ref="formEl"
    class="flex flex-col gap-4"
    novalidate
    @submit.prevent="onSubmit"
  >
    <div class="grid gap-4 md:grid-cols-[420px_minmax(0,1fr)]">
      <UiField v-slot="{ id, describedBy, invalid }" label="Название услуги" :error="errors.name">
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
    </div>
    <div class="grid gap-4 md:grid-cols-[172px_172px_minmax(0,1fr)]">
      <UiField v-slot="{ id, invalid }" label="Цена от">
        <UiInput
          :id="id"
          v-model="priceFrom"
          name="priceFrom"
          inputmode="decimal"
          :placeholder="UNKNOWN_PRICE"
          described-by="service-price-note"
          :invalid="invalid || Boolean(errors.priceFrom || errors.priceTo)"
          :disabled="isSubmitting"
        />
      </UiField>
      <UiField v-slot="{ id, invalid }" label="Цена до">
        <UiInput
          :id="id"
          v-model="priceTo"
          name="priceTo"
          inputmode="decimal"
          :placeholder="UNKNOWN_PRICE"
          described-by="service-price-note"
          :invalid="invalid || Boolean(errors.priceFrom || errors.priceTo)"
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
    <!-- Подсказка и ошибка цен — одна строка под рядом (макет «Ошибка»): ошибка заменяет подсказку. -->
    <p
      id="service-price-note"
      :class="[
        '-mt-1.5 text-meta leading-[18px]',
        errors.priceFrom || errors.priceTo ? 'text-danger' : 'text-secondary',
      ]"
      aria-live="polite"
    >
      {{ errors.priceFrom || errors.priceTo || 'Пустое поле — цена неизвестна.' }}
    </p>

    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>

    <div class="flex items-center justify-end gap-4">
      <UiButton variant="plain" :disabled="isSubmitting" @click="onCancel">Отмена</UiButton>
      <UiButton type="submit" variant="outline" class="min-w-48" :loading="isSubmitting">
        <template v-if="isSubmitting">
          <span aria-hidden="true">Добавляем…</span
          ><span class="sr-only">{{ submitLabel ?? 'Добавить услугу' }}</span>
        </template>
        <template v-else>{{ submitLabel ?? (service ? 'Сохранить' : 'Добавить услугу') }}</template>
      </UiButton>
    </div>
  </form>
  <form v-else class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
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
