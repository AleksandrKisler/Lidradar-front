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
import { computed, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { describeError, isApiError, tenantScope } from '@/shared/api'
import { UiAlert, UiButton, UiField, UiInput, UiSelect, UiSheetDialog } from '@/shared/ui'
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
const emit = defineEmits<{ saved: [organization: Organization] }>()

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

// Организация обновилась извне (другой владелец): форма следует за сервером,
// пока пользователь её не трогал, чтобы не перезаписать чужие изменения.
watch(
  () => props.organization,
  (organization) => {
    if (!meta.value.dirty) {
      resetForm({
        values: {
          name: organization.name,
          defaultTimezone: organization.defaultTimezone,
          defaultCurrency: organization.defaultCurrency,
        },
      })
    }
  },
)

const mutation = useMutation({
  mutationFn: (body: UpdateOrganizationRequest) => updateOrganization(props.tenantId, body),
  onSuccess: async (organization, body) => {
    const scope = tenantScope(props.tenantId)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(props.tenantId) }),
      ...(body.defaultTimezone || body.defaultCurrency
        ? [queryClient.invalidateQueries({ queryKey: [...scope, 'analytics'] })]
        : []),
    ])
    if (body.name) await session.refresh().catch(() => undefined)
    resetForm({
      values: {
        name: organization.name,
        defaultTimezone: organization.defaultTimezone,
        defaultCurrency: organization.defaultCurrency,
      },
    })
    emit('saved', organization)
  },
})

const confirmOpen = ref(false)
const pendingBody = ref<UpdateOrganizationRequest | null>(null)
const saved = ref(false)

const errorView = computed(() =>
  mutation.error.value ? describeError(mutation.error.value) : null,
)
const traceId = computed(() =>
  isApiError(mutation.error.value) ? mutation.error.value.traceId : '',
)
/** «Оставить прежние»: пояс и валюта возвращаются к сохранённым значениям, название остаётся как набрано. */
function keepPrevious(): void {
  setFieldValue('defaultTimezone', props.organization.defaultTimezone)
  setFieldValue('defaultCurrency', props.organization.defaultCurrency)
  pendingBody.value = null
  mutation.reset()
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

const onSubmit = handleSubmit(async (formValues) => {
  saved.value = false
  mutation.reset()
  const body = diff(formValues)
  if (Object.keys(body).length === 0) return
  if (body.defaultTimezone || body.defaultCurrency) {
    pendingBody.value = body
    confirmOpen.value = true
    return
  }
  await send(body)
})

async function send(body: UpdateOrganizationRequest): Promise<void> {
  const result = await mutation.mutateAsync(body).catch(() => null)
  if (result) {
    saved.value = true
    confirmOpen.value = false
    pendingBody.value = null
  }
}

const hasChanges = computed(() => {
  const current = values
  return (
    current.name?.trim() !== props.organization.name ||
    current.defaultTimezone !== props.organization.defaultTimezone ||
    (current.defaultCurrency ?? '').toUpperCase() !== props.organization.defaultCurrency
  )
})
</script>

<template>
  <form
    class="flex flex-col gap-4 max-lg:[&_label]:text-base max-lg:[&_label]:leading-6"
    novalidate
    @submit.prevent="onSubmit"
  >
    <UiField
      v-slot="{ id, describedBy, invalid }"
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
        :disabled="mutation.isPending.value"
      />
    </UiField>
    <div class="flex flex-col gap-4 md:max-lg:gap-4 lg:grid lg:grid-cols-2">
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
          :options="currencies"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="mutation.isPending.value"
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
          :options="zones"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="mutation.isPending.value"
        />
      </UiField>
    </div>
    <p class="text-sm leading-5 text-secondary md:max-lg:text-[13px] lg:text-xs lg:leading-[18px]">
      Валюта не пересчитывает прежние суммы. Часовой пояс используется в отчётах и уведомлениях.
    </p>

    <UiAlert v-if="saved" tone="success">Настройки компании сохранены.</UiAlert>
    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>

    <div class="flex lg:justify-end">
      <UiButton
        type="submit"
        class="w-full lg:w-[220px]"
        :disabled="!hasChanges"
        :loading="mutation.isPending.value"
      >
        Сохранить компанию
      </UiButton>
    </div>

    <UiSheetDialog
      v-model:open="confirmOpen"
      title="Изменить валюту и часовой пояс?"
      description="Эти параметры общие для всей компании."
      description-in-body
      description-strong
      size="sm"
      footer-fill
      :dismissible="!mutation.isPending.value"
    >
      <p
        class="text-base leading-6 font-semibold text-ink lg:text-sm lg:leading-5 lg:font-normal lg:text-secondary"
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
        <UiButton variant="secondary" :disabled="mutation.isPending.value" @click="keepPrevious">
          Оставить прежние
        </UiButton>
        <UiButton :loading="mutation.isPending.value" @click="pendingBody && send(pendingBody)">
          Сохранить изменения
        </UiButton>
      </template>
    </UiSheetDialog>
  </form>
</template>
