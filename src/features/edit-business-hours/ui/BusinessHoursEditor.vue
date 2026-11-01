<script setup lang="ts">
/**
 * Редактор недельного графика точки. Локально проверяется полнота и порядок
 * границ, затем неделя отправляется одним атомарным PUT. Черновик
 * сбрасывается при смене точки; признак несохранённых изменений отдаётся
 * наверх для защиты ухода со страницы.
 *
 * У полей времени видимые подписи «с» и «до». Если рабочие дни отличаются,
 * кнопка копирует время первого рабочего дня на остальные. В мастере начала
 * работы собственная кнопка не нужна (`hideSubmit`): кнопка шага вызывает
 * `save()` и идёт дальше, только если неделя сохранена.
 */
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { describeError, isApiError } from '@/shared/api'
import { readTimeInput, UiAlert, UiButton, UiGlyph } from '@/shared/ui'
import {
  WEEKDAYS,
  defaultWeek,
  locationKeys,
  replaceBusinessHours,
  sameWeek,
  toBusinessHoursRequest,
  validateWeek,
  weekFromHours,
  type DayDraft,
  type BusinessHoursRequest,
  type Location,
} from '@/entities/location'
import { organizationKeys } from '@/entities/organization'

const props = defineProps<{
  tenantId: string
  location: Location
  submitLabel?: string | undefined
  /** Убрать собственную кнопку: сохранением управляет внешняя кнопка через `save()`. */
  hideSubmit?: boolean | undefined
  /** `settings` — вид «Настройки → Компания и график»: пояснение и подписи из макета настроек. */
  appearance?: 'wizard' | 'settings' | undefined
  /** Пояснение над рядами в виде `settings`; без него абзаца нет. */
  intro?: string | undefined
}>()
const settings = computed(() => props.appearance === 'settings')
const emit = defineEmits<{
  saved: [location: Location]
  'update:dirty': [dirty: boolean]
  busy: [busy: boolean]
  status: [value: 'saving' | 'saved' | 'error' | 'dirty' | 'idle']
}>()

const queryClient = useQueryClient()
const formEl = useTemplateRef<HTMLFormElement>('formEl')

function baseline(location: Location): DayDraft[] {
  return weekFromHours(location.businessHours) ?? defaultWeek()
}

const confirmed = ref<DayDraft[]>(baseline(props.location))
const days = ref<DayDraft[]>(baseline(props.location))
const errors = ref<Record<number, string>>({})
const saved = ref(false)
const feedback = ref<'saved' | 'error' | null>(null)
let feedbackTimer: ReturnType<typeof setTimeout> | undefined
function clearFeedback(): void {
  clearTimeout(feedbackTimer)
  feedback.value = null
}
function showFeedback(value: 'saved' | 'error'): void {
  if (!settings.value) return
  clearFeedback()
  feedback.value = value
  feedbackTimer = setTimeout(() => {
    feedback.value = null
  }, 2000)
}

const dirty = computed(() => !sameWeek(days.value, confirmed.value))
watch(dirty, (value) => emit('update:dirty', value), { immediate: true })

// Фоновое чтение не стирает редактируемую неделю. Новый tenant/ID — отдельная форма.
let generation = 0
let mounted = true
const submitting = ref(false)
watch(submitting, (busy) => emit('busy', busy), { flush: 'sync' })
const status = computed(() =>
  submitting.value
    ? 'saving'
    : (feedback.value ??
      (dirty.value || (!props.location.businessHours.length && !saved.value) ? 'dirty' : 'idle')),
)
watch(status, (value) => emit('status', value), { immediate: true })
watch(
  days,
  () => {
    if (dirty.value && feedback.value === 'saved') clearFeedback()
  },
  { deep: true },
)
function resetDraft(): void {
  confirmed.value = baseline(props.location)
  days.value = baseline(props.location)
  errors.value = {}
  saved.value = false
  clearFeedback()
}
watch(
  () => `${props.tenantId}|${props.location.id}`,
  () => {
    generation += 1
    resetDraft()
    mutation.reset()
  },
)
watch(
  () => JSON.stringify(props.location.businessHours),
  () => {
    if (
      !dirty.value &&
      !submitting.value &&
      JSON.stringify(toBusinessHoursRequest(props.location.timezone, confirmed.value)) !==
        JSON.stringify(toBusinessHoursRequest(props.location.timezone, baseline(props.location)))
    )
      resetDraft()
  },
)
onBeforeUnmount(() => {
  mounted = false
  clearFeedback()
  generation += 1
  emit('update:dirty', false)
  emit('busy', false)
})
type Command = {
  tenantId: string
  locationId: string
  body: BusinessHoursRequest
  generation: number
  days: DayDraft[]
}
const mutation = useMutation({
  mutationFn: (command: Command) =>
    replaceBusinessHours(command.tenantId, command.locationId, command.body),
  onSuccess: async (location, command) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: locationKeys.list(command.tenantId) }),
      queryClient.invalidateQueries({ queryKey: organizationKeys.onboarding(command.tenantId) }),
    ])
    if (!mounted || generation !== command.generation) return
    confirmed.value = command.days.map((day) => ({ ...day }))
    saved.value = true
    showFeedback('saved')
    emit('saved', location)
  },
})

