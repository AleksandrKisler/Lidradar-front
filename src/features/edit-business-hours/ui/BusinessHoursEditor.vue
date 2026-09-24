<script setup lang="ts">
/**
 * Редактор недельного графика точки. Локально проверяется полнота и порядок
 * границ, затем неделя отправляется одним атомарным PUT. Черновик
 * сбрасывается при смене точки; признак несохранённых изменений отдаётся
 * наверх для защиты ухода со страницы.
 */
import { computed, ref, watch } from 'vue'
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
  type Location,
} from '@/entities/location'
import { organizationKeys } from '@/entities/organization'

const props = defineProps<{
  tenantId: string
  location: Location
  submitLabel?: string | undefined
}>()
const emit = defineEmits<{ saved: [location: Location]; 'update:dirty': [dirty: boolean] }>()

const queryClient = useQueryClient()

function baseline(location: Location): DayDraft[] {
  return weekFromHours(location.businessHours) ?? defaultWeek()
}

const days = ref<DayDraft[]>(baseline(props.location))
const errors = ref<Record<number, string>>({})
const saved = ref(false)

const dirty = computed(() => !sameWeek(days.value, baseline(props.location)))
watch(dirty, (value) => emit('update:dirty', value), { immediate: true })

// Другая точка или свежий ответ сервера — новый черновик.
watch(
  () => props.location,
  (location) => {
    days.value = baseline(location)
    errors.value = {}
    saved.value = false
  },
)

const mutation = useMutation({
  mutationFn: () =>
    replaceBusinessHours(
      props.tenantId,
      props.location.id,
      toBusinessHoursRequest(props.location.timezone, days.value),
    ),
  onSuccess: async (location) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: locationKeys.list(props.tenantId) }),
      queryClient.invalidateQueries({ queryKey: organizationKeys.onboarding(props.tenantId) }),
    ])
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
  if (open && !day.opensAt && !day.closesAt) {
    day.opensAt = '09:00'
    day.closesAt = '20:00'
  }
  saved.value = false
}

async function submit(): Promise<void> {
  saved.value = false
  mutation.reset()
  errors.value = validateWeek(days.value)
  if (Object.keys(errors.value).length > 0) return
  await mutation.mutateAsync().catch(() => null)
}

const labelOf = (weekday: number) => WEEKDAYS.find((day) => day.weekday === weekday)?.label ?? ''
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
    <p class="text-sm text-muted">
      Время местное · {{ location.timezone }}. Сообщение в выходной дождётся следующего рабочего
      интервала.
    </p>
    <ul class="flex flex-col divide-y divide-line" aria-label="Дни недели">
      <li
        v-for="day in days"
        :key="day.weekday"
        class="grid items-center gap-x-4 gap-y-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
      >
        <label class="flex items-center gap-3 text-sm font-medium text-ink">
          <input
            type="checkbox"
            :name="`day-${day.weekday}`"
            class="size-4 accent-brand"
            :checked="!day.closed"
            :disabled="mutation.isPending.value"
            @change="toggle(day, ($event.target as HTMLInputElement).checked)"
          />
          {{ labelOf(day.weekday) }}
        </label>
        <template v-if="!day.closed">
          <label class="flex items-center gap-2 text-sm text-muted">
            <span class="sr-only">{{ labelOf(day.weekday) }}, открытие</span>
            <input
              v-model="day.opensAt"
              type="time"
              :name="`opens-${day.weekday}`"
              class="h-10 rounded-field border border-line bg-paper px-3 text-sm text-ink"
              :aria-invalid="errors[day.weekday] ? true : undefined"
              :disabled="mutation.isPending.value"
              @input="saved = false"
            />
          </label>
          <label class="flex items-center gap-2 text-sm text-muted">
            <span class="sr-only">{{ labelOf(day.weekday) }}, закрытие</span>
            <input
              v-model="day.closesAt"
              type="time"
              :name="`closes-${day.weekday}`"
              class="h-10 rounded-field border border-line bg-paper px-3 text-sm text-ink"
              :aria-invalid="errors[day.weekday] ? true : undefined"
              :disabled="mutation.isPending.value"
              @input="saved = false"
            />
          </label>
        </template>
        <span v-else class="text-sm text-muted sm:col-span-2">Выходной</span>
        <p v-if="errors[day.weekday]" class="text-xs text-danger sm:col-span-3" aria-live="polite">
          {{ errors[day.weekday] }}
        </p>
      </li>
    </ul>

    <UiAlert v-if="saved" tone="success">График сохранён.</UiAlert>
    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>

    <div class="flex items-center justify-between gap-4">
      <p class="text-xs text-muted">Неделя сохраняется целиком, одним запросом.</p>
      <UiButton
        type="submit"
        :disabled="!dirty && !saved && Boolean(location.businessHours.length)"
        :loading="mutation.isPending.value"
      >
        {{ submitLabel ?? 'Сохранить график' }}
      </UiButton>
    </div>
  </form>
</template>
