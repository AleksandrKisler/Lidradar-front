<script setup lang="ts">
/**
 * Плитки сводки Radar. Все значения принадлежат одному снимку сервера:
 * при ошибке прежние числа не заменяются нулями, а показывается состояние
 * ошибки с повтором. Термины денег фиксированы: «потенциальная» и
 * «подтверждённо возвращённая» выручка.
 */
import { computed } from 'vue'
import { formatMoney } from '@/shared/lib'
import { UiCard, UiErrorState, UiSkeleton } from '@/shared/ui'
import type { RadarSummary } from '@/entities/risk'

const props = defineProps<{
  summary: RadarSummary | undefined
  /** Валюта организации; без неё суммы не форматируются. */
  currency: string | null
  loading: boolean
  error: unknown
}>()

const emit = defineEmits<{ retry: [] }>()

const money = (value: string | undefined) =>
  value !== undefined && props.currency ? formatMoney(value, props.currency) : null

const tiles = computed(() => {
  const summary = props.summary
  if (!summary) return []
  return [
    {
      key: 'open',
      label: 'Активных рисков',
      value: String(summary.openRisks),
      note: `из них критичных: ${summary.criticalRisks}`,
    },
    {
      key: 'potential',
      label: 'Потенциальная выручка',
      value:
        summary.opportunitiesWithUnknownAmount > 0 &&
        summary.opportunitiesWithUnknownAmount === summary.opportunitiesAtRisk
          ? 'Сумма не определена'
          : (money(summary.potentialRevenue) ?? '—'),
      note:
        summary.opportunitiesWithUnknownAmount > 0
          ? `сделок без суммы: ${summary.opportunitiesWithUnknownAmount}`
          : 'оценка открытых сделок под риском',
    },
    {
      key: 'recovered',
      label: 'Подтверждённо возвращённая выручка',
      value: money(summary.confirmedRecoveredRevenue) ?? '—',
      note: 'подтверждено оплатами с атрибуцией к риску',
    },
  ]
})
</script>

<template>
  <section aria-labelledby="radar-summary-title">
    <h2 id="radar-summary-title" class="sr-only">Сводка</h2>
    <div
      v-if="loading && !summary"
      class="grid gap-4 md:grid-cols-3"
      role="status"
      aria-label="Загрузка сводки"
    >
      <UiCard v-for="index in 3" :key="index">
        <UiSkeleton class="h-3 w-32" />
        <UiSkeleton class="mt-4 h-8 w-24" />
        <UiSkeleton class="mt-3 h-3 w-40" />
      </UiCard>
    </div>
    <UiErrorState
      v-else-if="error && !summary"
      :error="error"
      title="Не удалось загрузить сводку"
      @retry="emit('retry')"
    />
    <div v-else class="grid gap-4 md:grid-cols-3">
      <UiCard v-for="tile in tiles" :key="tile.key">
        <p class="text-xs font-semibold tracking-wide text-muted uppercase">{{ tile.label }}</p>
        <p class="mt-3 text-3xl font-bold text-ink tabular-nums">{{ tile.value }}</p>
        <p class="mt-1 text-sm text-muted">{{ tile.note }}</p>
      </UiCard>
    </div>
  </section>
</template>
