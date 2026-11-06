<script setup lang="ts">
/**
 * Шаг B2 «Регистрация по приглашению» (Figma 777:6397, 795:6740, 795:6848; UI Kit 793:3938/3999).
 * Одно поле кода со встроенным действием «Проверить код»: поле 46 px с одной рамкой 1 px, область
 * нажатия 44×44, видимая кнопка 36×36, стрелка, «!» или индикатор 20×20 по центру. Отдельной кнопки
 * под полем нет.
 *
 * Компонент только показывает состояние и передаёт ввод: когда и что проверять, решает модель
 * страницы (`useRegistrationFlow`). Во время проверки поле и действие недоступны, но остаются в
 * порядке фокуса (`readonly`/`aria-disabled`), поэтому фокус не теряется и результат объявляется
 * там же, где находится пользователь.
 */
import { computed, onMounted, ref, useId, watch } from 'vue'
import { UiIcon, UiInput, UiSpinner } from '@/shared/ui'
import { INVITATION_CODE_MESSAGES } from '../model/schemas'
import type { InvitationCodeStatus } from '../model/use-registration-flow'

const props = withDefaults(
  defineProps<{
    value?: string
    status?: InvitationCodeStatus
    /** Секунды до повторной проверки после `429`. */
    retrySeconds?: number
    /** Плейсхолдер начальной загрузки (Figma 811:7551): без поля ввода и действий. */
    loading?: boolean
    /** Шаг открыт переходом внутри страницы: фокус переходит в поле кода. */
    autofocus?: boolean
  }>(),
  { value: '', status: 'idle', retrySeconds: 0, loading: false, autofocus: false },
)

const emit = defineEmits<{
  /** Новое значение поля; `composing` — идёт набор через IME. */
  'code-input': [value: string, composing: boolean]
  /** Enter или встроенная стрелка. */
  check: []
}>()

const id = useId()
const messageId = `${id}-message`
const fieldEl = ref<HTMLDivElement | null>(null)
let composing = false

const checking = computed(() => props.status === 'checking')
const rejected = computed(() => props.status === 'invalid')
const invalid = computed(() => ['empty', 'format', 'invalid'].includes(props.status))
const waiting = computed(() => props.status === 'rate-limited' && props.retrySeconds > 0)

const message = computed<{ lines: string[]; tone: 'hint' | 'format' | 'danger' }>(() => {
  switch (props.status) {
    case 'checking':
      return { lines: ['Проверяем код приглашения…', 'Это займёт несколько секунд.'], tone: 'hint' }
    case 'empty':
      return { lines: [INVITATION_CODE_MESSAGES.empty], tone: 'format' }
    case 'format':
      return { lines: [INVITATION_CODE_MESSAGES.format], tone: 'format' }
    case 'invalid':
      return { lines: ['Код приглашения не подошёл'], tone: 'danger' }
    case 'service':
      return { lines: ['Не удалось проверить код. Попробуйте ещё раз.'], tone: 'hint' }
    case 'rate-limited':
      if (waiting.value) {
        return {
          lines: [`Слишком много проверок. Повторите через ${props.retrySeconds} с.`],
          tone: 'hint',
        }
      }
      break
  }
  return {
    lines: [
      '43 символа. Скопируйте и вставьте код целиком.',
      'Код проверится автоматически после ввода.',
    ],
    tone: 'hint',
  }
})

const messageTone = {
  hint: 'text-secondary',
  format: 'text-danger-ink',
  danger: 'text-danger',
} as const

/**
 * Объявление для скринридера — один раз при смене состояния; обратный отсчёт не озвучивается
 * каждую секунду. Видимый текст связан с полем через `aria-describedby`.
 */
const announcement = ref('')
watch(
  () => props.status,
  (status) => {
    announcement.value = status === 'idle' ? '' : message.value.lines.join(' ')
  },
)

function onInput(event: Event): void {
  const target = event.target as HTMLInputElement
  emit('code-input', target.value, composing || (event as InputEvent).isComposing === true)
}

function onCompositionStart(): void {
  composing = true
}

function onCompositionEnd(event: CompositionEvent): void {
  composing = false
  emit('code-input', (event.target as HTMLInputElement).value, false)
}

function onSubmit(): void {
  if (checking.value || waiting.value) return
  emit('check')
}

onMounted(() => {
  if (props.autofocus && !props.loading) fieldEl.value?.querySelector('input')?.focus()
})
</script>

<template>
  <div v-if="loading" class="flex flex-col gap-2" role="status" aria-label="Загрузка">
    <p class="text-base leading-5 font-medium text-ink">Код приглашения</p>
    <div class="relative h-input rounded-field border border-line bg-canvas">
      <span class="absolute top-px right-px flex size-11 items-center justify-center">
        <span class="flex size-9 items-center justify-center rounded-lg bg-line text-muted">
          <UiIcon name="arrow-forward" class="size-5" />
        </span>
      </span>
    </div>
    <p class="text-xs leading-[18px] text-secondary">Загружаем форму…</p>
  </div>
  <form v-else class="flex flex-col gap-2" novalidate @submit.prevent="onSubmit">
    <label :for="id" class="text-base leading-5 font-medium text-ink">Код приглашения</label>
    <div ref="fieldEl" class="relative">
      <UiInput
        :id="id"
        :model-value="value"
        name="invite-code"
        autocomplete="off"
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
        enterkeyhint="go"
        placeholder="Вставьте код приглашения"
        :maxlength="128"
        :invalid="invalid"
        :described-by="messageId"
        :readonly="checking"
        :aria-disabled="checking || undefined"
        :aria-busy="checking || undefined"
        :class="['pr-16', checking ? 'bg-canvas! text-secondary! opacity-50' : '']"
        @input="onInput"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
      />
      <button
        type="submit"
        tabindex="0"
        class="absolute top-px right-px flex size-11 items-center justify-center rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
        aria-label="Проверить код"
        :aria-describedby="messageId"
        :aria-busy="checking || undefined"
        :aria-disabled="checking || waiting || undefined"
        data-testid="invitation-check"
      >
        <span
          :class="[
            'flex size-9 items-center justify-center rounded-lg',
            waiting
              ? 'bg-line text-muted'
              : rejected
                ? 'bg-danger text-white'
                : 'bg-brand text-white',
          ]"
          data-testid="invitation-check-face"
        >
          <!-- Неподвижная рамка 20×20: индикатор вращается внутри, размер и центр не меняются. -->
          <span class="flex size-5 items-center justify-center" data-testid="invitation-check-icon">
            <UiSpinner v-if="checking" class="size-5" data-testid="invitation-check-spinner" />
            <UiIcon v-else :name="rejected ? 'priority-high' : 'arrow-forward'" class="size-5" />
          </span>
        </span>
      </button>
    </div>
    <div
      :id="messageId"
      :class="['text-xs leading-[18px]', messageTone[message.tone]]"
      data-testid="invitation-code-message"
    >
      <p v-for="line in message.lines" :key="line">{{ line }}</p>
    </div>
    <p class="sr-only" role="status">{{ announcement }}</p>
  </form>
</template>
