<script setup lang="ts">
/**
 * Окно подтверждения паролем (ADR 0059): выгрузка личных данных и закрытие аккаунта выдают данные или
 * необратимы, поэтому требуют текущий пароль. Окно само не знает действия: оно получает `action`, показывает
 * ошибку и закрывается только после успеха.
 *
 * Неверный пароль сервер отвечает `403 INVALID_CURRENT_PASSWORD`, а не `401`, поэтому опечатка не разлогинивает:
 * ошибка выводится у поля. Попытки ограничены общим счётчиком подбора пароля (5 за 15 минут): после предела
 * кнопка закрыта до конца отсчёта. Остальные ошибки показываются блоком по коду; вызывающий может подменить
 * его для своих ошибок (`explain`), например списком причин блокировки закрытия.
 */
import { computed, ref, useId, watch } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { formatWait, useRetryAfter } from '@/shared/lib'
import { UiAlert, UiButton, UiDialog, UiField, UiPasswordInput } from '@/shared/ui'
import type { FailureView } from '../model/failure-view'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    confirmLabel: string
    /** `danger` — необратимое действие (красная кнопка). */
    tone?: 'primary' | 'danger'
    /** Ключ хранилища сессии для отсчёта после `429`: у каждого действия свой. */
    retryKey: string
    /** Действие под подтверждением: бросает ошибку — окно остаётся открытым. */
    action: (password: string) => Promise<void>
    /** Своё объяснение ошибки; `null` — показать обычное по коду. */
    explain?: (error: unknown) => FailureView | null
  }>(),
  { description: '', tone: 'primary', explain: () => null },
)

const emit = defineEmits<{ done: [] }>()
const open = defineModel<boolean>('open', { default: false })

defineSlots<{
  /** Блок над полем пароля: что именно произойдёт. */
  default?: () => unknown
}>()

const formId = useId()
const retry = useRetryAfter(props.retryKey)
const password = ref('')
const fieldError = ref('')
const failure = ref<unknown>(null)
const submitting = ref(false)

watch(open, (value) => {
  if (value) return
  // Пароль не живёт в памяти закрытого окна.
  password.value = ''
  fieldError.value = ''
  failure.value = null
})

const failureView = computed<FailureView | null>(() => {
  const error = failure.value
  if (error === null) return null
  const custom = props.explain(error)
  if (custom) return custom
  if (isApiError(error) && error.isRateLimited) {
    return {
      tone: 'warning',
      title: 'Слишком много попыток',
      text: `Проверьте пароль и повторите через ${formatWait(retry.secondsLeft.value)}.`,
    }
  }
  const described = describeError(error)
  return { tone: 'danger', title: described.title, text: described.description }
})

async function submit(): Promise<void> {
  if (submitting.value || retry.active.value) return
  fieldError.value = ''
  failure.value = null
  if (password.value === '') {
    fieldError.value = 'Введите текущий пароль'
    return
  }
  submitting.value = true
  try {
    await props.action(password.value)
    open.value = false
    emit('done')
  } catch (error) {
    if (isApiError(error) && error.code === 'INVALID_CURRENT_PASSWORD') {
      fieldError.value = 'Пароль не подошёл'
    } else {
      failure.value = error
      if (isApiError(error) && error.isRateLimited) retry.start(error.retryAfterSeconds ?? 60)
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    :title="title"
    :description="description"
    :dismissible="!submitting"
    initial-focus="input[name='confirm-password']"
  >
    <form :id="formId" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <slot />
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Текущий пароль"
        :error="fieldError || undefined"
      >
        <UiPasswordInput
          :id="id"
          v-model="password"
          name="confirm-password"
          autocomplete="current-password"
          :described-by="describedBy"
          :invalid="invalid"
        />
      </UiField>
      <UiAlert
        v-if="failureView"
        :tone="failureView.tone"
        :title="failureView.title"
        :trace-id="isApiError(failure) ? failure.traceId : ''"
        data-testid="confirm-failure"
      >
        {{ failureView.text }}
        <ul v-if="failureView.lines?.length" class="mt-2 list-disc pl-5">
          <li v-for="line in failureView.lines" :key="line">{{ line }}</li>
        </ul>
      </UiAlert>
    </form>
    <template #footer>
      <UiButton variant="secondary" :disabled="submitting" @click="open = false">Отмена</UiButton>
      <UiButton
        type="submit"
        :form="formId"
        :variant="tone === 'danger' ? 'danger' : 'primary'"
        :loading="submitting"
        :disabled="retry.active.value"
      >
        {{
          retry.active.value
            ? `Повторить через ${formatWait(retry.secondsLeft.value)}`
            : confirmLabel
        }}
      </UiButton>
    </template>
  </UiDialog>
</template>
