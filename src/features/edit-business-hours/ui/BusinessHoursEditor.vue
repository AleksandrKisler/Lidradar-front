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
import { UiAlert, UiButton } from '@/shared/ui'
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

const dirty = computed(() => !sameWeek(days.value, confirmed.value))
watch(dirty, (value) => emit('update:dirty', value), { immediate: true })

// Фоновое чтение не стирает редактируемую неделю. Новый tenant/ID — отдельная форма.
let generation = 0
let mounted = true
const submitting = ref(false)
watch(submitting, (busy) => emit('busy', busy), { flush: 'sync' })
function resetDraft(): void {
  confirmed.value = baseline(props.location)
  days.value = baseline(props.location)
  errors.value = {}
  saved.value = false
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
    if (!dirty.value && !submitting.value) resetDraft()
  },
)
onBeforeUnmount(() => {
  mounted = false
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
    await mutation.mutateAsync(command).catch(() => null)
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
    'h-[46px] min-w-0 flex-1 rounded-field border border-line bg-paper px-3 text-center text-field text-ink md:flex-none lg:h-[34px] aria-invalid:border-danger disabled:text-muted [&::-webkit-calendar-picker-indicator]:hidden ' +
    (settings.value ? 'md:w-32 lg:w-24 lg:px-3.5 lg:text-left' : 'md:w-24 lg:w-20'),
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
function clearError(weekday: number): void {
  saved.value = false
  if (settings.value) delete errors.value[weekday]
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
    :class="['@container flex flex-col', settings ? 'settings-hours' : '']"
    novalidate
    @submit.prevent="submit"
  >
    <p
      v-if="settings && intro"
      class="text-sm leading-5 text-secondary max-lg:text-base max-lg:leading-6 lg:whitespace-pre-line"
    >
      {{ intro }}
    </p>
    <p v-if="settings && intro" class="mt-3 text-xs leading-[18px] text-secondary md:hidden">
      Источник — первый рабочий день.
    </p>
    <p v-else-if="!settings" class="text-sm leading-5 text-secondary">
      Время указано для выбранной точки. Для копирования используется первый рабочий день.
    </p>
    <div
      v-if="settings || canApplyToAll"
      :class="[settings ? 'mt-5 lg:mt-4' : 'mt-4', !canApplyToAll ? 'hidden lg:block' : '']"
    >
      <!-- Обычная кнопка, а не UiButton: длинная подпись должна переноситься, а не раздвигать страницу. -->
      <button
        type="button"
        :class="[
          'block max-w-full text-left disabled:cursor-not-allowed disabled:opacity-60',
          settings
            ? 'h-[46px] px-3.5 text-field leading-5 text-secondary hover:text-ink'
            : 'text-sm leading-5 text-link hover:underline',
        ]"
        :disabled="submitting || !canApplyToAll"
        @click="applyToAll"
      >
        <template v-if="settings">
          <span class="md:hidden">Применить ко всем рабочим дням</span>
          <span class="hidden md:inline">Скопировать часы первого рабочего дня</span>
        </template>
        <template v-else>Применить ко всем рабочим дням</template>
      </button>
    </div>
    <ul :class="[settings ? 'mt-5 lg:mt-4' : 'mt-5', 'flex flex-col']" aria-label="Дни недели">
      <li
        v-for="day in days"
        :key="day.weekday"
        :class="[
          'border-t border-hairline',
          submitting && settings ? 'lg:opacity-60' : '',
          settings
            ? 'py-5 md:max-lg:py-[12.5px] lg:py-[9.5px]'
            : 'py-3 md:max-lg:py-[8.5px] lg:py-[5.5px]',
        ]"
      >
        <div
          class="day-row flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between md:gap-4"
        >
          <label
            :class="[
              'flex items-center pl-4 leading-6 text-ink md:flex-1',
              settings
                ? 'gap-3.5 text-note font-semibold lg:text-base lg:leading-[22px]'
                : 'gap-3 text-field md:pl-0',
            ]"
          >
            <input
              type="checkbox"
              :name="`day-${day.weekday}`"
              class="size-4 accent-brand"
              :checked="!day.closed"
              :disabled="submitting && !settings"
              :aria-disabled="submitting || undefined"
              :class="submitting ? 'opacity-60' : ''"
              @click="submitting && $event.preventDefault()"
              @change="toggle(day, ($event.target as HTMLInputElement).checked)"
            />
            {{ labelOf(day.weekday) }}
          </label>
          <div
            v-if="!day.closed"
            :class="['time-controls flex items-center gap-3 md:gap-4', settings ? 'lg:gap-3' : '']"
          >
            <label
              class="time-group flex min-w-0 flex-1 items-center gap-3 text-sm text-secondary md:flex-none"
            >
              <span aria-hidden="true">с</span>
              <span class="sr-only">{{ labelOf(day.weekday) }}, открытие</span>
              <input
                v-model="day.opensAt"
                type="time"
                :name="`opens-${day.weekday}`"
                :class="timeClass"
                :aria-invalid="opensInvalid(day.weekday) ? true : undefined"
                :aria-describedby="errors[day.weekday] ? `day-error-${day.weekday}` : undefined"
                :disabled="submitting"
                @input="clearError(day.weekday)"
              />
            </label>
            <label
              class="time-group flex min-w-0 flex-1 items-center gap-3 text-sm text-secondary md:flex-none"
            >
              <span aria-hidden="true">до</span>
              <span class="sr-only">{{ labelOf(day.weekday) }}, закрытие</span>
              <input
                v-model="day.closesAt"
                type="time"
                :name="`closes-${day.weekday}`"
                :class="timeClass"
                :aria-invalid="errors[day.weekday] ? true : undefined"
                :aria-describedby="errors[day.weekday] ? `day-error-${day.weekday}` : undefined"
                :disabled="submitting"
                @input="clearError(day.weekday)"
              />
            </label>
          </div>
          <span
            v-else
            class="text-sm leading-5 text-secondary md:flex md:min-h-[46px] md:items-center lg:min-h-[34px]"
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

    <UiAlert v-if="saved" class="mt-4" tone="success">График сохранён.</UiAlert>
    <UiAlert
      v-if="errorView"
      class="mt-4"
      tone="danger"
      :title="errorView.title"
      :trace-id="traceId"
    >
      {{ errorView.description }}
    </UiAlert>

    <div
      v-if="!hideSubmit"
      :class="[
        'mt-4 flex flex-wrap items-center justify-between gap-4',
        settings ? 'lg:flex-col lg:items-stretch lg:gap-0' : '',
      ]"
    >
      <p class="text-xs text-muted">
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
            ? settingsErrors
              ? 'w-full disabled:border disabled:border-hairline disabled:bg-paper disabled:text-[#c4c4c8] disabled:opacity-100 md:w-[203px] lg:ml-auto lg:w-[220px]'
              : 'w-full md:w-[203px] lg:ml-auto lg:w-[220px]'
            : ''
        "
        :disabled="
          (!dirty && Boolean(location.businessHours.length || saved)) ||
          (settings && Object.keys(errors).length > 0)
        "
        :loading="submitting"
      >
        {{ settings && submitting ? 'Сохраняем…' : (submitLabel ?? 'Сохранить график') }}
      </UiButton>
    </div>
  </form>
</template>

<style scoped>
/* Между desktop-колонками строка складывается по доступной ширине самого графика. */
@container (max-width: 599px) {
  .settings-hours .day-row {
    flex-direction: column;
    align-items: stretch;
  }
  .settings-hours .time-controls {
    width: 100%;
  }
  .settings-hours .time-group {
    flex: 1;
    min-width: 0;
  }
  .settings-hours .time-group input {
    width: 0;
    flex: 1;
    min-width: 0;
  }
}
</style>
