<script setup lang="ts">
/**
 * Остальные счётчики сводки: сообщения, сделки, исходы и деньги. `potential` —
 * оценка ещё открытых сделок, не выручка, и подписывается именно так.
 *
 * Где величины складываются в целое, рядом с легендой рисуются кольца:
 * сообщения и исходы — одно кольцо из сегментов, сделки — по кольцу на стадию
 * от открытых, деньги — доля возвращённого и доля сделок с известной суммой.
 * Если целого нет (знаменатель нулевой) или значение в него не помещается
 * (например, сделок выиграно больше, чем открыто в окне), кольцо не рисуется,
 * а строка остаётся обычным числом: карточка выглядит как прежний список.
 */
import { computed } from 'vue'
import { formatMoney, plural } from '@/shared/lib'
import type { Ring } from '@/shared/ui'
import { formatPercent, ratio, type AnalyticsSummary } from '@/entities/report'
import StatCard, { type StatCenter, type StatRow } from './StatCard.vue'

const props = defineProps<{ summary: AnalyticsSummary }>()

const money = (amount: string) => formatMoney(amount, props.summary.revenue.currency) ?? '—'

/** Есть целое, и значение в нём помещается: кольцо можно построить. */
function fits(value: number, max: number): boolean {
  return Number.isFinite(value) && Number.isFinite(max) && max > 0 && value >= 0 && value <= max
}

/** Доля как «50 %»; без знаменателя или вне целого — `undefined`. */
function shareOf(value: number, max: number): string | undefined {
  const part = fits(value, max) ? ratio(value, max) : null
  return part === null ? undefined : formatPercent(part)
}

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

interface Group {
  key: string
  title: string
  rows: StatRow[]
  rings: Ring[]
  center?: StatCenter | undefined
}

const messages = computed<Group>(() => {
  const { total, incoming, outgoing, conversations } = props.summary.messages
  const ok = fits(incoming + outgoing, total)
  return {
    key: 'messages',
    title: 'Сообщения',
    rings: ok
      ? [
          {
            key: 'direction',
            max: total,
            segments: [
              { value: incoming, tone: 'info', title: `Входящие: ${incoming} из ${total}` },
              { value: outgoing, tone: 'brand', title: `Исходящие: ${outgoing} из ${total}` },
            ],
          },
        ]
      : [],
    center: ok
      ? { value: String(total), caption: plural(total, 'сообщение', 'сообщения', 'сообщений') }
      : undefined,
    rows: [
      { label: 'Всего', value: String(total) },
      {
        label: 'Входящие',
        value: String(incoming),
        share: ok ? shareOf(incoming, total) : undefined,
        tone: ok ? 'info' : undefined,
      },
      {
        label: 'Исходящие',
        value: String(outgoing),
        share: ok ? shareOf(outgoing, total) : undefined,
        tone: ok ? 'brand' : undefined,
      },
      { label: 'Новые переписки', value: String(conversations) },
    ],
  }
})

const opportunities = computed<Group>(() => {
  const { created, booked, won, lost } = props.summary.opportunities
  const stages = [
    { key: 'booked', label: 'Записались', value: booked, tone: 'brand' },
    { key: 'won', label: 'Выиграно', value: won, tone: 'success' },
    { key: 'lost', label: 'Потеряно', value: lost, tone: 'danger' },
  ] as const
  const drawn = stages.filter((stage) => fits(stage.value, created))
  return {
    key: 'opportunities',
    title: 'Сделки',
    rings: drawn.map((stage) => ({
      key: stage.key,
      max: created,
      segments: [
        {
          value: stage.value,
          tone: stage.tone,
          title: `${stage.label}: ${stage.value} из ${created}`,
        },
      ],
    })),
    center: drawn.length ? { value: String(created), caption: 'открыто' } : undefined,
    rows: [
      { label: 'Открыто', value: String(created) },
      ...stages.map((stage) => ({
        label: stage.label,
        value: String(stage.value),
        share: shareOf(stage.value, created),
        tone: drawn.includes(stage) ? stage.tone : undefined,
      })),
    ],
  }
})

