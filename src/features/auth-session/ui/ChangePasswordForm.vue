<script setup lang="ts">
/**
 * Смена пароля вошедшим пользователем (ADR 0058).
 *
 * Нужен текущий пароль: он подтверждает владельца сессии. Неверный текущий пароль сервер отвечает
 * `403 INVALID_CURRENT_PASSWORD`, а не `401`, поэтому опечатка не разлогинивает: ошибка показывается
 * у поля. Попытки ограничены (5 за 15 минут): после предела форма показывает обратный отсчёт. После
 * успеха сервер завершает остальные сессии, текущая остаётся, а пароли удаляются из состояния формы.
 */
import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { formatWait, useRetryAfter } from '@/shared/lib'
import { UiAlert, UiButton, UiField, UiPasswordInput } from '@/shared/ui'
import { changePassword } from '@/entities/session'
import { PASSWORD_MIN_LENGTH, changePasswordSchema } from '../model/schemas'

const emit = defineEmits<{ changed: [] }>()

const retry = useRetryAfter('lidradar.password-change.retryUntil')
const { defineField, handleSubmit, errors, resetForm, setFieldError, isSubmitting } = useForm({
  validationSchema: toTypedSchema(changePasswordSchema),
  initialValues: { currentPassword: '', password: '', confirmation: '' },
})
const [currentPassword] = defineField('currentPassword')
const [password] = defineField('password')
const [confirmation] = defineField('confirmation')

const submitError = ref<unknown>(null)
const changed = ref(false)

const errorView = computed(() => {
  const error = submitError.value
  if (error === null) return null
  if (isApiError(error) && error.isRateLimited) {
    return {
      tone: 'warning' as const,
      title: 'Слишком много попыток',
      text: `Проверьте текущий пароль и повторите через ${formatWait(retry.secondsLeft.value)}.`,
    }
  }
  const described = describeError(error)
  return { tone: 'danger' as const, title: described.title, text: described.description }
})

const onSubmit = handleSubmit(async (values) => {
  if (retry.active.value) return
  submitError.value = null
  changed.value = false
  try {
    await changePassword({ currentPassword: values.currentPassword, newPassword: values.password })
    resetForm({ values: { currentPassword: '', password: '', confirmation: '' } })
    changed.value = true
    emit('changed')
  } catch (error) {
    if (isApiError(error) && error.code === 'INVALID_CURRENT_PASSWORD') {
      setFieldError('currentPassword', 'Текущий пароль не подошёл')
      return
    }
    submitError.value = error
    if (isApiError(error) && error.isRateLimited) retry.start(error.retryAfterSeconds ?? 60)
  }
})
</script>

<template>
  <form class="flex max-w-md flex-col gap-5" novalidate @submit.prevent="onSubmit">
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Текущий пароль"
      :error="errors.currentPassword"
    >
      <UiPasswordInput
        :id="id"
        v-model="currentPassword"
        name="current-password"
        autocomplete="current-password"
        :described-by="describedBy"
        :invalid="invalid"
      />
    </UiField>
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Новый пароль"
      :description="`Не меньше ${PASSWORD_MIN_LENGTH} символов`"
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
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Повторите новый пароль"
      :error="errors.confirmation"
    >
      <UiPasswordInput
        :id="id"
        v-model="confirmation"
        name="confirm-password"
        autocomplete="new-password"
        :described-by="describedBy"
        :invalid="invalid"
      />
    </UiField>

    <UiAlert v-if="errorView" :tone="errorView.tone" :title="errorView.title">
      {{ errorView.text }}
    </UiAlert>
    <UiAlert v-if="changed" tone="success" title="Пароль изменён">
      На остальных устройствах вы вышли из аккаунта. Мы отправили уведомление на вашу почту.
    </UiAlert>

    <div>
      <UiButton type="submit" :loading="isSubmitting" :disabled="retry.active.value">
        {{
          retry.active.value
            ? `Повторить через ${formatWait(retry.secondsLeft.value)}`
            : 'Сменить пароль'
        }}
      </UiButton>
    </div>
  </form>
</template>
