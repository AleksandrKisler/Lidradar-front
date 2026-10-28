<script setup lang="ts">
/**
 * Создание организации — первого рабочего пространства пользователя (Figma «Компания · Шаг 1»).
 * После `201` обязательно перечитывается `/auth/me`, и новая организация
 * выбирается явно: членство не собирается на клиенте из ответа создания.
 */
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiField, UiInput, UiSelect } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import {
  CURRENCY_OPTIONS,
  createOrganization,
  defaultTimeZone,
  timeZoneOptions,
  type Organization,
} from '@/entities/organization'
import { createOrganizationSchema } from '../model/schema'

defineProps<{
  /** Первичная загрузка: каркас формы без динамики (Figma «Первичная загрузка»). */
  loading?: boolean | undefined
}>()
const emit = defineEmits<{ created: [organization: Organization] }>()

const session = useSessionStore()
const zones = timeZoneOptions()
const formEl = useTemplateRef<HTMLFormElement>('formEl')

const { defineField, handleSubmit, errors, isSubmitting } = useForm({
  validationSchema: toTypedSchema(createOrganizationSchema),
  initialValues: { name: '', defaultTimezone: defaultTimeZone(), defaultCurrency: 'RUB' },
})
const [name] = defineField('name')
const [defaultTimezone] = defineField('defaultTimezone')
const [defaultCurrency] = defineField('defaultCurrency')

const submitError = ref<unknown>(null)
const errorView = computed(() =>
  submitError.value === null ? null : describeError(submitError.value),
)
const traceId = computed(() => (isApiError(submitError.value) ? submitError.value.traceId : ''))

/** Замок отправки: двойной щелчок создаёт одну организацию. */
let inFlight = false
/** Созданная организация: если после `201` перечитать сессию не удалось, повтор не создаёт вторую. */
let created: Organization | null = null
const onSubmit = handleSubmit(async (values) => {
  submitError.value = null
  try {
    created ??= await createOrganization({
      name: values.name,
      defaultTimezone: values.defaultTimezone,
      defaultCurrency: values.defaultCurrency.toUpperCase(),
    })
    await session.refresh()
    session.selectTenant(created.id)
    emit('created', created)
  } catch (error) {
    submitError.value = error
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
        v-slot="{ id, describedBy, invalid }"
        class="border-b border-hairline py-3 md:py-[17px]"
        row
        label="Название компании"
        :error="errors.name"
      >
        <UiInput
          :id="id"
          v-model="name"
          name="organization"
          autocomplete="organization"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="isSubmitting"
        />
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        class="border-b border-hairline py-3 md:py-[17px]"
        row
        label="Часовой пояс"
        description="Время в отчётах и событиях."
        :error="errors.defaultTimezone"
      >
        <UiSelect
          :id="id"
          v-model="defaultTimezone"
          :options="zones"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="isSubmitting"
        />
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        class="py-3 md:py-[17px]"
        row
        label="Основная валюта"
        description="Для расчёта потенциала сделок и выручки."
        :error="errors.defaultCurrency"
      >
        <UiSelect
          :id="id"
          v-model="defaultCurrency"
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
    <slot :submitting="isSubmitting" />
  </form>
</template>