const outcomes = computed<Group>(() => {
  const { booked, paid, lost } = props.summary.outcomes
  const total = booked + paid + lost
  return {
    key: 'outcomes',
    title: 'Исходы',
    rings:
      total > 0
        ? [
            {
              key: 'outcomes',
              max: total,
              segments: [
                { value: booked, tone: 'brand', title: `Запись: ${booked} из ${total}` },
                { value: paid, tone: 'success', title: `Оплата: ${paid} из ${total}` },
                { value: lost, tone: 'danger', title: `Потеря: ${lost} из ${total}` },
              ],
            },
          ]
        : [],
    center:
      total > 0
        ? { value: String(total), caption: plural(total, 'исход', 'исхода', 'исходов') }
        : undefined,
    rows: [
      { label: 'Запись', value: String(booked), share: shareOf(booked, total), tone: 'brand' },
      { label: 'Оплата', value: String(paid), share: shareOf(paid, total), tone: 'success' },
      { label: 'Потеря', value: String(lost), share: shareOf(lost, total), tone: 'danger' },
    ],
  }
})

const revenue = computed<Group>(() => {
  const r = props.summary.revenue
  const confirmed = Number(r.confirmed)
  const recovered = Number(r.confirmedRecovered)
  const knownAmount = r.atRiskOpportunities - r.atRiskUnknownAmountOpportunities
  const recoveredOk = fits(recovered, confirmed)
  const knownOk = fits(knownAmount, r.atRiskOpportunities)
  const recoveredShare = recoveredOk ? formatPercent(recovered / confirmed) : undefined
  const knownShare = knownOk ? formatPercent(knownAmount / r.atRiskOpportunities) : undefined
  const rings: Ring[] = []
  if (recoveredOk) {
    rings.push({
      key: 'recovered',
      max: confirmed,
      segments: [
        {
          value: recovered,
          tone: 'success',
          title: `Возвращено: ${money(r.confirmedRecovered)} из ${money(r.confirmed)}`,
        },
      ],
    })
  }
  if (knownOk) {
    rings.push({
      key: 'known-amount',
      max: r.atRiskOpportunities,
      segments: [
        {
          value: knownAmount,
          tone: 'info',
          title: `Сумма известна у ${knownAmount} из ${r.atRiskOpportunities} сделок с риском`,
        },
      ],
    })
  }
  // В центре — главная доля первого из построенных колец.
  const center: StatCenter | undefined = recoveredShare
    ? { value: recoveredShare, caption: 'возвращено', tone: 'success' }
    : knownShare
      ? { value: knownShare, caption: 'с суммой', tone: 'info' }
      : undefined
  return {
    key: 'revenue',
    title: `Деньги · ${r.currency}`,
    rings,
    center,
    rows: [
      { label: 'Подтверждено всего', value: money(r.confirmed) },
      {
        label: 'Из них возвращено',
        value: money(r.confirmedRecovered),
        share: recoveredShare,
        tone: recoveredOk ? 'success' : undefined,
      },
      { label: 'Подтверждённых оплат', value: String(r.confirmedPayments) },
      { label: 'Известная оценка открытых сделок, не выручка', value: money(r.potential) },
      {
        label: 'Сделок с риском',
        value: String(r.atRiskOpportunities),
        hint: knownShare ? `${knownShare} с известной суммой` : undefined,
        tone: knownOk ? 'info' : undefined,
      },
      { label: 'Оценка сделок с риском, не выручка', value: atRiskPotential.value },
    ],
  }
})

const groups = computed(() => [messages.value, opportunities.value, outcomes.value, revenue.value])
</script>

<template>
  <div class="@container">
    <div class="grid gap-4 @2xl:grid-cols-2">
      <StatCard
        v-for="group in groups"
        :key="group.key"
        :title="group.title"
        :rows="group.rows"
        :rings="group.rings"
        :center="group.center"
      />
    </div>
  </div>
</template>
