<script setup lang="ts">
import type { AnalyticsSummary, Payment } from '@/entities/report'
import { formatMoney } from '@/shared/lib'
import { UiCard, UiGlyph } from '@/shared/ui'
import PaymentsTable from './PaymentsTable.vue'

defineProps<{
  summary?: AnalyticsSummary | undefined
  items: Payment[]
  hasMore: boolean
  loadingMore: boolean
  timeZone: string
  nextError?: unknown
  invalidCursor?: boolean | undefined
}>()
const emit = defineEmits<{
  more: []
  reset: []
  navigate: [context: { eventId: string; link?: string }]
}>()
</script>

<template>
  <div class="payments-panel">
    <div v-if="summary" class="payments-summary" aria-label="Итоги оплат за период">
      <UiCard class="payment-metric" :padded="false">
        <p class="payment-metric-label">
          <UiGlyph name="banknote" class="size-[18px] text-muted" />
          Подтверждено · {{ summary.revenue.currency }}
        </p>
        <p class="payment-metric-value">
          {{ formatMoney(summary.revenue.confirmed, summary.revenue.currency) ?? '—' }}
        </p>
        <p class="payment-metric-hint">В валюте организации</p>
      </UiCard>
      <UiCard class="payment-metric payment-metric-recovered" :padded="false">
        <p class="payment-metric-label">
          <UiGlyph name="banknote" class="size-[18px] text-muted" />
          Из них возвращено
        </p>
        <p class="payment-metric-value">
          {{ formatMoney(summary.revenue.confirmedRecovered, summary.revenue.currency) ?? '—' }}
        </p>
        <p class="payment-metric-hint">Со связью с работой по риску</p>
      </UiCard>
    </div>
    <slot v-else name="summary-state" />
    <p class="payments-note">
      «Из них возвращено» — выручка после работы с риском, не возврат денег клиенту.
    </p>
    <UiCard
      as="section"
      class="payments-journal"
      :padded="false"
      aria-label="Журнал подтверждённых оплат"
    >
      <h3 id="analytics-payments-journal" class="payments-heading" tabindex="-1">
        <UiGlyph name="banknote" class="size-[18px] text-muted" />
        Журнал подтверждённых оплат
      </h3>
      <p class="payments-subtitle">
        От новых к старым · даты и время по часовому поясу организации
      </p>
      <p class="payments-note">
        Итоги — за весь период<template v-if="summary"
          >, только {{ summary.revenue.currency }}</template
        >. Журнал может быть загружен частично; валюты не пересчитываются.
      </p>
      <slot name="payments-state">
        <PaymentsTable
          :items="items"
          :has-more="hasMore"
          :loading-more="loadingMore"
          :time-zone="timeZone"
          :next-error="nextError"
          :invalid-cursor="invalidCursor"
          @more="emit('more')"
          @reset="emit('reset')"
          @navigate="emit('navigate', $event)"
        />
      </slot>
    </UiCard>
    <p class="payments-note">
      Показатели отражают записанные факты. Оценки сделок и исходы не заменяют подтверждённые
      оплаты.
    </p>
  </div>
</template>

<style scoped>
.payments-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 24px;
}
.payments-summary {
  display: grid;
  gap: 24px;
}
.payment-metric {
  display: flex;
  min-height: 140px;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 20px 24px;
  border-color: #cdd2db;
  overflow-wrap: anywhere;
}
.payment-metric-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}
.payment-metric-value {
  font-size: 36px;
  font-weight: 600;
  line-height: 44px;
  font-variant-numeric: tabular-nums;
}
.payment-metric-hint,
.payments-note {
  color: #565b64;
  font-size: 12px;
  line-height: 18px;
}
.payment-metric-recovered {
  border-color: #b6cff2;
  background: #eff5ff;
}
.payment-metric-recovered .payment-metric-value {
  color: #0071e3;
}
.payments-journal {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border-color: #cdd2db;
}
.payments-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}
.payments-subtitle {
  color: #565b64;
  font-size: 14px;
  line-height: 22px;
}
@media (min-width: 640px) {
  .payments-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  .payments-journal {
    padding: 24px;
  }
}
</style>
