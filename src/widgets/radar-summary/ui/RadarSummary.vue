<script setup lang="ts">
/**
 * Плитки сводки Radar. Все значения принадлежат одному снимку сервера:
 * при ошибке прежние числа не заменяются нулями, а показывается состояние
 * ошибки с повтором. Термины денег фиксированы: «потенциальная» и
 * «подтверждённо возвращённая» выручка.
 *
 * Компактная раскладка выбирается по ширине самой сводки (container query),
 * а не окна: в узкой колонке плитки — строки «название — значение», в
 * широкой — три колонки. Если у части сделок нет суммы, показывается
 * известная сумма и «+ ?» вместо слов «сумма не определена».
 */
import { computed } from 'vue'
import { formatAmount, formatMoney } from '@/shared/lib'
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

/** Известная часть потенциальной выручки; без валюты — только число. */
function knownPotential(summary: RadarSummary): string {
  return money(summary.potentialRevenue) ?? formatAmount(summary.potentialRevenue) ?? '0'
}

const tiles = computed(() => {
  const summary = props.summary
  if (!summary) return []
  const unknown = summary.opportunitiesWithUnknownAmount
  return [
    {
      key: 'open',
      label: 'Активных рисков',
      value: String(summary.openRisks),
      unknownSum: false,
      note: `из них критичных: ${summary.criticalRisks}`,
    },
    {
      key: 'potential',
      label: 'Потенциальная выручка',
      value: unknown > 0 ? knownPotential(summary) : (money(summary.potentialRevenue) ?? '—'),
      unknownSum: unknown > 0,
      note: unknown > 0 ? `сделок без суммы: ${unknown}` : 'оценка открытых сделок под риском',
    },
    {
      key: 'recovered',
      label: 'Подтверждённо возвращённая выручка',
      value: money(summary.confirmedRecoveredRevenue) ?? '—',
      unknownSum: false,
      note: 'подтверждено оплатами с атрибуцией к риску',
    },
  ]
})
</script>

<template>
  <section aria-labelledby="radar-summary-title">
    <h2 id="radar-summary-title" class="sr-only">Сводка</h2>
    <UiCard
      v-if="loading && !summary"
      :padded="false"
      class="@container"
      role="status"
      aria-label="Загрузка сводки"
    >
      <div class="grid divide-y divide-line @2xl:grid-cols-3 @2xl:divide-x @2xl:divide-y-0">
        <div v-for="index in 3" :key="index" class="px-4 py-3 @2xl:px-6 @2xl:py-5">
          <UiSkeleton class="h-3 w-32" />
          <UiSkeleton class="mt-3 h-6 w-24" />
        </div>
      </div>
    </UiCard>
    <UiErrorState
      v-else-if="error && !summary"
      :error="error"
      title="Не удалось загрузить сводку"
      @retry="emit('retry')"
    />
    <UiCard v-else :padded="false" class="@container">
      <ul class="grid divide-y divide-line @2xl:grid-cols-3 @2xl:divide-x @2xl:divide-y-0">
        <li v-for="tile in tiles" :key="tile.key" class="px-4 py-3 @2xl:px-6 @2xl:py-5">
          <div
            class="flex flex-wrap items-baseline justify-between gap-x-4 @2xl:flex-col @2xl:items-start @2xl:gap-y-2"
          >
            <p
              class="min-w-0 grow basis-40 text-sm text-muted @2xl:min-h-10 @2xl:grow-0 @5xl:min-h-0 @2xl:basis-auto"
            >
              {{ tile.label }}
            </p>
            <p class="text-xl font-medium text-ink tabular-nums @2xl:text-3xl">
              {{ tile.value }}
              <template v-if="tile.unknownSum">
                <span class="text-muted" aria-hidden="true">+&nbsp;?</span>
                <span class="sr-only">плюс сделки без суммы</span>
              </template>
            </p>
          </div>
          <p class="mt-0.5 text-xs text-muted @2xl:mt-2 @2xl:text-sm">{{ tile.note }}</p>
        </li>
      </ul>
    </UiCard>
  </section>
</template>