const errorView = computed(() =>
  mutation.error.value ? describeError(mutation.error.value) : null,
)
const traceId = computed(() =>
  isApiError(mutation.error.value) ? mutation.error.value.traceId : '',
)

function toggle(day: DayDraft, open: boolean): void {
  day.closed = !open
  if (settings.value) delete errors.value[day.weekday]
  if (open && !day.opensAt && !day.closesAt) {
    day.opensAt = '09:00'
    day.closesAt = '20:00'
  }
  saved.value = false
}

/** Рабочие дни и первый из них: его время служит образцом для остальных. */
const openDays = computed(() => days.value.filter((day) => !day.closed))
const sample = computed(() => openDays.value[0] ?? null)
/** Кнопка нужна, только если есть что выравнивать: два рабочих дня и разное время. */
const canApplyToAll = computed(() => {
  const first = sample.value
  return (
    first !== null &&
    Object.keys(validateWeek([first])).length === 0 &&
    openDays.value.length > 1 &&
    openDays.value.some((day) => day.opensAt !== first.opensAt || day.closesAt !== first.closesAt)
  )
})

function applyToAll(): void {
  const first = sample.value
  if (!first || !canApplyToAll.value || submitting.value) return
  for (const day of openDays.value) {
    day.opensAt = first.opensAt
    day.closesAt = first.closesAt
    if (settings.value) delete errors.value[day.weekday]
  }
  saved.value = false
}

async function submit(): Promise<void> {
  if (submitting.value) return
  saved.value = false
  clearFeedback()
  mutation.reset()
  errors.value = validateWeek(days.value)
  if (Object.keys(errors.value).length > 0) {
    // Кнопка шага вне формы: фокус переносится на первое поле времени с ошибкой.
    await nextTick()
    formEl.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }
  const command: Command = {
    tenantId: props.tenantId,
    locationId: props.location.id,
    body: toBusinessHoursRequest(props.location.timezone, days.value),
    generation,
    days: days.value.map((day) => ({ ...day })),
  }
  submitting.value = true
  try {
    await mutation.mutateAsync(command).catch(() => {
      if (mounted && generation === command.generation) showFeedback('error')
    })
  } finally {
    submitting.value = false
  }
}

/**
 * Сохранение по требованию родителя. Ничего не отправляет, если неделя уже
 * сохранена и не менялась. Возвращает `true`, только когда на сервере лежит
 * именно показанная неделя: ошибка проверки или ответа сервера даёт `false`,
 * и сообщение остаётся в редакторе.
 */
async function save(): Promise<boolean> {
  if (submitting.value) return false
  if (!dirty.value && props.location.businessHours.length > 0) return true
  await submit()
  return saved.value
}

defineExpose({ save })

/** Поле времени: на телефоне и планшете крупное, на десктопе компактное (Figma «Точка и график»). */
const timeClass = computed(
  () =>
    'h-[46px] min-w-0 flex-1 rounded-field border border-line bg-paper px-3 text-field text-ink md:flex-none lg:h-[34px] aria-invalid:border-danger ' +
    (settings.value
      ? 'px-3.5 text-left disabled:opacity-50 lg:disabled:bg-canvas md:w-24'
      : 'text-center disabled:text-muted md:w-24 lg:w-20'),
)

/** Ошибка порядка границ: в виде `settings` красным отмечено только поле закрытия (Figma «График · Ошибка времени»). */
const ORDER_ERROR = 'Время окончания должно быть позже начала.'
const opensInvalid = (weekday: number): boolean =>
  Boolean(errors.value[weekday]) && !(settings.value && errors.value[weekday] === ORDER_ERROR)
