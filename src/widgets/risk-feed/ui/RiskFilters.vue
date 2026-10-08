<script setup lang="ts">
/**
 * Бизнес-фильтры ленты и сводки: точка, важность, тип риска. Одни и те же
 * значения передаются обоим запросам, чтобы числа и список совпадали.
 */
import { computed } from 'vue'
import { UiButton, UiSelect, type UiSelectOption } from '@/shared/ui'
import type { Location } from '@/entities/location'
import {
  RISK_SEVERITIES,
  RISK_TYPES,
  riskTypeLabel,
  severityLabel,
  type RiskFilters,
  type RiskSeverity,
  type RiskType,
} from '@/entities/risk'

const props = defineProps<{ modelValue: RiskFilters; locations: Location[] }>()
const emit = defineEmits<{ 'update:modelValue': [filters: RiskFilters] }>()

const severityOptions: UiSelectOption[] = RISK_SEVERITIES.map((value) => ({
  value,
  label: severityLabel(value),
}))
const typeOptions: UiSelectOption[] = RISK_TYPES.map((value) => ({
  value,
  label: riskTypeLabel(value),
}))
const locationOptions = computed<UiSelectOption[]>(() =>
  props.locations.map((location) => ({ value: location.id, label: location.name })),
)

const hasFilters = computed(() =>
  Boolean(props.modelValue.locationId || props.modelValue.severity || props.modelValue.riskType),
)

function update(patch: Partial<RiskFilters>): void {
  const next: RiskFilters = { ...props.modelValue, ...patch }
  for (const key of Object.keys(next) as (keyof RiskFilters)[]) {
    if (!next[key]) delete next[key]
  }
  emit('update:modelValue', next)
}
</script>

<template>
  <div
    class="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap"
    role="group"
    aria-label="Фильтры"
  >
    <label
      v-if="locations.length > 1"
      class="col-span-2 flex min-w-0 flex-col gap-1.5 text-sm font-medium text-ink sm:min-w-44"
    >
      Точка
      <UiSelect
        :model-value="modelValue.locationId ?? ''"
        :options="locationOptions"
        placeholder="Все точки"
        @update:model-value="(value) => update({ locationId: value || undefined })"
      />
    </label>
    <label class="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-ink sm:min-w-40">
      Важность
      <UiSelect
        :model-value="modelValue.severity ?? ''"
        :options="severityOptions"
        placeholder="Любая"
        @update:model-value="
          (value) => update({ severity: (value || undefined) as RiskSeverity | undefined })
        "
      />
    </label>
    <label class="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-ink sm:min-w-56">
      Тип риска
      <UiSelect
        :model-value="modelValue.riskType ?? ''"
        :options="typeOptions"
        placeholder="Все типы"
        @update:model-value="
          (value) => update({ riskType: (value || undefined) as RiskType | undefined })
        "
      />
    </label>
    <UiButton
      v-if="hasFilters"
      variant="ghost"
      class="col-span-2 sm:col-auto"
      @click="emit('update:modelValue', {})"
      >Сбросить фильтры</UiButton
    >
  </div>
</template>
