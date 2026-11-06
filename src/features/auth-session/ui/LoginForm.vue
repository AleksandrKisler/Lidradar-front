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
import { computed, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { useRetryAfter } from '@/shared/lib'
import { UiAlert, UiButton, UiField, UiInput, UiPasswordInput } from '@/shared/ui'
import { login, useSessionStore } from '@/entities/session'
import { focusFirstProblem } from '../lib/focus-problem'
import { loginSchema } from '../model/schemas'

const emit = defineEmits<{ success: [] }>()

const session = useSessionStore()
/** Скринридеру отсчёт объявляется один раз при блокировке, а не каждую секунду. */
const announcedSeconds = ref(0)
const retry = useRetryAfter('lidradar.login.retryUntil')
watch(
  () => retry.active.value,
  (active) => {
    if (active) announcedSeconds.value = retry.secondsLeft.value
  },
  { immediate: true },
)

const { defineField, handleSubmit, errors, resetField, isSubmitting } = useForm({
  validationSchema: toTypedSchema(loginSchema),
  initialValues: { email: '', password: '' },
})
const [email] = defineField('email')
const [password] = defineField('password')

/** Ошибка последней отправки; сбрасывается при следующей попытке. */
const formEl = ref<HTMLFormElement | null>(null)
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

let succeeded = false
const submitValues = handleSubmit(async (values) => {
  if (retry.active.value) return
  submitError.value = null
  try {
    await login({ email: values.email, password: values.password })
    resetField('password', { value: '' })
    await session.refresh()
    succeeded = true
    emit('success')
  } catch (error) {
    submitError.value = error
    if (isApiError(error) && error.isRateLimited) retry.start(error.retryAfterSeconds ?? 60)
  }
})

/** Поля были заблокированы на время запроса: после неудачи фокус — на поле с ошибкой или на пароле. */
async function onSubmit(event?: Event): Promise<void> {
  succeeded = false
  await submitValues(event)
  if (!succeeded) await focusFirstProblem(formEl.value, 'input[name="password"]')
}
</script>

<template>
  <form ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
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
        :disabled="isSubmitting"
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
        :disabled="isSubmitting"
      />
      <p class="flex h-[46px] items-center justify-end text-sm">
        <RouterLink :to="{ name: 'forgot-password' }" class="text-link hover:underline"
          >Забыли пароль?</RouterLink
        >
      </p>
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
      Вход временно недоступен. Повторите попытку через {{ announcedSeconds }} секунд.
    </p>

    <UiButton type="submit" block :loading="isSubmitting" :disabled="retry.active.value">
      <!-- Figma 459:3312: при отправке «Входим…», доступное имя кнопки остаётся «Войти». -->
      <template v-if="isSubmitting">
        <span aria-hidden="true">Входим…</span><span class="sr-only">{{ submitLabel }}</span>
      </template>
      <template v-else>{{ submitLabel }}</template>
    </UiButton>
  </form>
</template>
