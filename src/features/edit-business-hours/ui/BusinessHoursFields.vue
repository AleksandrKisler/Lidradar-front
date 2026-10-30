<script setup lang="ts">
/**
 * Управляемое представление недели (Figma «Точки и графики», строка «HIG / Onboarding / Schedule
 * row»): семь дней, флажок рабочего дня, поля «с»/«до» и «Применить ко всем рабочим дням».
 * Данные и ошибки приходят сверху и уходят событием `update:days` — компонент ничего не хранит
 * и не сохраняет, поэтому смена выбранной точки или ответ сервера не стирают чужой черновик.
 * Настройки используют `BusinessHoursEditor` со своим сохранением и защитой ухода.
 * Строка дня встаёт в ряд, только когда её ширины хватает (container query): на 768 px правая
 * колонка уже, чем строка десктопа, и день переносится как на телефоне.
 * Недоступные поля не сереют по отдельности (Figma 10/12): флажки остаются синими, значения тёмными,
 * а приглушает их карточка страницы; каркас без точки приглушает саму неделю.
 */
import { computed } from 'vue'
import { UiIcon } from '@/shared/ui'
import { WEEKDAYS, weekIssues, type DayDraft } from '@/entities/location'

const props = defineProps<{
  days: readonly DayDraft[]
  errors: Readonly<Record<number, string>>
  /** Поля недоступны: точки нет, идёт загрузка или команда. */
  disabled?: boolean | undefined
  /** Каркас без значений (нет точек, загрузка): поля пустые и недоступны. */
  placeholder?: boolean | undefined
  /** Каркас загрузки: поля без маски «--:--», значения ещё неизвестны. */
  blank?: boolean | undefined
  /** Префикс ID сообщений ошибок: у каждой точки свои. */
  idPrefix: string
}>()
const emit = defineEmits<{ 'update:days': [days: DayDraft[]] }>()

const labelOf = (weekday: number) => WEEKDAYS.find((day) => day.weekday === weekday)?.label ?? ''
const errorId = (weekday: number) => `${props.idPrefix}-day-error-${weekday}`

function change(weekday: number, patch: Partial<DayDraft>): void {
  emit(
    'update:days',
    props.days.map((day) => (day.weekday === weekday ? { ...day, ...patch } : { ...day })),
  )
}

function toggle(day: DayDraft, open: boolean): void {
  // Включённый день без времени получает часы стартовой недели мастера.
  change(
    day.weekday,
    open && !day.opensAt && !day.closesAt
      ? { closed: false, opensAt: '10:00', closesAt: '19:00' }
      : { closed: !open },
  )
}

/** Образец копирования — первый рабочий день выбранной точки; нужен корректный интервал. */
const sample = computed(() => props.days.find((day) => !day.closed) ?? null)
const canApplyToAll = computed(() => {
  const first = sample.value
  return first !== null && weekIssues([first])?.[first.weekday] === undefined
})

function applyToAll(): void {
  const first = sample.value
  if (!first || !canApplyToAll.value) return
  emit(
    'update:days',
    props.days.map((day) =>
      day.closed ? { ...day } : { ...day, opensAt: first.opensAt, closesAt: first.closesAt },
    ),
  )
}

const timeClass =
  'h-[46px] min-w-0 flex-1 rounded-button border border-[#d2d2d7] bg-paper px-3 text-center text-field text-ink md:w-24 md:flex-none lg:h-[34px] lg:text-left aria-invalid:border-danger-ink disabled:bg-paper disabled:text-ink disabled:opacity-100 [&::-webkit-calendar-picker-indicator]:hidden'
</script>

