<script setup lang="ts">
import { computed } from 'vue'
import { formatMoney, plural } from '@/shared/lib'
import { UiCard, UiGlyph } from '@/shared/ui'
import { recoveredPayments, type AnalyticsSummary } from '@/entities/report'

const props = withDefaults(
  defineProps<{ summary: AnalyticsSummary; variant?: 'all' | 'recovered' | 'risks' }>(),
  { variant: 'all' },
)
const recoveredCount = computed(() => recoveredPayments(props.summary))
const counters = computed(() => [
  {
    label: 'Найдено рисков',
    value: props.summary.risks.detected,
    hint: 'Обнаружены в выбранном периоде',
    icon: true,
  },
  { label: 'С действием', value: props.summary.risks.acted, hint: 'Действие записано в периоде' },
  {
    label: 'Закрыто рисков',
    value: props.summary.risks.resolved,
    hint: `Ложных срабатываний: ${props.summary.risks.falsePositive}`,
  },
])
</script>

<template>
  <div class="metrics" :class="`metrics--${variant}`">
    <UiCard
      v-if="variant !== 'risks'"
      class="recovered"
      :padded="false"
      aria-label="Возвращено и подтверждено"
    >
      <p class="metric-label">
        <UiGlyph name="banknote" class="size-4 text-muted" />Возвращено и подтверждено
      </p>
      <p class="metric-value recovered-value" data-testid="recovered-total">
        {{ formatMoney(summary.revenue.confirmedRecovered, summary.revenue.currency) ?? '—' }}
      </p>
      <p class="metric-hint">
        <template v-if="recoveredCount !== null"
          >{{ recoveredCount }} {{ plural(recoveredCount, 'оплата', 'оплаты', 'оплат') }} после
          работы с риском</template
        >
        <template v-else>Число оплат после работы с риском не определено</template>
      </p>
    </UiCard>
    <div
      v-if="variant !== 'recovered'"
      class="risk-metrics"
      role="list"
      aria-label="Показатели рисков"
    >
      <UiCard
        v-for="counter in counters"
        :key="counter.label"
        :padded="false"
        class="risk-metric"
        role="listitem"
      >
        <p class="metric-label">
          <UiGlyph v-if="counter.icon" name="circle-alert" class="size-4 text-muted" />{{
            counter.label
          }}
        </p>
        <p class="metric-value">{{ counter.value.toLocaleString('ru-RU') }}</p>
        <p class="metric-hint">{{ counter.hint }}</p>
      </UiCard>
    </div>
  </div>
</template>

<style scoped>
.metrics {
  min-width: 0;
}
.metrics--all {
  display: grid;
  gap: 24px;
}
.recovered,
.risk-metric {
  padding: 20px 24px;
  border-color: var(--color-analytics-line);
}
.recovered {
  min-height: 140px;
  background: var(--color-analytics-accent-surface);
  border-color: var(--color-analytics-accent-border);
}
.metric-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}
.metric-value {
  margin-top: 8px;
  font-size: 36px;
  font-weight: 600;
  line-height: 44px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.recovered-value {
  color: var(--color-brand);
}
.metric-hint {
  margin-top: 8px;
  color: var(--color-secondary);
  font-size: 12px;
  line-height: 18px;
}
.risk-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.risk-metric {
  min-height: 140px;
}
@media (min-width: 1200px) {
  .recovered {
    min-height: 160px;
  }
}
@media (max-width: 599px) {
  .risk-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
