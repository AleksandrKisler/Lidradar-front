<script setup lang="ts">
/**
 * Форма входа.
 *
 * После успешного входа пароль удаляется из состояния формы, затем
 * перечитывается `/auth/me`: только его ответ определяет следующий шаг
 * (организация, выбор рабочего пространства или Radar). Ошибка `401` не
 * раскрывает, существует ли адрес; `429` включает обратный отсчёт по
 * серверному `Retry-After`; сетевая ошибка не выдаётся за неверные реквизиты.
 */
import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiField, UiInput, UiPasswordInput } from '@/shared/ui'
import { login, useSessionStore } from '@/entities/session'
import { loginSchema } from '../model/schemas'
import { useRetryAfter } from '../model/use-retry-after'

const emit = defineEmits<{ success: [] }>()

const session = useSessionStore()
const retry = useRetryAfter('lidradar.login.retryUntil')

const { defineField, handleSubmit, errors, resetField, isSubmitting } = useForm({
  validationSchema: toTypedSchema(loginSchema),
  initialValues: { email: '', password: '' },
})
const [email] = defineField('email')
const [password] = defineField('password')

/** Ошибка последней отправки; сбрасывается при следующей попытке. */
const submitError = ref<unknown>(null)

const errorView = computed(() => {
  const error = submitError.value
  if (error === null) return null
  if (isApiError(error)) {
    if (error.isRateLimited) {
      return {
        tone: 'warning' as const,
        title: 'Слишком много попыток входа',
        text: 'Проверьте электронную почту и пароль перед следующей попыткой.',
        traceId: '',
      }
    }
    if (error.httpStatus === 401 || error.httpStatus === 400) {
      return {
        tone: 'danger' as const,
        title: 'Не удалось войти',
        text: 'Проверьте электронную почту и пароль.',
        traceId: '',
      }
    }
  }
  const described = describeError(error)
  return {
    tone: 'danger' as const,
    title: described.title,
    text: described.description,
    traceId: isApiError(error) ? error.traceId : '',
  }
})

const submitLabel = computed(() =>
  retry.active.value ? `Войти через ${retry.secondsLeft.value} с` : 'Войти',
)

const onSubmit = handleSubmit(async (values) => {
  if (retry.active.value) return
  submitError.value = null
  try {
    await login({ email: values.email, password: values.password })
    resetField('password', { value: '' })
    await session.refresh()
    emit('success')
  } catch (error) {
    submitError.value = error
    if (isApiError(error) && error.isRateLimited) retry.start(error.retryAfterSeconds ?? 60)
  }
})
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
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
    <UiField v-slot="{ id, describedBy, invalid }" label="Пароль" :error="errors.password">
      <UiPasswordInput
        :id="id"
        v-model="password"
        name="password"
        autocomplete="current-password"
        :described-by="describedBy"
        :invalid="invalid"
      />
    </UiField>

    <UiAlert
      v-if="errorView"
      :tone="errorView.tone"
      :title="errorView.title"
      :trace-id="errorView.traceId"
    >
      {{ errorView.text }}
    </UiAlert>
    <p v-if="retry.active.value" class="sr-only" role="status">
      Вход временно недоступен. Повторите попытку через {{ retry.secondsLeft.value }} секунд.
    </p>

    <UiButton type="submit" block :loading="isSubmitting" :disabled="retry.active.value">
      {{ submitLabel }}
    </UiButton>
  </form>
</template>
