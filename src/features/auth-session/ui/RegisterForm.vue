<script setup lang="ts">
/**
 * Данные аккаунта A/B3 и отключённая форма C (US-M01-01; Figma 784:6465, 783:6429, 788:6501).
 * Форма содержит только имя, почту и пароль: режим регистрации и проверенное приглашение
 * принадлежат модели страницы, поля кода здесь нет. Форма проверяет формат и передаёт значения
 * наверх; отправку, отказ и восстановление исхода выполняет `useRegistrationFlow`.
 *
 * Нейтральный отказ (ADR 0068) показывается одним блоком над полями; ошибки формата — у полей.
 * Пароль живёт только в этой форме и пропадает вместе с ней при смене сценария.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiField, UiInput, UiPasswordInput } from '@/shared/ui'
import { focusFirstProblem } from '../lib/focus-problem'
import { PASSWORD_MIN_LENGTH, registerSchema } from '../model/schemas'
import type { RegistrationSubmitStatus, RegistrationValues } from '../model/use-registration-flow'

const props = withDefaults(
  defineProps<{
    /** `open` — A, `invite` — B3, `closed` — C (все действия формы недоступны). */
    variant?: 'open' | 'invite' | 'closed'
    /** Плейсхолдер загрузки: подписи на месте, поля — каркас (Figma 811:7677, 462:6648, 811:7751). */
    loading?: boolean
    /** Имя и почта из памяти страницы; пароль сюда не передаётся никогда. */
    draft?: { displayName: string; email: string } | undefined
    status?: RegistrationSubmitStatus
    /** Ошибка последней отправки (`null`, если её нет). */
    error: unknown
    /** Секунды до повторной регистрации после `429`. */
    retrySeconds?: number
    /** Форма открыта успешной проверкой кода: фокус переходит к первому полю. */
    autofocus?: boolean
  }>(),
  {
    variant: 'open',
    loading: false,
    draft: () => ({ displayName: '', email: '' }),
    status: 'idle',
    retrySeconds: 0,
    autofocus: false,
  },
)

const emit = defineEmits<{
  submit: [values: RegistrationValues]
  'update:draft': [draft: { displayName: string; email: string }]
  /** Пользователь изменил поле: устаревший общий отказ можно убрать. */
  edit: []
  'retry-session': []
}>()

const closed = computed(() => props.variant === 'closed')
const busy = computed(() => ['submitting', 'account-created', 'reconciling'].includes(props.status))
const locked = computed(() => ['session-error', 'outcome-unknown'].includes(props.status))
const waiting = computed(() => props.retrySeconds > 0)
const fieldsDisabled = computed(() => closed.value || busy.value || locked.value)

const { defineField, handleSubmit, errors, values } = useForm({
  validationSchema: toTypedSchema(registerSchema),
  initialValues: closed.value
    ? { displayName: '', email: '', password: '' }
    : { displayName: props.draft.displayName, email: props.draft.email, password: '' },
})
const [displayName] = defineField('displayName')
const [email] = defineField('email')
const [password] = defineField('password')

watch([displayName, email], ([name, address]) => {
  if (!closed.value) emit('update:draft', { displayName: name ?? '', email: address ?? '' })
})
watch(
  () => [values.displayName, values.email, values.password],
  () => emit('edit'),
)

/** Скринридеру отсчёт объявляется один раз при блокировке, а не каждую секунду. */
const announcedSeconds = ref(0)
watch(
  waiting,
  (active) => {
    if (active) announcedSeconds.value = props.retrySeconds
  },
  { immediate: true },
)

const submitLabel = computed(() =>
  waiting.value ? `Создать аккаунт через ${props.retrySeconds} с` : 'Создать аккаунт',
)

type Feedback =
  | { kind: 'rejected'; title: string; text: string }
  | { kind: 'failed'; tone: 'warning' | 'danger'; title: string; text: string; traceId: string }
  | { kind: 'unknown' }
  | { kind: 'session' }

const feedback = computed<Feedback | null>(() => {
  if (props.status === 'rejected') {
    const described = describeError(props.error)
    return { kind: 'rejected', title: described.title, text: described.description }
  }
  if (props.status === 'failed') {
    const described = describeError(props.error)
    const limited = isApiError(props.error) && props.error.isRateLimited
    return {
      kind: 'failed',
      tone: limited ? 'warning' : 'danger',
      title: described.title,
      text: described.description,
      traceId: isApiError(props.error) && !limited ? props.error.traceId : '',
    }
  }
  if (props.status === 'outcome-unknown') return { kind: 'unknown' }
  if (props.status === 'session-error') return { kind: 'session' }
  return null
})

const formEl = ref<HTMLFormElement | null>(null)
const feedbackEl = ref<HTMLDivElement | null>(null)

/** Общий результат относится ко всей форме: фокус — на блок сообщения, после обновления DOM. */
watch(
  () => feedback.value?.kind,
  async (kind) => {
    if (!kind) return
    await nextTick()
    feedbackEl.value?.focus()
  },
)

const onValid = handleSubmit(
  (submitted) => {
    emit('submit', {
      displayName: submitted.displayName,
      email: submitted.email,
      password: submitted.password,
    })
  },
  () => focusFirstProblem(formEl.value),
)