const errorText = (weekday: number): string => {
  const message = errors.value[weekday] ?? ''
  if (!settings.value) return message
  const day = labelOf(weekday)
  return message === ORDER_ERROR
    ? `${day}: окончание рабочего дня должно быть позже начала.`
    : `${day}: ${message.charAt(0).toLowerCase()}${message.slice(1)}`
}
/** Правка поля снимает ошибку дня: в виде `settings` кнопка «Сохранить график» ждёт исправления. */
function updateTime(day: DayDraft, field: 'opensAt' | 'closesAt', event: Event): void {
  day[field] = readTimeInput(event)
  saved.value = false
  if (settings.value) delete errors.value[day.weekday]
}

/** Кнопка неактивна из-за ошибки дня (а не из-за ожидания ответа): белая с рамкой, как в Figma. */
const settingsErrors = computed(
  () => settings.value && Object.keys(errors.value).length > 0 && !submitting.value,
)

const labelOf = (weekday: number) => WEEKDAYS.find((day) => day.weekday === weekday)?.label ?? ''
</script>

<template>
  <form
    ref="formEl"
    :class="['@container flex flex-col', settings ? 'lr-wh' : '']"
    novalidate
    @submit.prevent="submit"
  >
    <p v-if="settings && intro" class="text-sm leading-5 whitespace-pre-line text-muted">
      {{ intro }}
    </p>
    <p v-if="!settings" class="text-sm leading-5 text-secondary">
      Время указано для выбранной точки. Для копирования используется первый рабочий день.
    </p>
    <div v-if="settings || canApplyToAll" class="mt-4">
      <!-- Обычная кнопка, а не UiButton: длинная подпись должна переноситься, а не раздвигать страницу. -->
      <button
        type="button"
        :class="[
          'block max-w-full disabled:cursor-not-allowed',
          settings
            ? 'h-16 w-full px-3 disabled:opacity-50 text-center text-field leading-5 font-medium text-muted hover:text-ink md:h-[46px] md:w-auto md:text-left'
            : 'text-left text-sm leading-5 text-link hover:underline disabled:opacity-60',
        ]"
        :disabled="submitting || !canApplyToAll"
        @click="applyToAll"
      >
        <template v-if="settings">
          <span class="md:hidden">Скопировать часы<br />первого рабочего дня</span>
          <span class="hidden md:inline">Скопировать часы первого рабочего дня</span>
        </template>
        <template v-else>Применить ко всем рабочим дням</template>
      </button>
    </div>
    <ul :class="[settings ? 'mt-4' : 'mt-5', 'flex flex-col']" aria-label="Дни недели">
      <li
        v-for="day in days"
        :key="day.weekday"
        :class="[
          'border-t',
          settings ? 'border-line' : 'border-hairline',
          settings
            ? day.closed
              ? 'py-[9.5px]'
              : 'pt-2 pb-3 md:py-[9.5px]'
            : 'py-3 md:max-lg:py-[8.5px] lg:py-[5.5px]',
        ]"
      >
        <div
          :class="[
            'lr-dr flex md:flex-row md:items-center md:justify-between',
            settings
              ? day.closed
                ? 'flex-row items-center gap-1'
                : 'flex-col gap-1'
              : 'flex-col gap-2.5 md:gap-4',
          ]"
        >
          <label
            :class="[
              'flex items-center pl-4 text-ink md:flex-1',
              settings
                ? 'day-label min-h-[46px] gap-3.5 text-base leading-[22px] font-semibold lg:min-h-[34px]'
                : 'gap-3 text-field leading-6 md:pl-0',
            ]"
          >
            <input
              type="checkbox"
              :name="`day-${day.weekday}`"
              class="size-4 accent-brand"
              :checked="!day.closed"
              :disabled="submitting && !settings"
              :aria-disabled="submitting || undefined"
              :class="submitting ? (settings ? 'opacity-50' : 'opacity-60') : ''"
              @click="submitting && $event.preventDefault()"
              @change="toggle(day, ($event.target as HTMLInputElement).checked)"
            />
            {{ labelOf(day.weekday) }}
          </label>
          <div
            v-if="!day.closed"
            :class="['lr-tc flex items-center gap-3 md:gap-4', settings ? 'lg:gap-3' : '']"
          >
            <label
              class="lr-tg flex min-w-0 flex-1 items-center gap-3 text-sm md:flex-none"
              :class="settings ? 'text-muted' : 'text-secondary'"
            >
              <span aria-hidden="true">с</span>
              <span class="sr-only">{{ labelOf(day.weekday) }}, открытие</span>
              <input
                v-model="day.opensAt"
                type="text"
                size="5"
                inputmode="numeric"
                autocomplete="off"
                placeholder="ЧЧ:ММ"
                :name="`opens-${day.weekday}`"
                :class="timeClass"
                :aria-invalid="opensInvalid(day.weekday) ? true : undefined"
                :aria-describedby="errors[day.weekday] ? `day-error-${day.weekday}` : undefined"
                :disabled="submitting"
                @input="updateTime(day, 'opensAt', $event)"
              />
            </label>
            <label
              class="lr-tg flex min-w-0 flex-1 items-center gap-3 text-sm md:flex-none"
              :class="settings ? 'text-muted' : 'text-secondary'"
            >
              <span aria-hidden="true">до</span>
              <span class="sr-only">{{ labelOf(day.weekday) }}, закрытие</span>
              <input
                v-model="day.closesAt"
                type="text"
                size="5"
                inputmode="numeric"
                autocomplete="off"
                placeholder="ЧЧ:ММ"
                :name="`closes-${day.weekday}`"
                :class="timeClass"
                :aria-invalid="errors[day.weekday] ? true : undefined"
                :aria-describedby="errors[day.weekday] ? `day-error-${day.weekday}` : undefined"
                :disabled="submitting"
                @input="updateTime(day, 'closesAt', $event)"
              />
            </label>
          </div>
          <span
            v-else
            :class="[
              'text-sm leading-5 md:flex md:min-h-[46px] md:items-center lg:min-h-[34px]',
              settings ? 'lr-cl ml-auto text-muted' : 'text-secondary',
            ]"
            >Выходной</span
          >
        </div>
        <p
          v-if="errors[day.weekday]"
          :id="`day-error-${day.weekday}`"
          :class="[
            'mt-2 text-danger',
            settings ? 'text-xs leading-[18px]' : 'text-sm leading-5 lg:text-right',
          ]"
          role="alert"
        >
          {{ errorText(day.weekday) }}
        </p>
      </li>
    </ul>

    <p v-if="saved && settings" class="sr-only" role="status">График сохранён.</p>
    <UiAlert v-else-if="saved" class="mt-4" tone="success">График сохранён.</UiAlert>
    <UiAlert
      v-if="errorView"
      class="mt-4"
      tone="danger"
      :title="settings ? 'Не удалось сохранить график' : errorView.title"
      :trace-id="traceId"
    >
      {{
        settings ? 'Введённое время осталось в форме. Повторите сохранение.' : errorView.description
      }}
      <template v-if="settings" #icon><UiGlyph name="circle-alert" class="size-5" /></template>
    </UiAlert>

    <div
      v-if="!hideSubmit"
      :class="[
        'mt-4 flex flex-wrap items-center justify-between',
        settings ? 'hours-footer flex-col items-stretch gap-3 md:gap-0' : 'gap-4',
      ]"
    >
      <p class="text-xs leading-[18px] text-muted">
        {{
          settings
            ? 'Сохраняется вся неделя. Один интервал в день.'
            : 'Неделя сохраняется целиком, одним запросом.'
        }}
      </p>
      <UiButton
        type="submit"
        :class="
          settings
            ? [
                'w-full md:ml-auto md:w-[220px]',
                submitting
                  ? ''
                  : settingsErrors
                    ? 'disabled:border disabled:border-line disabled:bg-paper disabled:text-[#c4c4c8] disabled:opacity-100'
                    : 'disabled:bg-line disabled:text-muted disabled:opacity-100',
              ]
            : ''
        "
        :disabled="
          (!dirty && Boolean(location.businessHours.length || saved)) ||
          (settings && Object.keys(errors).length > 0)
        "
        :loading="submitting"
      >
        {{
          settings && submitting
            ? 'Сохраняем…'
            : settings && errorView
              ? 'Повторить сохранение'
              : (submitLabel ?? 'Сохранить график')
        }}
      </UiButton>
    </div>
  </form>
</template>

<style>
.lr-wh [type='checkbox']:not(:checked) {
  appearance: none;
  border: 1px solid #d2d2d7;
  border-radius: 4px;
}
/* Между desktop-колонками строка складывается по доступной ширине самого графика. */
@container (max-width: 599px) {
  .lr-wh .lr-dr:not(:has(.lr-cl)) {
    flex-direction: column;
    align-items: stretch;
  }
  .lr-wh .lr-tc {
    display: grid;
    grid-template-columns: 8px 1fr 18px 1fr;
    gap: 12px;
  }
  .lr-wh .lr-tg {
    display: contents;
  }
}
</style>
