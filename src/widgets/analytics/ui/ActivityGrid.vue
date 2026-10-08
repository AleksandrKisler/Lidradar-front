<script setup lang="ts">
/**
 * Остальные счётчики сводки: сообщения, сделки, исходы и деньги. `potential` —
 * оценка ещё открытых сделок, не выручка, и подписывается именно так.
 */
import { computed } from 'vue'
import { formatMoney } from '@/shared/lib'
import { UiCard } from '@/shared/ui'
import { activityRates, formatPercent, type AnalyticsSummary } from '@/entities/report'

const props = defineProps<{ summary: AnalyticsSummary }>()
const rates = computed(() => activityRates(props.summary))
const money = (amount: string) => formatMoney(amount, props.summary.revenue.currency) ?? '—'
const atRiskPotential = computed(() => {
  const { atRiskPotential, atRiskOpportunities, atRiskUnknownAmountOpportunities } =
    props.summary.revenue
  const known = atRiskOpportunities - atRiskUnknownAmountOpportunities
  const amount =
    known > 0 || atRiskOpportunities === 0 ? money(atRiskPotential) : 'Сумма не определена'
  return atRiskUnknownAmountOpportunities > 0
    ? `${amount} · ${atRiskUnknownAmountOpportunities} без суммы`
    : amount
})

const groups = computed(() => [
  {
    title: 'Сообщения',
    rows: [
      ['Всего', String(props.summary.messages.total)],
      ['Входящие', String(props.summary.messages.incoming)],
      ['Исходящие', String(props.summary.messages.outgoing)],
      ['Новые переписки', String(props.summary.messages.conversations)],
    ],
  },
  {
    title: 'Сделки',
    rows: [
      ['Открыто', String(props.summary.opportunities.created)],
      [
        'Записались',
        `${props.summary.opportunities.booked}${
          rates.value.booked !== null ? ` · ${formatPercent(rates.value.booked)}` : ''
        }`,
      ],
      ['Выиграно', String(props.summary.opportunities.won)],
      ['Потеряно', String(props.summary.opportunities.lost)],
    ],
  },
  {
    title: 'Исходы',
    rows: [
      ['Запись', String(props.summary.outcomes.booked)],
      ['Оплата', String(props.summary.outcomes.paid)],
      ['Потеря', String(props.summary.outcomes.lost)],
    ],
  },
  {
    title: `Деньги · ${props.summary.revenue.currency}`,
    rows: [
      ['Подтверждено всего', money(props.summary.revenue.confirmed)],
      ['Из них возвращено', money(props.summary.revenue.confirmedRecovered)],
      ['Подтверждённых оплат', String(props.summary.revenue.confirmedPayments)],
      ['Известная оценка открытых сделок, не выручка', money(props.summary.revenue.potential)],
      ['Сделок с риском', String(props.summary.revenue.atRiskOpportunities)],
      ['Оценка сделок с риском, не выручка', atRiskPotential.value],
    ],
  },
])
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
    <UiCard v-for="group in groups" :key="group.title" as="section" :aria-label="group.title">
      <h3 class="text-sm font-semibold text-ink">{{ group.title }}</h3>
      <dl class="mt-3 flex flex-col gap-2 text-sm">
        <div v-for="[label, value] in group.rows" :key="label" class="flex justify-between gap-3">
          <dt class="text-muted">{{ label }}</dt>
          <dd class="text-right font-semibold text-ink tabular-nums">{{ value }}</dd>
        </div>
      </dl>
    </UiCard>
  </div>
</template>