async function onSubmit(event: Event): Promise<void> {
  if (fieldsDisabled.value || waiting.value) return
  await onValid(event)
}

onMounted(() => {
  if (props.autofocus && !props.loading && !closed.value) {
    formEl.value?.querySelector<HTMLInputElement>('input[name="name"]')?.focus()
  }
})

/** Отключённое поле закрытой формы (UI Kit `State=Disabled`, 665:3946). */
const closedField = 'disabled:bg-canvas! disabled:opacity-50! placeholder:text-secondary'
</script>

<template>
  <form v-if="loading" class="flex flex-col gap-4" role="status" aria-label="Загрузка">
    <div class="flex flex-col gap-2">
      <p class="text-base leading-5 font-medium text-ink">Имя</p>
      <div class="h-input rounded bg-line motion-safe:animate-pulse" />
    </div>
    <div class="flex flex-col gap-2">
      <p class="text-base leading-5 font-medium text-ink">Электронная почта</p>
      <div class="h-input rounded bg-line motion-safe:animate-pulse" />
    </div>
    <div class="flex flex-col gap-2">
      <p class="text-base leading-5 font-medium text-ink">Пароль</p>
      <div class="h-input rounded bg-line motion-safe:animate-pulse" />
      <p class="text-xs text-secondary">Не меньше {{ PASSWORD_MIN_LENGTH }} символов.</p>
    </div>
    <div
      class="flex h-input items-center justify-center rounded-button bg-line text-field leading-5 font-medium text-muted"
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
  <div v-else class="flex flex-col gap-6">
    <div
      v-if="feedback"
      ref="feedbackEl"
      tabindex="-1"
      class="rounded-field outline-none focus-visible:ring-2 focus-visible:ring-brand"
      data-testid="register-feedback"
    >
      <UiAlert v-if="feedback.kind === 'rejected'" tone="danger" :title="feedback.title">
        {{ feedback.text }}
      </UiAlert>
      <UiAlert
        v-else-if="feedback.kind === 'failed'"
        :tone="feedback.tone"
        :title="feedback.title"
        :trace-id="feedback.traceId"
      >
        {{ feedback.text }}
      </UiAlert>
      <UiAlert v-else-if="feedback.kind === 'unknown'" tone="warning">
        <p>Не удалось получить результат регистрации. Попробуйте войти или восстановить пароль.</p>
        <p class="mt-2 flex flex-wrap gap-x-6 gap-y-1">
          <RouterLink :to="{ name: 'login' }" class="font-medium text-link hover:underline"
            >Войти</RouterLink
          >
          <RouterLink
            :to="{ name: 'forgot-password' }"
            class="font-medium text-link hover:underline"
            >Восстановить пароль</RouterLink
          >
        </p>
      </UiAlert>
      <UiAlert v-else tone="warning" title="Аккаунт создан">
        <p>Не удалось загрузить сессию. Повторите загрузку — регистрироваться заново не нужно.</p>
        <UiButton class="mt-3" variant="secondary" size="sm" @click="emit('retry-session')"
          >Повторить загрузку</UiButton
        >
      </UiAlert>
    </div>

    <form ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
      <UiField v-slot="{ id, describedBy, invalid }" label="Имя" :error="errors.displayName">
        <UiInput
          :id="id"
          v-model="displayName"
          name="name"
          autocomplete="name"
          placeholder="Введите имя"
          :described-by="describedBy"
          :invalid="invalid"
          :maxlength="200"
          :disabled="fieldsDisabled"
          :class="closed ? closedField : ''"
        />
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Электронная почта"
        :error="errors.email"
      >
        <UiInput
          :id="id"
          v-model="email"
          type="email"
          name="email"
          autocomplete="username"
          inputmode="email"
          placeholder="name@example.com"
          :described-by="describedBy"
          :invalid="invalid"
          :maxlength="254"
          :disabled="fieldsDisabled"
          :class="closed ? closedField : ''"
        />
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Пароль"
        error-replaces-description
        :description="`Не меньше ${PASSWORD_MIN_LENGTH} символов.`"
        :error="errors.password"
      >
        <div :class="closed ? '[&_button]:opacity-50' : ''">
          <UiPasswordInput
            :id="id"
            v-model="password"
            name="new-password"
            autocomplete="new-password"
            placeholder="Придумайте пароль"
            :described-by="describedBy"
            :invalid="invalid"
            :disabled="fieldsDisabled"
            :class="closed ? closedField : ''"
          />
        </div>
      </UiField>

      <p v-if="waiting" class="sr-only" role="status">
        Регистрация временно недоступна. Повторите попытку через {{ announcedSeconds }} секунд.
      </p>

      <UiButton
        type="submit"
        block
        :loading="busy"
        :disabled="closed || locked || waiting"
        :class="closed ? 'disabled:bg-line disabled:text-muted disabled:opacity-100' : ''"
      >
        <!-- Figma «Отправка»: «Создаём аккаунт…», доступное имя остаётся «Создать аккаунт». -->
        <template v-if="busy">
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
  </div>
</template>
