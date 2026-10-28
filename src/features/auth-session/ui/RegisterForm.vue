<script setup lang="ts">
/**
 * Форма регистрации. Сервер сразу создаёт сессию; дальше — обязательный
 * `/auth/me`, а не прямой переход в приложение. Занятая почта показывается
 * у поля, пароль после ошибки не сохраняется нигде, кроме формы.
 *
 * Регистрация по приглашениям (ADR 0057): режим читается с сервера, и в
 * `invite_only` форма просит код (платформы или сотрудника). Пока режим
 * неизвестен или запрос не удался, поле показано: решает сервер. Причина
 * отказа по коду не различается, сервер отвечает одинаково на любую.
 */
import { computed, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { useRetryAfter } from '@/shared/lib'
import { UiAlert, UiButton, UiField, UiInput, UiPasswordInput } from '@/shared/ui'
import { register, useRegistrationModeQuery, useSessionStore } from '@/entities/session'
import { focusFirstProblem } from '../lib/focus-problem'
import { PASSWORD_MIN_LENGTH, registerSchema } from '../model/schemas'

const props = defineProps<{
  /** Код из ссылки приглашения; страница убирает его из адреса, форма только подставляет. */
  initialCode?: string | undefined
  /** Первичная загрузка сессии: подписи на месте, поля — каркас (Figma «Регистрация · Первичная загрузка»). */
  loading?: boolean | undefined
}>()
const emit = defineEmits<{ success: [] }>()

const session = useSessionStore()
/** Скринридеру отсчёт объявляется один раз при блокировке, а не каждую секунду. */
const announcedSeconds = ref(0)
const retry = useRetryAfter('lidradar.register.retryUntil')
watch(
  () => retry.active.value,
  (active) => {
    if (active) announcedSeconds.value = retry.secondsLeft.value
  },
  { immediate: true },
)
const registration = useRegistrationModeQuery()

/**
 * Сервер ответил «код обязателен», хотя закешированный режим был `open`: режим успели закрыть. Поле
 * показывается принудительно, иначе ошибка пришла бы к скрытому полю и осталась бы незамеченной.
 */
const serverRequiresCode = ref(false)

/** Код обязателен, пока сервер не сообщил `open`. */
const requiresCode = computed(
  () => serverRequiresCode.value || registration.data.value?.mode !== 'open',
)

const { defineField, handleSubmit, errors, setFieldError, isSubmitting } = useForm({
  validationSchema: toTypedSchema(registerSchema),
  initialValues: { email: '', displayName: '', password: '', inviteCode: props.initialCode ?? '' },
})
const [email] = defineField('email')
const [displayName] = defineField('displayName')
const [password] = defineField('password')
const [inviteCode] = defineField('inviteCode')

/** В открытом режиме поле нужно только тому, кто пришёл по ссылке с кодом. */
const showCode = computed(() => requiresCode.value || Boolean(props.initialCode))

const formEl = ref<HTMLFormElement | null>(null)
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

let succeeded = false
const submitValues = handleSubmit(async (values) => {
  if (retry.active.value) return
  submitError.value = null
  if (requiresCode.value && values.inviteCode === '') {
    setFieldError('inviteCode', 'Для регистрации нужен код приглашения')
    return
  }
  try {
    await register({
      email: values.email,
      displayName: values.displayName,
      password: values.password,
      ...(values.inviteCode === '' ? {} : { inviteCode: values.inviteCode }),
    })
    await session.refresh()
    succeeded = true
    emit('success')
  } catch (error) {
    if (isApiError(error) && error.code === 'EMAIL_ALREADY_REGISTERED') {
      setFieldError('email', 'Этот адрес уже зарегистрирован. Войдите или используйте другой.')
      return
    }
    if (isApiError(error) && error.code === 'INVITATION_REQUIRED') {
      serverRequiresCode.value = true
      void registration.refetch()
      setFieldError('inviteCode', 'Для регистрации нужен код приглашения')
      return
    }
    if (isApiError(error) && error.code === 'INVITATION_INVALID') {
      setFieldError(
        'inviteCode',
        'Код не подходит: он неверен, просрочен, уже использован или отозван. Попросите новый.',
      )
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
</script>

<template>
  <form v-if="props.loading" class="flex flex-col gap-4" role="status" aria-label="Загрузка">
    <div class="flex flex-col gap-2">
      <p class="text-base leading-5 font-medium text-ink">Код приглашения</p>
      <div class="h-[46px] rounded-field bg-line motion-safe:animate-pulse" />
      <p class="text-xs text-secondary">
        43 символа. Код платформы выдаёт оператор, код сотрудника — владелец вашей организации.
      </p>
    </div>
    <div class="flex flex-col gap-2">
      <p class="text-base leading-5 font-medium text-ink">Имя</p>
      <div class="h-[46px] rounded-field bg-line motion-safe:animate-pulse" />
    </div>
    <div class="flex flex-col gap-2">
      <p class="text-base leading-5 font-medium text-ink">Электронная почта</p>
      <div class="h-[46px] rounded-field bg-line motion-safe:animate-pulse" />
    </div>
    <div class="flex flex-col gap-2">
      <p class="text-base leading-5 font-medium text-ink">Пароль</p>
      <div class="h-[46px] rounded-field bg-line motion-safe:animate-pulse" />
      <p class="text-xs text-secondary">Не меньше {{ PASSWORD_MIN_LENGTH }} символов.</p>
    </div>
    <div
      class="flex h-[46px] items-center justify-center rounded-button bg-line text-field leading-5 font-medium text-muted"
    >
      Создать аккаунт
    </div>
    <p class="text-xs leading-[18px] text-secondary">
      Создавая аккаунт, вы принимаете
      <a
        href="/legal/terms.html"
        target="_blank"
        rel="noopener"
        class="font-medium text-link hover:underline"
        >Пользовательское соглашение</a
      >
      и подтверждаете, что ознакомились с
      <a
        href="/legal/privacy.html"
        target="_blank"
        rel="noopener"
        class="font-medium text-link hover:underline"
        >Политикой обработки персональных данных</a
      >.
    </p>
  </form>
  <form v-else ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
    <UiField
      v-if="showCode"
      v-slot="{ id, describedBy, invalid }"
      error-replaces-description
      :label="requiresCode ? 'Код приглашения' : 'Код приглашения (необязательно)'"
      description="43 символа. Код платформы выдаёт оператор, код сотрудника — владелец вашей организации."
      :error="errors.inviteCode"
    >
      <UiInput
        :id="id"
        v-model="inviteCode"
        name="invite-code"
        autocomplete="off"
        spellcheck="false"
        autocapitalize="off"
        :described-by="describedBy"
        :invalid="invalid"
        :maxlength="128"
        :disabled="isSubmitting"
      />
    </UiField>
    <UiField v-slot="{ id, describedBy, invalid }" label="Имя" :error="errors.displayName">
      <UiInput
        :id="id"
        v-model="displayName"
        name="name"
        autocomplete="name"
        :described-by="describedBy"
        :invalid="invalid"
        :maxlength="200"
        :disabled="isSubmitting"
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
        :disabled="isSubmitting"
      />
    </UiField>
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Пароль"
      error-replaces-description
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
        :disabled="isSubmitting"
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
      Регистрация временно недоступна. Повторите попытку через {{ announcedSeconds }} секунд.
    </p>

    <UiButton type="submit" block :loading="isSubmitting" :disabled="retry.active.value">
      <!-- Figma «Регистрация · Отправка»: «Создаём аккаунт…», доступное имя остаётся «Создать аккаунт». -->
      <template v-if="isSubmitting">
        <span aria-hidden="true">Создаём аккаунт…</span
        ><span class="sr-only">{{ submitLabel }}</span>
      </template>
      <template v-else>{{ submitLabel }}</template>
    </UiButton>
    <p class="text-xs leading-[18px] text-secondary" data-testid="register-legal">
      Создавая аккаунт, вы принимаете
      <a
        href="/legal/terms.html"
        target="_blank"
        rel="noopener"
        class="font-medium text-link hover:underline"
        >Пользовательское соглашение</a
      >
      и подтверждаете, что ознакомились с
      <a
        href="/legal/privacy.html"
        target="_blank"
        rel="noopener"
        class="font-medium text-link hover:underline"
        >Политикой обработки персональных данных</a
      >.
    </p>
  </form>
</template>
