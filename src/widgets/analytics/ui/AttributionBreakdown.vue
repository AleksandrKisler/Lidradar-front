<script setup lang="ts">
/**
 * Разделение подтверждённых оплат по атрибуции в порядке сервера:
 * RECOVERED, ORGANIC, UNKNOWN. Суммы из ответа показываются как есть и не
 * суммируются в итог; числовое сложение нужно только для долей колец.
 * Внешнее кольцо — доли по деньгам, внутреннее — по числу оплат.
 */
import { computed } from 'vue'
import { formatMoney, plural } from '@/shared/lib'
import { RING_TONES, UiRingChart, type Ring, type RingTone } from '@/shared/ui'
import {
  attributionCaption,
  formatPercent,
  ratio,
  type AnalyticsAttributionSplit,
} from '@/entities/report'

const props = defineProps<{ attribution: AnalyticsAttributionSplit[]; currency: string }>()

const tones: Record<AnalyticsAttributionSplit['type'], RingTone> = {
  RECOVERED: 'success',
  ORGANIC: 'info',
  UNKNOWN: 'neutral',
}
const toneOf = (type: string): RingTone =>
  tones[type as AnalyticsAttributionSplit['type']] ?? 'neutral'
const payments = (count: number) => `${count} ${plural(count, 'оплата', 'оплаты', 'оплат')}`

const amounts = computed(() =>
  props.attribution.map((row) => {
    const value = Number(row.amount)
    return Number.isFinite(value) && value > 0 ? value : 0
  }),
)
const totalAmount = computed(() => amounts.value.reduce((sum, value) => sum + value, 0))
const totalCount = computed(() => props.attribution.reduce((sum, row) => sum + row.count, 0))

const allRings = computed<Ring[]>(() => [
  {
    key: 'amount',
    max: totalAmount.value,
    segments: props.attribution.map((row, index) => ({
      value: amounts.value[index] ?? 0,
      tone: toneOf(row.type),
      title: `${attributionCaption(row.type)}: ${formatMoney(row.amount, props.currency) ?? '—'}`,
    })),
  },
  {
    key: 'count',
    max: totalCount.value,
    segments: props.attribution.map((row) => ({
      value: row.count,
      tone: toneOf(row.type),
      title: `${attributionCaption(row.type)}: ${payments(row.count)}`,
    })),
  },
])

/** Кольцо без целого (нет оплат или сумм) не рисуется; без колец остаётся легенда. */
const rings = computed(() => allRings.value.filter((ring) => ring.max > 0))

/** «66 % суммы · 71 % оплат»: порядок совпадает с кольцами, снаружи внутрь. */
const shares = computed(() =>
  props.attribution.map((row, index) => {
    const byAmount = ratio(amounts.value[index] ?? 0, totalAmount.value)
    const byCount = ratio(row.count, totalCount.value)
    return byAmount === null || byCount === null
      ? null
      : `${formatPercent(byAmount)} суммы · ${formatPercent(byCount)} оплат`
  }),
)
</script>

<template>
  <div class="@container">
    <div class="flex flex-col items-center gap-6 @lg:flex-row">
      <UiRingChart v-if="rings.length" :rings="rings">
        <span class="text-2xl leading-none font-medium text-ink tabular-nums">{{
          totalCount
        }}</span>
        <span class="mt-1 text-xs text-muted">{{
          plural(totalCount, 'оплата', 'оплаты', 'оплат')
        }}</span>
      </UiRingChart>
      <dl class="flex w-full min-w-0 flex-1 flex-col gap-4">
        <div v-for="(row, index) in attribution" :key="row.type">
          <dt class="flex items-start gap-2 text-sm text-muted">
            <span
              aria-hidden="true"
              class="mt-1.5 size-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: RING_TONES[toneOf(row.type)].main }"
            />
            <span class="min-w-0"
              >{{ attributionCaption(row.type) }} · {{ row.count }}
              {{ plural(row.count, 'оплата', 'оплаты', 'оплат') }}</span
            >
          </dt>
          <dd
            data-testid="attribution-amount"
            class="mt-0.5 pl-[18px] text-xl font-medium tabular-nums"
            :style="{ color: RING_TONES[toneOf(row.type)].accent }"
          >
            {{ formatMoney(row.amount, currency) ?? '—' }}
          </dd>
          <dd v-if="shares[index]" class="pl-[18px] text-xs text-muted">{{ shares[index] }}</dd>
        </div>
      </dl>
    </div>
  </div>
</template>
