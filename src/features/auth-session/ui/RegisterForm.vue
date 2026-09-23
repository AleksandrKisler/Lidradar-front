<script setup lang="ts">
/**
 * Форма регистрации. Сервер сразу создаёт сессию; дальше — обязательный
 * `/auth/me`, а не прямой переход в приложение. Занятая почта показывается
 * у поля, пароль после ошибки не сохраняется нигде, кроме формы.
 */
import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiField, UiInput, UiPasswordInput } from '@/shared/ui'
import { register, useSessionStore } from '@/entities/session'
import { PASSWORD_MIN_LENGTH, registerSchema } from '../model/schemas'
import { useRetryAfter } from '../model/use-retry-after'

const emit = defineEmits<{ success: [] }>()

const session = useSessionStore()
const retry = useRetryAfter('lidradar.register.retryUntil')

const { defineField, handleSubmit, errors, setFieldError, isSubmitting } = useForm({
  validationSchema: toTypedSchema(registerSchema),
  initialValues: { email: '', displayName: '', password: '' },
})
const [email] = defineField('email')
const [displayName] = defineField('displayName')
const [password] = defineField('password')

const submitError = ref<unknown>(null)

const errorView = computed(() => {
  const error = submitError.value
  if (error === null) return null
  const described = describeError(error)
  return {
    tone: isApiError(error) && error.isRateLimited ? ('warning' as const) : ('danger' as const),
    title: described.title,
    text: described.description,
    traceId: isApiError(error) && !error.isRateLimited ? error.traceId : '',
  }
})

const submitLabel = computed(() =>
  retry.active.value ? `Создать аккаунт через ${retry.secondsLeft.value} с` : 'Создать аккаунт',
)

const onSubmit = handleSubmit(async (values) => {
  if (retry.active.value) return
  submitError.value = null
  try {
    await register({
      email: values.email,
      displayName: values.displayName,
      password: values.password,
    })
    await session.refresh()
    emit('success')
  } catch (error) {
    if (isApiError(error) && error.code === 'EMAIL_ALREADY_REGISTERED') {
      setFieldError('email', 'Этот адрес уже зарегистрирован. Войдите или используйте другой.')
      return
    }
    submitError.value = error
    if (isApiError(error) && error.isRateLimited) retry.start(error.retryAfterSeconds ?? 60)
  }
})
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
    <UiField v-slot="{ id, describedBy, invalid }" label="Имя" :error="errors.displayName">
      <UiInput
        :id="id"
        v-model="displayName"
        name="name"
        autocomplete="name"
        :described-by="describedBy"
        :invalid="invalid"
        :maxlength="200"
      />
    </UiField>
    <UiField v-slot="{ id, describedBy, invalid }" label="Электронная почта" :error="errors.email">
      <UiInput
        :id="id"
        v-model="email"
        type="email"
        name="email"
        autocomplete="username"
        inputmode="email"
        :described-by="describedBy"
        :invalid="invalid"
        :maxlength="254"
      />
    </UiField>
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Пароль"
      :description="`Не меньше ${PASSWORD_MIN_LENGTH} символов.`"
      :error="errors.password"
    >
      <UiPasswordInput
        :id="id"
        v-model="password"
        name="new-password"
        autocomplete="new-password"
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
      Регистрация временно недоступна. Повторите попытку через {{ retry.secondsLeft.value }} секунд.
    </p>

    <UiButton type="submit" block :loading="isSubmitting" :disabled="retry.active.value">
      {{ submitLabel }}
    </UiButton>
  </form>
</template>
