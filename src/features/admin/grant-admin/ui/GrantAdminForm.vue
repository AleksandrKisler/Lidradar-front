<script setup lang="ts">
/**
 * Выдача права PLATFORM_ADMIN по почте зарегистрированного пользователя.
 * Повторная выдача идемпотентна (`200`) и подписывается отдельно; `404`
 * означает, что такого пользователя нет.
 */
import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiField, UiInput } from '@/shared/ui'
import { adminKeys, grantPlatformAdmin, type PlatformAdmin } from '@/entities/admin'
import { grantAdminSchema, type GrantAdminValues } from '../model/schema'

const emit = defineEmits<{ granted: [admin: PlatformAdmin] }>()

const queryClient = useQueryClient()
const { defineField, handleSubmit, errors, resetForm, isSubmitting } = useForm({
  validationSchema: toTypedSchema(grantAdminSchema),
  initialValues: { email: '', note: '' },
})
const [email] = defineField('email')
const [note] = defineField('note')
const notice = ref<string | null>(null)

const grant = useMutation({
  mutationFn: (values: GrantAdminValues) =>
    grantPlatformAdmin({ email: values.email, ...(values.note ? { note: values.note } : {}) }),
  onSuccess: async (result) => {
    await queryClient.invalidateQueries({ queryKey: adminKeys.admins() })
    notice.value = result.alreadyActive
      ? `Право уже действовало для ${result.admin.email ?? 'этого пользователя'}.`
      : `Право выдано: ${result.admin.email ?? result.admin.userId}. Запись в аудите сделана.`
    resetForm()
    emit('granted', result.admin)
  },
})

const errorView = computed(() => {
  if (!grant.error.value) return null
  if (isApiError(grant.error.value) && grant.error.value.httpStatus === 404) {
    return {
      title: 'Пользователь не найден',
      description: 'Право выдаётся только зарегистрированному пользователю с этой почтой.',
    }
  }
  return describeError(grant.error.value)
})
const traceId = computed(() => (isApiError(grant.error.value) ? grant.error.value.traceId : ''))

let inFlight = false
const onSubmit = handleSubmit(async (values) => {
  if (inFlight) return
  inFlight = true
  notice.value = null
  try {
    await grant.mutateAsync(values).catch(() => null)
  } finally {
    inFlight = false
  }
})
</script>

<template>
  <form class="flex flex-col gap-4" novalidate aria-label="Выдать право" @submit.prevent="onSubmit">
    <div class="grid gap-4 sm:grid-cols-2">
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Электронная почта"
        :error="errors.email"
      >
        <UiInput
          :id="id"
          v-model="email"
          type="email"
          name="adminEmail"
          autocomplete="off"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="grant.isPending.value"
        />
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Заметка"
        description="Зачем выдано право; попадает в аудит."
        :error="errors.note"
      >
        <UiInput
          :id="id"
          v-model="note"
          name="adminNote"
          :maxlength="500"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="grant.isPending.value"
        />
      </UiField>
    </div>
    <UiAlert v-if="notice" tone="success">{{ notice }}</UiAlert>
    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>
    <div>
      <UiButton type="submit" :loading="grant.isPending.value || isSubmitting"
        >Выдать право</UiButton
      >
    </div>
  </form>
</template>
