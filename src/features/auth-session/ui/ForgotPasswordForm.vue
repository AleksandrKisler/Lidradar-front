<script setup lang="ts">
/**
 * Запрос письма для сброса пароля (ADR 0058).
 *
 * Ответ сервера одинаков для любого адреса, поэтому после успешной отправки форма всегда говорит одно
 * и то же: «если адрес зарегистрирован, письмо отправлено». Так страница не раскрывает, есть ли
 * учётная запись. Неверно записанный адрес отсекается до запроса. Пределы сервера (3 письма в час на
 * адрес, 10 в час с одного адреса клиента) показываются обратным отсчётом.
 */
import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiField, UiInput } from '@/shared/ui'
import { requestPasswordReset } from '@/entities/session'
import { forgotPasswordSchema } from '../model/schemas'
import { formatWait } from '../model/format-wait'
import { useRetryAfter } from '../model/use-retry-after'

const emit = defineEmits<{ sent: [] }>()

const retry = useRetryAfter('lidradar.password-reset.retryUntil')
const { defineField, handleSubmit, errors, resetForm, isSubmitting } = useForm({
  validationSchema: toTypedSchema(forgotPasswordSchema),
  initialValues: { email: '' },
})
const [email] = defineField('email')

/** Адрес, на который отправлен запрос; пока `null`, показывается форма. */
const sentTo = ref<string | null>(null)
const submitError = ref<unknown>(null)

const errorView = computed(() => {
  const error = submitError.value
  if (error === null) return null
  if (isApiError(error) && error.isRateLimited) {
    return {
      tone: 'warning' as const,
      title: 'Слишком много запросов',
      text: retry.active.value
        ? `Новое письмо можно запросить через ${formatWait(retry.secondsLeft.value)}. Ссылка из предыдущего письма остаётся действующей.`
        : 'Подождите немного и повторите попытку.',
    }
  }
  const described = describeError(error)
  return { tone: 'danger' as const, title: described.title, text: described.description }
})

const onSubmit = handleSubmit(async (values) => {
  if (retry.active.value) return
  submitError.value = null
  try {
    await requestPasswordReset({ email: values.email })
    sentTo.value = values.email
    emit('sent')
  } catch (error) {
    submitError.value = error
    if (isApiError(error) && error.isRateLimited) retry.start(error.retryAfterSeconds ?? 60)
  }
})

function useAnotherAddress(): void {
  sentTo.value = null
  submitError.value = null
  resetForm({ values: { email: '' } })
}
</script>

<template>
  <div v-if="sentTo !== null" class="flex flex-col gap-4" data-testid="reset-requested">
    <UiAlert tone="success" title="Проверьте почту">
      Если адрес <strong class="break-all">{{ sentTo }}</strong> зарегистрирован, мы отправили
      письмо со ссылкой для нового пароля. Ссылка действует 60 минут. Письма нет? Загляните в папку
      «Спам».
    </UiAlert>
    <UiButton variant="secondary" block @click="useAnotherAddress">Ввести другой адрес</UiButton>
  </div>
  <form v-else class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
    <UiField v-slot="{ id, describedBy, invalid }" label="Электронная почта" :error="errors.email">
      <UiInput
        :id="id"
        v-model="email"
        type="email"
        name="email"
        autocomplete="username"
        inputmode="email"
        placeholder="owner@example.test"
        :described-by="describedBy"
        :invalid="invalid"
        :maxlength="254"
      />
    </UiField>

    <UiAlert v-if="errorView" :tone="errorView.tone" :title="errorView.title">
      {{ errorView.text }}
    </UiAlert>

    <UiButton type="submit" block :loading="isSubmitting" :disabled="retry.active.value">
      {{
        retry.active.value
          ? `Повторить через ${formatWait(retry.secondsLeft.value)}`
          : 'Отправить ссылку'
      }}
    </UiButton>
  </form>
</template>
