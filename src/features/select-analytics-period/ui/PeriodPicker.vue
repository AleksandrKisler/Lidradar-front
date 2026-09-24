<script setup lang="ts">
/**
 * Выбор окна аналитики: две включительные даты в поясе организации и быстрые
 * пресеты. Проверка порядка и длины окна — локальная, сообщение приходит
 * от страницы; сервер проверяет границы повторно.
 */
import { computed } from 'vue'
import { UiButton, UiField, UiInput } from '@/shared/ui'
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
    <div class="flex flex-wrap items-end gap-3">
      <UiField v-slot="{ id, describedBy, invalid }" label="Начало периода" class="w-40">
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
      <UiField v-slot="{ id, describedBy, invalid }" label="Конец периода" class="w-40">
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
      <div class="flex flex-wrap gap-2" role="group" aria-label="Быстрый выбор">
        <UiButton
          v-for="days in presets"
          :key="days"
          size="sm"
          :variant="activePreset === days ? 'primary' : 'secondary'"
          :aria-pressed="activePreset === days"
          @click="applyPreset(days)"
        >
          {{ days }} дней
        </UiButton>
      </div>
    </div>
    <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
    <p v-else class="text-xs text-muted">
      Даты включительно по поясу организации · {{ rangeDays(range) }} дн.
    </p>
  </form>
</template>
