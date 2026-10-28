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
import { formatWait, useRetryAfter } from '@/shared/lib'
import { UiAlert, UiButton, UiField, UiInput } from '@/shared/ui'
import { requestPasswordReset } from '@/entities/session'
import { focusFirstProblem } from '../lib/focus-problem'
import { forgotPasswordSchema } from '../model/schemas'

const props = defineProps<{
  /** Первичная загрузка сессии: подписи на месте, поле — каркас (Figma «Восстановление пароля · Первичная загрузка»). */
  loading?: boolean | undefined
}>()
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
  // Нет связи с сервером: подпись макета «Не удалось отправить письмо» (Figma 462:6786).
  if (isApiError(error) && error.httpStatus === 0) {
    return {
      tone: 'danger' as const,
      title: 'Не удалось отправить письмо',
      text: 'Проверьте подключение и попробуйте ещё раз.',
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
    await requestPasswordReset({ email: values.email })
    sentTo.value = values.email
    succeeded = true
    emit('sent')
  } catch (error) {
    submitError.value = error
    if (isApiError(error) && error.isRateLimited) retry.start(error.retryAfterSeconds ?? 60)
  }
})

/** Поле было заблокировано на время запроса: после неудачи фокус возвращается к нему. */
async function onSubmit(event?: Event): Promise<void> {
  succeeded = false
  await submitValues(event)
  if (!succeeded) await focusFirstProblem(formEl.value)
}

const submitLabel = computed(() =>
  retry.active.value
    ? `Повторить через ${formatWait(retry.secondsLeft.value)}`
    : 'Отправить ссылку',
)

function useAnotherAddress(): void {
  sentTo.value = null
  submitError.value = null
  resetForm({ values: { email: '' } })
}
</script>

<template>
  <div v-if="props.loading" class="flex flex-col gap-4" role="status" aria-label="Загрузка">
    <div class="flex flex-col gap-2">
      <p class="text-base leading-5 font-medium text-ink">Электронная почта</p>
      <div class="h-[46px] rounded-field bg-line motion-safe:animate-pulse" />
    </div>
    <div
      class="flex h-[46px] items-center justify-center rounded-button bg-line text-field leading-5 font-medium text-muted"
    >
      Отправить ссылку
    </div>
  </div>
  <div v-else-if="sentTo !== null" class="flex flex-col gap-4" data-testid="reset-requested">
    <UiAlert tone="success" title="Проверьте почту">
      Если адрес <strong class="break-all">{{ sentTo }}</strong> зарегистрирован, мы отправили
      письмо со ссылкой для нового пароля. Ссылка действует 60 минут. Письма нет? Загляните в папку
      «Спам».
    </UiAlert>
    <UiButton variant="secondary" block @click="useAnotherAddress">Ввести другой адрес</UiButton>
  </div>
  <form v-else ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
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

    <UiAlert v-if="errorView" :tone="errorView.tone" :title="errorView.title">
      {{ errorView.text }}
    </UiAlert>

    <UiButton type="submit" block :loading="isSubmitting" :disabled="retry.active.value">
      <!-- Figma «Отправка»: «Отправляем…», доступное имя остаётся «Отправить ссылку». -->
      <template v-if="isSubmitting">
        <span aria-hidden="true">Отправляем…</span><span class="sr-only">{{ submitLabel }}</span>
      </template>
      <template v-else>{{ submitLabel }}</template>
    </UiButton>
  </form>
</template>
