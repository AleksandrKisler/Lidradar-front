<script setup lang="ts">
/**
 * Выбор окна аналитики: две включительные даты в поясе организации и быстрые
 * пресеты «За последние 7, 30, 90 дней» в виде сегментированной кнопки. Все
 * элементы одной высоты и выровнены по верхней границе. Проверка порядка и длины окна — локальная, сообщение приходит
 * от страницы; сервер проверяет границы повторно.
 */
import { computed } from 'vue'
import { UiField, UiIcon, UiInput } from '@/shared/ui'
import { presetRange, rangeDays, sameRange, type DateRange } from '@/entities/report'

const props = defineProps<{ range: DateRange; timeZone: string; error: string | null }>()
const emit = defineEmits<{ 'update:range': [range: DateRange] }>()

const presets = [7, 30, 90] as const
const activePreset = computed(() =>
  presets.find((days) => sameRange(presetRange(days, props.timeZone), props.range)),
)

function setFrom(value: string | undefined): void {
  emit('update:range', { from: value ?? '', to: props.range.to })
}

function setTo(value: string | undefined): void {
  emit('update:range', { from: props.range.from, to: value ?? '' })
}

function applyPreset(days: number): void {
  emit('update:range', presetRange(days, props.timeZone))
}
</script>

<template>
  <form class="flex flex-col gap-3" aria-label="Период аналитики" @submit.prevent>
    <div class="flex flex-wrap items-start gap-x-4 gap-y-3">
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Начало периода"
        class="w-[calc(50%-0.5rem)] sm:w-40"
      >
        <UiInput
          :id="id"
          :model-value="range.from"
          type="date"
          name="from"
          :described-by="describedBy"
          :invalid="invalid || error !== null"
          @update:model-value="setFrom"
        />
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Конец периода"
        class="w-[calc(50%-0.5rem)] sm:w-40"
      >
        <UiInput
          :id="id"
          :model-value="range.to"
          type="date"
          name="to"
          :described-by="describedBy"
          :invalid="invalid || error !== null"
          @update:model-value="setTo"
        />
      </UiField>
      <div class="flex flex-col gap-1.5">
        <span id="period-presets-label" class="text-sm font-medium text-ink">За последние</span>
        <div
          class="inline-flex h-input overflow-hidden rounded-field border border-line"
          role="group"
          aria-labelledby="period-presets-label"
        >
          <button
            v-for="days in presets"
            :key="days"
            type="button"
            :aria-pressed="activePreset === days"
            :class="[
              'flex items-center justify-center gap-1.5 border-l border-line px-4 text-sm font-medium transition-colors first:border-l-0',
              activePreset === days
                ? 'bg-brand-pale text-brand-dark'
                : 'bg-paper text-ink hover:bg-canvas',
            ]"
            @click="applyPreset(days)"
          >
            <UiIcon v-if="activePreset === days" name="check" class="size-4.5" />
            {{ days }} дней
          </button>
        </div>
      </div>
    </div>
    <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
    <p v-else class="text-xs text-muted">
      Даты включительно по поясу организации · {{ rangeDays(range) }} дн.
    </p>
  </form>
</template>
