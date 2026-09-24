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
import { UiAlert, UiButton, UiDialog, UiField, UiInput, UiSelect } from '@/shared/ui'
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

const { defineField, handleSubmit, errors, resetForm, values, meta } = useForm({
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
const consequences = computed(() => {
  const list: string[] = []
  if (pendingBody.value?.defaultTimezone) {
    list.push('Календарные окна аналитики и часы уведомлений будут считаться в новом поясе.')
  }
  if (pendingBody.value?.defaultCurrency) {
    list.push('Исторические суммы не конвертируются: они останутся в прежней валюте.')
  }
  return list
})

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
    current.name !== props.organization.name ||
    current.defaultTimezone !== props.organization.defaultTimezone ||
    (current.defaultCurrency ?? '').toUpperCase() !== props.organization.defaultCurrency
  )
})
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
    <UiField v-slot="{ id, describedBy, invalid }" label="Название компании" :error="errors.name">
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
    <div class="grid gap-5 sm:grid-cols-2">
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Основная валюта"
        :error="errors.defaultCurrency"
      >
        <UiSelect
          :id="id"
          v-model="defaultCurrency"
          name="organizationCurrency"
          :options="CURRENCY_OPTIONS"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="mutation.isPending.value"
        />
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Часовой пояс"
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

    <UiAlert v-if="saved" tone="success">Настройки компании сохранены.</UiAlert>
    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>

    <div class="flex items-center justify-between gap-4">
      <p class="text-xs text-muted">Изменения применяются к новым проверкам риска.</p>
      <UiButton type="submit" :disabled="!hasChanges" :loading="mutation.isPending.value">
        Сохранить
      </UiButton>
    </div>

    <UiDialog
      v-model:open="confirmOpen"
      title="Изменить пояс или валюту?"
      description="Это влияет на расчёты, а не только на подписи."
      :dismissible="!mutation.isPending.value"
    >
      <ul class="list-disc space-y-1 pl-5 text-sm text-ink">
        <li v-for="line in consequences" :key="line">{{ line }}</li>
      </ul>
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
        <UiButton
          variant="secondary"
          :disabled="mutation.isPending.value"
          @click="confirmOpen = false"
        >
          Отмена
        </UiButton>
        <UiButton :loading="mutation.isPending.value" @click="pendingBody && send(pendingBody)">
          Сохранить изменения
        </UiButton>
      </template>
    </UiDialog>
  </form>
</template>