<template>
  <div class="@container flex flex-col">
    <div class="pb-3">
      <button
        type="button"
        class="flex h-[46px] max-w-full items-center text-left text-sm leading-5 text-link enabled:hover:underline disabled:cursor-not-allowed"
        :class="placeholder || !canApplyToAll ? 'opacity-45' : ''"
        :disabled="disabled || placeholder || !canApplyToAll"
        @click="applyToAll"
      >
        Применить ко всем рабочим дням
      </button>
    </div>
    <ul :class="['flex flex-col', placeholder ? 'opacity-[0.38]' : '']" aria-label="Дни недели">
      <li
        v-for="day in days"
        :key="day.weekday"
        class="border-t border-hairline py-1 md:py-[8.5px] lg:py-[5.5px]"
        :data-weekday="day.weekday"
      >
        <div
          class="flex flex-col gap-1 @min-[400px]:flex-row @min-[400px]:items-center @min-[400px]:justify-between @min-[400px]:gap-4"
        >
          <label
            class="flex h-[46px] items-center text-base leading-6 font-medium text-ink md:h-auto md:min-h-[46px] md:gap-3 lg:min-h-[34px]"
          >
            <span
              class="relative flex size-[46px] shrink-0 items-center pr-3.5 pl-4 md:size-auto md:p-0"
            >
              <!-- Свой флажок: системный в недоступном состоянии серый, в Figma он остаётся синим. -->
              <input
                type="checkbox"
                :name="`day-${day.weekday}`"
                class="peer size-4 appearance-none rounded-[4px] border border-[#d2d2d7] bg-paper checked:border-brand checked:bg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                :checked="!day.closed"
                :disabled="disabled || placeholder"
                @change="toggle(day, ($event.target as HTMLInputElement).checked)"
              />
              <UiIcon
                name="check"
                class="pointer-events-none absolute top-1/2 left-4 hidden size-4 -translate-y-1/2 p-px text-white peer-checked:block md:left-0"
              />
            </span>
            {{ labelOf(day.weekday) }}
          </label>
          <div
            v-if="!day.closed"
            class="flex h-[46px] items-center gap-3 md:h-auto md:gap-4 lg:gap-5"
          >
            <label
              class="flex min-w-0 flex-1 items-center gap-2 text-sm leading-5 text-secondary md:flex-none md:gap-2 lg:gap-2.5"
            >
              <span aria-hidden="true" class="w-2">с</span>
              <span class="sr-only">{{ labelOf(day.weekday) }}, начало</span>
              <input
                :value="placeholder ? '' : day.opensAt"
                :type="blank ? 'text' : 'time'"
                :name="`opens-${day.weekday}`"
                :class="timeClass"
                :aria-invalid="errors[day.weekday] ? true : undefined"
                :aria-describedby="errors[day.weekday] ? errorId(day.weekday) : undefined"
                :disabled="disabled || placeholder"
                @input="change(day.weekday, { opensAt: ($event.target as HTMLInputElement).value })"
              />
            </label>
            <label
              class="flex min-w-0 flex-1 items-center gap-2 text-sm leading-5 text-secondary md:flex-none md:gap-2 lg:gap-2.5"
            >
              <span aria-hidden="true" class="w-[18px]">до</span>
              <span class="sr-only">{{ labelOf(day.weekday) }}, окончание</span>
              <input
                :value="placeholder ? '' : day.closesAt"
                :type="blank ? 'text' : 'time'"
                :name="`closes-${day.weekday}`"
                :class="timeClass"
                :aria-invalid="errors[day.weekday] ? true : undefined"
                :aria-describedby="errors[day.weekday] ? errorId(day.weekday) : undefined"
                :disabled="disabled || placeholder"
                @input="
                  change(day.weekday, { closesAt: ($event.target as HTMLInputElement).value })
                "
              />
            </label>
          </div>
          <span
            v-else
            class="pb-2 pl-4 text-note text-secondary md:flex md:min-h-[46px] md:items-center md:p-0 lg:min-h-[34px]"
            >Выходной</span
          >
        </div>
        <p
          v-if="errors[day.weekday]"
          :id="errorId(day.weekday)"
          class="mt-1 mb-1 text-sm leading-5 font-medium text-danger-ink md:mt-0.5 md:mb-0"
        >
          {{ errors[day.weekday] }}
        </p>
      </li>
    </ul>
  </div>
</template>
