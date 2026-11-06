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
import { UiErrorState, UiSkeleton } from '@/shared/ui'
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
      // Подпись периода — RELEASE-SCOPE RC-04: значение `confirmedRecoveredRevenue` — за всё время.
      note: 'За всё время',
    },
  ]
})
</script>

<template>
  <section aria-labelledby="radar-summary-title">
    <h2 id="radar-summary-title" class="sr-only">Сводка</h2>
    <div
      v-if="loading && !summary"
      class="@container overflow-hidden rounded-[14px] border border-hairline bg-paper"
      role="status"
      aria-label="Загрузка сводки"
    >
      <div class="grid grid-cols-2 gap-4 p-4 @[560px]:grid-cols-3 @[860px]:p-0">
        <div
          v-for="index in 3"
          :key="index"
          class="@[860px]:h-[136px] @[860px]:px-[23px] @[860px]:py-[18px]"
        >
          <UiSkeleton class="h-3 w-24" />
          <UiSkeleton class="mt-3 h-6 w-20 @[860px]:mt-6 @[860px]:h-9 @[860px]:w-40" />
        </div>
      </div>
    </div>
    <UiErrorState
      v-else-if="error && !summary"
      :error="error"
      title="Не удалось загрузить сводку"
      @retry="emit('retry')"
    />
    <template v-else>
      <p v-if="error" class="mb-2 text-xs leading-[18px] text-warning" role="status">
        Не удалось обновить сводку: показаны прежние значения.
      </p>
      <div class="@container overflow-hidden rounded-[14px] border border-hairline bg-paper">
        <!-- Телефон: «Активных рисков» отдельной строкой, деньги в две колонки, поля 12 px (Figma 630:7232);
           планшет: три колонки;
           десктоп: колонки с разделителями (Figma 21:2019, 630:6182, 630:7204).
           Подпись, значение и примечание — общие строки сетки (subgrid): разная длина подписей
           и «+ ?» не сдвигают значения соседних колонок. На десктопе строки фиксированы:
           плитка 136 px, как в Figma 21:2019. -->
        <ul
          class="grid grid-cols-2 @[560px]:grid-cols-3 @[860px]:grid-cols-[248px_1fr_1fr] @[860px]:grid-rows-[44px_44px_48px] @[860px]:divide-x @[860px]:divide-hairline"
        >
          <li
            v-for="tile in tiles"
            :key="tile.key"
            :class="[
              'min-w-0 gap-1 p-3 @[560px]:p-4 @[860px]:gap-0 @[860px]:px-[23px] @[860px]:py-[18px]',
              tile.key === 'open'
                ? 'col-span-2 flex items-center justify-between gap-3 border-b border-hairline @[560px]:col-span-1 @[560px]:row-span-3 @[560px]:grid @[560px]:grid-rows-subgrid @[560px]:items-start @[560px]:border-b-0'
                : 'row-span-3 grid grid-rows-subgrid content-start',
            ]"
          >
            <p
              class="text-sm leading-5 font-medium text-muted @[560px]:text-meta @[560px]:leading-[18px] @[860px]:mb-[7px]"
            >
              {{ tile.label }}
            </p>
            <p
              :class="[
                'self-start font-semibold tabular-nums @[560px]:text-4xl @[560px]:leading-10 @[860px]:text-[36px] @[860px]:leading-[44px] @[860px]:tracking-[-0.8px]',
                // На 320 px финансовая колонка уже длинного числа; 20/28 — шкала UI kit.
                // С 340 px ширины сводки возвращается прежний metric (375/390 и шире).
                tile.key === 'open' ? 'text-metric' : 'text-xl @[340px]:text-metric',
                tile.key === 'recovered' ? 'text-money' : 'text-ink',
              ]"
            >
              {{ tile.value }}
              <template v-if="tile.unknownSum">
                <span class="text-muted" aria-hidden="true">+&nbsp;?</span>
                <span class="sr-only">плюс сделки без суммы</span>
              </template>
            </p>
            <p
              :class="[
                'text-xs leading-[18px] text-muted @[860px]:mt-3',
                tile.key === 'open' ? 'text-right @[560px]:text-left' : '',
              ]"
            >
              {{ tile.note }}
            </p>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
