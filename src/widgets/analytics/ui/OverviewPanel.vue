<script setup lang="ts">
import { formatMoney, plural } from '@/shared/lib'
import { UiCard, UiGlyph } from '@/shared/ui'
import type { AnalyticsSummary } from '@/entities/report'
import MetricCards from './MetricCards.vue'
import RevenueChart from './RevenueChart.vue'
import AttributionBreakdown from './AttributionBreakdown.vue'
import ActivityGrid from './ActivityGrid.vue'

defineProps<{ summary: AnalyticsSummary }>()
</script>

<template>
  <div class="overview">
    <div class="revenue-layout">
      <MetricCards :summary="summary" variant="recovered" class="recovered-summary" />
      <RevenueChart
        class="revenue-chart"
        :series="summary.series"
        :currency="summary.revenue.currency"
        :period="summary.period"
        :total="summary.revenue.confirmedRecovered"
      />
      <UiCard as="section" :padded="false" class="confirmed" aria-label="Подтверждённые оплаты">
        <h3><UiGlyph name="banknote" class="size-[18px] text-muted" />Подтверждённые оплаты</h3>
        <p class="confirmed-intro">Итоги в валюте организации · {{ summary.revenue.currency }}</p>
        <p class="confirmed-total" data-testid="confirmed-total">
          {{ formatMoney(summary.revenue.confirmed, summary.revenue.currency) ?? '—' }}
        </p>
        <p class="confirmed-hint">
          {{ summary.revenue.confirmedPayments }}
          {{ plural(summary.revenue.confirmedPayments, 'оплата', 'оплаты', 'оплат') }} · из них
          возвращено
          {{ formatMoney(summary.revenue.confirmedRecovered, summary.revenue.currency) ?? '—' }}
        </p>
        <AttributionBreakdown
          :attribution="summary.attribution"
          :currency="summary.revenue.currency"
        />
      </UiCard>
    </div>
    <div class="risk-section">
      <MetricCards :summary="summary" variant="risks" />
      <p class="note">
        Риски считаются по дате обнаружения, действия или закрытия. Это независимые показатели.
      </p>
    </div>
    <ActivityGrid :summary="summary" />
    <p class="note footer-note">
      Показатели отражают записанные факты. Оценки сделок и исходы не заменяют подтверждённые
      оплаты.
    </p>
  </div>
</template>

<style scoped>
.overview {
  min-width: 0;
}
.revenue-layout {
  display: grid;
  gap: 24px;
}
.revenue-chart {
  margin-top: -8px;
}
.confirmed {
  min-height: 588px;
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
.confirmed-intro {
  margin-top: 24px;
  color: var(--color-secondary);
  font-size: 14px;
  line-height: 20px;
}
.confirmed-total {
  margin-top: 24px;
  font-size: 36px;
  font-weight: 600;
  line-height: 44px;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.confirmed-hint {
  margin-top: 12px;
  margin-bottom: 24px;
  color: var(--color-secondary);
  font-size: 12px;
  line-height: 18px;
}
.risk-section {
  margin-top: 24px;
  margin-bottom: 24px;
}
.note {
  color: var(--color-secondary);
  font-size: 12px;
  line-height: 18px;
}
.risk-section .note {
  margin-top: 16px;
}
.footer-note {
  margin-top: 24px;
}
@media (min-width: 1200px) {
  .revenue-layout {
    grid-template-columns: minmax(0, 1.915fr) minmax(0, 1fr);
    gap: 16px 24px;
  }
  .recovered-summary {
    grid-column: 1;
    grid-row: 1;
  }
  .revenue-chart {
    grid-column: 1;
    grid-row: 2;
    margin-top: 0;
  }
  .confirmed {
    grid-column: 2;
    grid-row: 1 / 3;
  }
  .risk-section {
    margin-top: 36px;
    margin-bottom: 32px;
  }
  .footer-note {
    margin-top: 4px;
  }
}
</style>
