<script setup lang="ts">
/**
 * Создание организации — первого рабочего пространства пользователя.
 * После `201` обязательно перечитывается `/auth/me`, и новая организация
 * выбирается явно: членство не собирается на клиенте из ответа создания.
 */
import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiField, UiInput, UiSelect } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import {
  CURRENCY_OPTIONS,
  createOrganization,
  defaultTimeZone,
  timeZoneOptions,
  type Organization,
} from '@/entities/organization'
import { createOrganizationSchema } from '../model/schema'

const emit = defineEmits<{ created: [organization: Organization] }>()

const session = useSessionStore()
const zones = timeZoneOptions()

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

const onSubmit = handleSubmit(async (values) => {
  submitError.value = null
  try {
    const organization = await createOrganization({
      name: values.name,
      defaultTimezone: values.defaultTimezone,
      defaultCurrency: values.defaultCurrency.toUpperCase(),
    })
    await session.refresh()
    session.selectTenant(organization.id)
    emit('created', organization)
  } catch (error) {
    submitError.value = error
  }
})
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
    <UiField v-slot="{ id, describedBy, invalid }" label="Название компании" :error="errors.name">
      <UiInput
        :id="id"
        v-model="name"
        name="organization"
        autocomplete="organization"
        placeholder="Detail Lab"
        :described-by="describedBy"
        :invalid="invalid"
        :maxlength="200"
      />
    </UiField>
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Часовой пояс"
      description="В этом поясе считаются окна аналитики и показываются метки времени."
      :error="errors.defaultTimezone"
    >
      <UiSelect
        :id="id"
        v-model="defaultTimezone"
        :options="zones"
        :described-by="describedBy"
        :invalid="invalid"
      />
    </UiField>
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Основная валюта"
      description="Потенциал сделок и выручка суммируются только в этой валюте."
      :error="errors.defaultCurrency"
    >
      <UiSelect
        :id="id"
        v-model="defaultCurrency"
        :options="CURRENCY_OPTIONS"
        :described-by="describedBy"
        :invalid="invalid"
      />
    </UiField>

    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>

    <UiButton type="submit" block :loading="isSubmitting">Продолжить</UiButton>
  </form>
</template>
