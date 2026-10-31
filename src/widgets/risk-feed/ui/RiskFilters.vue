<script setup lang="ts">
/**
 * Бизнес-фильтры ленты и сводки: точка, важность, тип риска. Одни и те же
 * значения передаются обоим запросам, чтобы числа и список совпадали.
 */
import { computed, ref } from 'vue'
import { UiButton, UiDialog, UiField, UiSelect, type UiSelectOption } from '@/shared/ui'
import type { Location } from '@/entities/location'
import RiskStatusTabs from './RiskStatusTabs.vue'
import {
  RISK_SEVERITIES,
  RISK_TYPES,
  riskTypeLabel,
  severityLabel,
  type RiskFeedStatus,
  type RiskFilters,
  type RiskSeverity,
  type RiskType,
} from '@/entities/risk'

const props = withDefaults(
  defineProps<{
    modelValue: RiskFilters
    /** Вкладка статуса; в панели `bar` стоит слева от выпадающих фильтров. */
    status?: RiskFeedStatus | null
    locations: Location[]
    /** `bar` — панель над лентой (десктоп); `panel` — кнопка и окно «Фильтры» (планшет, телефон). */
    variant?: 'bar' | 'panel'
  }>(),
  { variant: 'bar', status: null },
)
const panelOpen = ref(false)
const emit = defineEmits<{
  'update:modelValue': [filters: RiskFilters]
  'update:status': [status: RiskFeedStatus | null]
}>()

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
    v-if="variant === 'bar'"
    class="hidden min-h-[72px] flex-wrap items-center gap-3 rounded-xl border border-hairline bg-paper p-4 lg:flex lg:justify-between"
    role="group"
    aria-label="Фильтры"
  >
    <RiskStatusTabs
      :model-value="status"
      @update:model-value="(value) => emit('update:status', value)"
    />
    <div class="ml-auto flex flex-wrap items-center gap-3">
      <UiSelect
        v-if="locations.length > 1"
        size="filter"
        class="w-[156px]"
        aria-label="Точка"
        :model-value="modelValue.locationId ?? ''"
        :options="locationOptions"
        placeholder="Все точки"
        @update:model-value="(value) => update({ locationId: value || undefined })"
      />
      <UiSelect
        size="filter"
        class="w-[156px]"
        aria-label="Важность"
        :model-value="modelValue.severity ?? ''"
        :options="severityOptions"
        placeholder="Любая важность"
        @update:model-value="
          (value) => update({ severity: (value || undefined) as RiskSeverity | undefined })
        "
      />
      <UiSelect
        size="filter"
        class="w-[156px]"
        aria-label="Тип риска"
        :model-value="modelValue.riskType ?? ''"
        :options="typeOptions"
        placeholder="Все типы"
        @update:model-value="
          (value) => update({ riskType: (value || undefined) as RiskType | undefined })
        "
      />
      <UiButton v-if="hasFilters" variant="ghost" size="sm" @click="emit('update:modelValue', {})"
        >Сбросить фильтры</UiButton
      >
    </div>
  </div>

  <div v-else class="lg:hidden">
    <button
      type="button"
      class="h-[46px] rounded-button border border-line bg-canvas px-5 text-field leading-5 font-medium text-ink hover:bg-segment"
      aria-haspopup="dialog"
      @click="panelOpen = true"
    >
      Фильтры
    </button>
    <UiDialog v-model:open="panelOpen" title="Фильтры" size="md">
      <div class="flex flex-col gap-4">
        <UiField v-if="locations.length > 1" v-slot="{ id }" label="Точка">
          <UiSelect
            :id="id"
            :model-value="modelValue.locationId ?? ''"
            :options="locationOptions"
            placeholder="Все точки"
            @update:model-value="(value) => update({ locationId: value || undefined })"
          />
        </UiField>
        <UiField v-slot="{ id }" label="Важность">
          <UiSelect
            :id="id"
            :model-value="modelValue.severity ?? ''"
            :options="severityOptions"
            placeholder="Любая важность"
            @update:model-value="
              (value) => update({ severity: (value || undefined) as RiskSeverity | undefined })
            "
          />
        </UiField>
        <UiField v-slot="{ id }" label="Тип риска">
          <UiSelect
            :id="id"
            :model-value="modelValue.riskType ?? ''"
            :options="typeOptions"
            placeholder="Все типы"
            @update:model-value="
              (value) => update({ riskType: (value || undefined) as RiskType | undefined })
            "
          />
        </UiField>
        <UiButton v-if="hasFilters" variant="secondary" @click="emit('update:modelValue', {})"
          >Сбросить фильтры</UiButton
        >
        <UiButton @click="panelOpen = false">Готово</UiButton>
      </div>
    </UiDialog>
  </div>
</template>
