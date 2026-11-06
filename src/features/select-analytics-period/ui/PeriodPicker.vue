<script setup lang="ts">
/** Applied dates belong to the URL; the modal owns an isolated draft. */
import { computed, ref, useId, watch } from 'vue'
import { formatCalendarDate, useMediaQuery } from '@/shared/lib'
import { UiButton, UiDialog, UiInput } from '@/shared/ui'
import { presetRange, rangeDays, sameRange, validateRange, type DateRange } from '@/entities/report'

const props = defineProps<{ range: DateRange; timeZone: string; error: string | null }>()
const emit = defineEmits<{ 'update:range': [range: DateRange] }>()
const presets = [7, 30, 90] as const
const open = ref(false)
const mobile = useMediaQuery('(max-width: 639px)')
const draft = ref<DateRange>({ ...props.range })
const attempted = ref(false)
const id = useId()
const draftError = computed(() => validateRange(draft.value))
const caption = computed(() => {
  if (props.error) return 'Выбрать период'
  const { from, to } = props.range
  const date = (value: string) => formatCalendarDate(value, { year: false }).replace(/ г\.$/, '')
  if (from === to) return `${date(to)} ${to.slice(0, 4)}`
  if (from.slice(0, 7) === to.slice(0, 7))
    return `${Number(from.slice(8))} — ${date(to)} ${to.slice(0, 4)}`
  if (from.slice(0, 4) === to.slice(0, 4)) return `${date(from)} — ${date(to)} ${to.slice(0, 4)}`
  return `${date(from)} ${from.slice(0, 4)} — ${date(to)} ${to.slice(0, 4)}`
})
const activePreset = computed(() =>
  presets.find((days) => sameRange(presetRange(days, props.timeZone), props.range)),
)
watch(open, (value) => {
  if (value) {
    draft.value = { ...props.range }
    attempted.value = false
  }
})
watch(
  () => props.timeZone,
  () => {
    open.value = false
  },
)
function apply(): void {
  attempted.value = true
  if (draftError.value) return
  emit('update:range', { ...draft.value })
  open.value = false
}
function openPicker(event: MouseEvent): void {
  // WebKit pointer activation does not focus buttons; retain the actual opener.
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus({ preventScroll: true })
  open.value = true
}
</script>

<template>
  <form class="flex min-w-0 flex-col gap-6" aria-label="Период аналитики" @submit.prevent>
    <div class="flex min-w-0 flex-wrap items-center gap-3">
      <UiButton
        variant="secondary"
        class="h-auto! min-h-input w-full px-3! py-3 whitespace-normal! sm:w-[280px]"
        aria-haspopup="dialog"
        :aria-expanded="open"
        @click="openPicker"
      >
        {{ caption }}
      </UiButton>
      <div class="flex w-full gap-1 sm:w-auto" role="group" aria-label="За последние">
        <button
          v-for="days in presets"
          :key="days"
          type="button"
          :aria-pressed="activePreset === days"
          class="h-input min-w-0 flex-1 rounded-button border px-3 text-field font-medium sm:w-24 sm:flex-none"
          :class="
            activePreset === days
              ? 'border-analytics-accent-border bg-analytics-accent-surface text-ink'
              : 'border-transparent text-secondary hover:bg-paper'
          "
          @click="emit('update:range', presetRange(days, timeZone))"
        >
          {{ days }} дней
        </button>
      </div>
      <p class="hidden text-xs text-secondary sm:block">
        {{ timeZone }}<template v-if="!error"> · {{ rangeDays(range) }} дней</template>
      </p>
    </div>
    <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
    <p v-else class="text-xs text-secondary" data-testid="analytics-period">
      Даты включительно · время организации: {{ timeZone
      }}<span class="sr-only"> · {{ rangeDays(range) }} дн.</span>
    </p>
  </form>
  <UiDialog
    v-model:open="open"
    title="Период аналитики"
    :size="mobile ? 'full' : 'lg'"
    analytics-period
    initial-focus="input[name=from]"
    :description="`Сейчас применено: ${caption}. Изменения вступят в силу после «Применить».`"
  >
    <form class="flex flex-col gap-5" @submit.prevent="apply">
      <div class="flex gap-2" role="group" aria-label="Быстрые периоды">
        <button
          v-for="days in presets"
          :key="days"
          type="button"
          class="h-input min-w-0 flex-1 rounded-button border text-field font-medium"
          :class="
            sameRange(draft, presetRange(days, timeZone))
              ? 'border-analytics-accent-border bg-analytics-accent-surface text-ink'
              : 'border-transparent text-secondary'
          "
          :aria-pressed="sameRange(draft, presetRange(days, timeZone))"
          @click="draft = presetRange(days, timeZone)"
        >
          {{ days }} дней
        </button>
      </div>
      <div class="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <label class="flex min-w-0 flex-col gap-2 text-base"
          >С
          <UiInput
            v-model="draft.from"
            type="date"
            name="from"
            aria-label="Начало периода"
            :invalid="attempted && !!draftError"
            :described-by="`${id}-hint ${attempted && draftError ? `${id}-error` : ''}`"
          />
        </label>
        <label class="flex min-w-0 flex-col gap-2 text-base"
          >По
          <UiInput
            v-model="draft.to"
            type="date"
            name="to"
            aria-label="Конец периода"
            :invalid="attempted && !!draftError"
            :described-by="`${id}-hint ${attempted && draftError ? `${id}-error` : ''}`"
          />
        </label>
      </div>
      <p :id="`${id}-hint`" class="min-h-10 text-sm text-secondary">
        Даты включительно · {{ timeZone }}. До 366 дней.
      </p>
      <p
        v-if="attempted && draftError"
        :id="`${id}-error`"
        class="text-sm text-danger"
        role="alert"
      >
        {{ draftError }}
      </p>
      <div class="grid grid-cols-2 gap-3 border-t border-line pt-5">
        <UiButton variant="secondary" class="px-2!" @click="open = false">Отменить</UiButton>
        <UiButton type="submit" class="px-2!">Применить</UiButton>
      </div>
    </form>
  </UiDialog>
</template>
