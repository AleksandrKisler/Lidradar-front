<script setup lang="ts">
/**
 * Новый пароль по ссылке из письма (ADR 0058).
 *
 * Токен приходит от страницы и живёт только в её памяти: в хранилище браузера он не попадает. Успех
 * сообщается родителю, а пароль удаляется из состояния формы. Сервер завершает все сессии
 * пользователя и входа не выполняет: после сброса человек входит новым паролем. Токен, который нельзя
 * использовать (просрочен, уже использован, отозван), сообщается родителю отдельным событием, а слабый
 * пароль токен не расходует.
 */
import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { formatWait, useRetryAfter } from '@/shared/lib'
import { UiAlert, UiButton, UiField, UiPasswordInput } from '@/shared/ui'
import { resetPassword } from '@/entities/session'
import { focusFirstProblem } from '../lib/focus-problem'
import { PASSWORD_MIN_LENGTH, resetPasswordSchema } from '../model/schemas'

const props = defineProps<{
  token: string
  /** Первичная загрузка сессии: подписи на месте, поля — каркас (Figma «Новый пароль · Первичная загрузка»). */
  loading?: boolean | undefined
}>()
const emit = defineEmits<{ done: []; invalid: [] }>()

const retry = useRetryAfter('lidradar.password-reset-confirm.retryUntil')
const { defineField, handleSubmit, errors, resetForm, isSubmitting } = useForm({
  validationSchema: toTypedSchema(resetPasswordSchema),
  initialValues: { password: '', confirmation: '' },
})
const [password] = defineField('password')
const [confirmation] = defineField('confirmation')
const submitError = ref<unknown>(null)

const errorView = computed(() => {
  const error = submitError.value
  if (error === null) return null
  if (isApiError(error) && error.isRateLimited) {
    return {
      tone: 'warning' as const,
      title: 'Слишком много попыток',
      text: `Повторите через ${formatWait(retry.secondsLeft.value)}.`,
    }
  }
  const described = describeError(error)
  return { tone: 'danger' as const, title: described.title, text: described.description }
})

const formEl = ref<HTMLFormElement | null>(null)
let succeeded = false
const submitValues = handleSubmit(async (values) => {
  if (retry.active.value) return
  submitError.value = null
  try {
    await resetPassword({ token: props.token, newPassword: values.password })
    resetForm({ values: { password: '', confirmation: '' } })
    succeeded = true
    emit('done')
  } catch (error) {
    if (isApiError(error) && error.code === 'RESET_TOKEN_INVALID') {
      resetForm({ values: { password: '', confirmation: '' } })
      succeeded = true
      emit('invalid')
      return
    }
    submitError.value = error
    if (isApiError(error) && error.isRateLimited) retry.start(error.retryAfterSeconds ?? 60)
  }
})

/** Поля были заблокированы на время запроса: после неудачи фокус возвращается к проблемному полю. */
async function onSubmit(event?: Event): Promise<void> {
  succeeded = false
  await submitValues(event)
  if (!succeeded) await focusFirstProblem(formEl.value)
}

const submitLabel = computed(() =>
  retry.active.value ? `Повторить через ${formatWait(retry.secondsLeft.value)}` : 'Сменить пароль',
)
</script>

<template>
  <div v-if="props.loading" class="flex flex-col gap-4" role="status" aria-label="Загрузка">
    <div class="flex flex-col gap-2">
      <p class="text-base leading-5 font-medium text-ink">Новый пароль</p>
      <div class="h-[46px] rounded-field bg-line motion-safe:animate-pulse" />
      <p class="text-xs text-secondary">Не меньше {{ PASSWORD_MIN_LENGTH }} символов</p>
    </div>
    <div class="flex flex-col gap-2">
      <p class="text-base leading-5 font-medium text-ink">Повторите пароль</p>
      <div class="h-[46px] rounded-field bg-line motion-safe:animate-pulse" />
    </div>
    <div
      class="flex h-[46px] items-center justify-center rounded-button bg-line text-field leading-5 font-medium text-muted"
    >
      Сменить пароль
    </div>
  </div>
  <form v-else ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Новый пароль"
      :description="`Не меньше ${PASSWORD_MIN_LENGTH} символов`"
      error-replaces-description
      :error="errors.password"
    >
      <UiPasswordInput
        :id="id"
        v-model="password"
        name="new-password"
        autocomplete="new-password"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="isSubmitting"
      />
    </UiField>
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Повторите пароль"
      :error="errors.confirmation"
    >
      <UiPasswordInput
        :id="id"
        v-model="confirmation"
        name="confirm-password"
        autocomplete="new-password"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="isSubmitting"
      />
    </UiField>

    <UiAlert v-if="errorView" :tone="errorView.tone" :title="errorView.title">
      {{ errorView.text }}
    </UiAlert>

    <UiButton type="submit" block :loading="isSubmitting" :disabled="retry.active.value">
      <!-- Figma «Отправка»: «Меняем пароль…», доступное имя остаётся «Сменить пароль». -->
      <template v-if="isSubmitting">
        <span aria-hidden="true">Меняем пароль…</span><span class="sr-only">{{ submitLabel }}</span>
      </template>
      <template v-else>{{ submitLabel }}</template>
    </UiButton>
  </form>
</template>
