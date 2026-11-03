<script setup lang="ts">
import { computed } from 'vue'
import { formatMoney, plural } from '@/shared/lib'
import { UiCard, UiGlyph } from '@/shared/ui'
import type { AnalyticsSummary } from '@/entities/report'
import StatCard from './StatCard.vue'

const props = defineProps<{ summary: AnalyticsSummary }>()
const number = (value: number) => value.toLocaleString('ru-RU')
const groups = computed(() => [
  {
    title: 'Сообщения',
    rows: [
      { label: 'Всего', value: number(props.summary.messages.total) },
      { label: 'Входящие', value: number(props.summary.messages.incoming) },
      { label: 'Исходящие', value: number(props.summary.messages.outgoing) },
      { label: 'Новые переписки', value: number(props.summary.messages.conversations) },
    ],
    hint: 'Сообщения — по дате отправки. Новые переписки — по первому сообщению.',
  },
  {
    title: 'Сделки',
    rows: [
      { label: 'Создано', value: number(props.summary.opportunities.created) },
      { label: 'Переход в запись', value: number(props.summary.opportunities.booked) },
      { label: 'Выиграно', value: number(props.summary.opportunities.won) },
      { label: 'Потеряно', value: number(props.summary.opportunities.lost) },
    ],
    hint: 'События за период могут относиться к сделкам, созданным ранее.',
  },
  {
    title: 'Записанные исходы',
    rows: [
      { label: 'Запись', value: number(props.summary.outcomes.booked) },
      { label: 'Оплачено', value: number(props.summary.outcomes.paid) },
      { label: 'Потеря', value: number(props.summary.outcomes.lost) },
    ],
    hint: 'Исход «Оплачено» сам по себе не подтверждает выручку.',
  },
])
const estimates = computed(() => {
  const revenue = props.summary.revenue
  const known = revenue.atRiskOpportunities - revenue.atRiskUnknownAmountOpportunities
  return [
    {
      label: 'Открытые сделки, созданные в периоде',
      value: formatMoney(revenue.potential, revenue.currency) ?? '—',
    },
    { label: 'Сделки с активным риском', value: number(revenue.atRiskOpportunities) },
    {
      label: 'Известная оценка сделок с риском',
      value:
        known === 0 && revenue.atRiskOpportunities > 0
          ? 'Сумма не определена'
          : (formatMoney(revenue.atRiskPotential, revenue.currency) ?? '—'),
    },
  ]
})
</script>

<template>
  <div class="activity">
    <UiCard :padded="false" class="activity-grid">
      <StatCard v-for="group in groups" :key="group.title" v-bind="group" />
    </UiCard>
    <UiCard as="section" :padded="false" class="estimates" aria-label="Оценки сделок">
      <h3><UiGlyph name="banknote" class="size-[18px] text-muted" />Оценки сделок</h3>
      <p class="estimates-intro">
        Оценки не являются выручкой и не входят в подтверждённые оплаты.
      </p>
      <dl class="estimate-grid">
        <div v-for="estimate in estimates" :key="estimate.label">
          <dt>{{ estimate.label }}</dt>
          <dd>{{ estimate.value }}</dd>
        </div>
      </dl>
      <p class="note" data-testid="unknown-estimates">
        <template v-if="summary.revenue.atRiskUnknownAmountOpportunities > 0"
          >Ещё {{ summary.revenue.atRiskUnknownAmountOpportunities }}
          {{
            plural(summary.revenue.atRiskUnknownAmountOpportunities, 'сделка', 'сделки', 'сделок')
          }}
          с риском без оценки. Их суммы в итог не включены.</template
        >
        <template v-else>Сделок с риском без оценки: 0.</template>
      </p>
      <p class="note">
        Сделка с несколькими рисками учитывается один раз. Оценка — на текущий момент.
      </p>
    </UiCard>
  </div>
</template>

<style scoped>
.activity {
  display: grid;
  gap: 24px;
  min-width: 0;
}
.activity-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-color: var(--color-analytics-line);
  overflow: hidden;
}
.activity-grid > :deep(section + section) {
  border-left: 1px solid var(--color-line);
}
.estimates {
  padding: 24px;
  border-color: var(--color-analytics-line);
}
h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}
.estimates-intro {
  margin-top: 16px;
  color: var(--color-secondary);
  font-size: 14px;
  line-height: 20px;
}
.estimate-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 32px;
  margin-top: 16px;
  padding-top: 24px;
  border-top: 1px solid var(--color-line);
}
dt {
  min-height: 44px;
  color: var(--color-secondary);
  font-size: 15px;
  line-height: 22px;
}
dd {
  margin-top: 12px;
  font-size: 22px;
  font-weight: 600;
  line-height: 28px;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.note {
  margin-top: 24px;
  color: var(--color-secondary);
  font-size: 12px;
  line-height: 18px;
}
.note + .note {
  margin-top: 16px;
}
@media (min-width: 1200px) {
  .activity {
    gap: 64px;
  }
}
@media (max-width: 599px) {
  .activity-grid,
  .estimate-grid {
    grid-template-columns: 1fr;
  }
  .activity-grid > :deep(section + section) {
    border-left: 0;
    border-top: 1px solid var(--color-line);
  }
  .estimate-grid {
    gap: 32px;
  }
}
</style>
