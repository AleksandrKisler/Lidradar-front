<script setup lang="ts">
/** Последний вердикт по каждому риску когорты; KPI — сумма TP / сумма TP+FP. */
import { computed } from 'vue'
import { riskTypeLabel } from '@/entities/risk'
import {
  formatPercent,
  ratio,
  type RiskPrecisionItem,
  type RiskPrecisionReport,
} from '@/entities/report'
import metricIcon from './assets/quality-metric.svg?no-inline'

const props = defineProps<{ report: RiskPrecisionReport; timeZone: string }>()
const order: RiskPrecisionItem['riskType'][] = [
  'NO_RESPONSE',
  'CUSTOMER_SILENT_AFTER_PRICE',
  'BOOKING_NOT_CONFIRMED',
  'PROMISE_NOT_FULFILLED',
  'FOLLOW_UP_CANDIDATE',
  'UNFINISHED_AGREEMENT',
]
const items = computed(() =>
  order.map(
    (riskType) =>
      props.report.items.find((item) => item.riskType === riskType) ?? {
        riskType,
        totalRisks: 0,
        withFeedback: 0,
        truePositives: 0,
        falsePositives: 0,
        precision: null,
        falsePositiveRate: null,
        coverageRate: 0,
        reliable: false,
      },
  ),
)
const totals = computed(() =>
  props.report.items.reduce(
    (sum, item) => ({
      risks: sum.risks + item.totalRisks,
      feedback: sum.feedback + item.withFeedback,
      tp: sum.tp + item.truePositives,
      fp: sum.fp + item.falsePositives,
    }),
    { risks: 0, feedback: 0, tp: 0, fp: 0 },
  ),
)
const metrics = computed(() => [
  { label: 'Рисков', value: count(totals.value.risks), hint: 'Обнаружены в периоде' },
  { label: 'Оценено', value: count(totals.value.feedback), hint: 'Рисков с оценкой' },
  {
    label: 'Покрытие',
    value: formatPercent(ratio(totals.value.feedback, totals.value.risks) ?? 0),
    hint: `${count(totals.value.feedback)} из ${count(totals.value.risks)}`,
  },
  {
    label: 'Точность',
    value: formatPercent(ratio(totals.value.tp, totals.value.tp + totals.value.fp)),
    hint:
      totals.value.tp + totals.value.fp > 0
        ? `${count(totals.value.tp)} из ${count(totals.value.tp + totals.value.fp)}`
        : 'Нет вердиктов',
  },
])
function count(value: number) {
  return value.toLocaleString('ru-RU')
}
function date(value: string, exclusive = false) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: props.timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.parse(value) - (exclusive ? 1 : 0)))
}
function basis(item: RiskPrecisionItem) {
  if (item.totalRisks === 0) return 'Рисков за период нет'
  if (item.withFeedback === 0) return 'Нет вердиктов'
  if (!item.reliable)
    return `Недостаточно оценок · ${count(item.withFeedback)} из ${count(item.totalRisks)}`
  return `Подтверждено: ${count(item.truePositives)} · Ложных: ${count(item.falsePositives)}`
}
function values(item: RiskPrecisionItem) {
  return [
    ['Рисков', count(item.totalRisks)],
    ['Оценено', count(item.withFeedback)],
    ['Покрытие', formatPercent(item.coverageRate)],
    ['Точность', formatPercent(item.precision)],
    ['Ложные', formatPercent(item.falsePositiveRate)],
  ]
}
</script>

<template>
  <div class="precision-content">
    <p class="window">
      Окно обнаружения: {{ date(report.from) }} — {{ date(report.to, true) }}. Порог текущего
      отчёта: {{ formatPercent(report.minimumCoverage) }}.
    </p>
    <div class="precision-metrics" role="list" aria-label="Сводка точности">
      <div
        v-for="(metric, index) in metrics"
        :key="metric.label"
        role="listitem"
        class="precision-metric"
        :class="{ accent: index === 0 }"
      >
        <p class="metric-label">
          <img :src="metricIcon" alt="" width="16" height="16" />{{ metric.label }}
        </p>
        <p class="metric-value">{{ metric.value }}</p>
        <p class="metric-hint">{{ metric.hint }}</p>
      </div>
    </div>
    <div class="precision-types" role="list" aria-label="Точность сигналов по типам">
      <article
        v-for="item in items"
        :key="item.riskType"
        role="listitem"
        class="precision-type"
        :class="{ empty: item.withFeedback === 0, low: item.withFeedback > 0 && !item.reliable }"
      >
        <h3>{{ riskTypeLabel(item.riskType) }}</h3>
        <dl>
          <div v-for="[label, value] in values(item)" :key="label">
            <dt>{{ label }}</dt>
            <dd>
              {{ value }}<span v-if="value === '—'" class="sr-only"> Недостаточно данных</span>
            </dd>
          </div>
        </dl>
        <p class="basis-label">Основание</p>
        <p class="basis">
          {{ basis(item)
          }}<span v-if="!item.reliable && item.withFeedback > 0" class="sr-only">
            · низкое покрытие</span
          >
        </p>
      </article>
    </div>
    <p class="precision-note">
      «—» означает, что оценок нет. Низкое покрытие не является ошибкой. Поздние вердикты могут
      уточнять отчёт.
    </p>
  </div>
</template>

<style scoped>
.precision-content {
  display: grid;
  min-width: 0;
  gap: 16px;
}
.window,
.basis-label,
.basis,
.precision-note {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-secondary);
}
.precision-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}
.precision-metric {
  min-width: 0;
  min-height: 140px;
  padding: 16px 12px;
  display: grid;
  align-content: start;
  gap: 8px;
  border-radius: 16px;
  background: #f5f7fa;
}
.precision-metric.accent {
  background: #eaf3ff;
}
.metric-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 20px;
  color: var(--color-muted);
}
.metric-label img {
  flex-shrink: 0;
}
.metric-value {
  font-size: 30px;
  font-weight: 600;
  line-height: 36px;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.accent .metric-value {
  color: #0066dc;
}
.metric-hint {
  color: var(--color-muted);
  font-size: 12px;
  line-height: 18px;
}
.precision-types {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr);
}
.precision-type {
  min-width: 0;
  min-height: 264px;
  padding: 16px;
  border: 1px solid #cdd2db;
  border-radius: var(--radius-card);
  background: var(--color-paper);
}
.precision-type.empty {
  background: #f5f7fa;
}
.precision-type.low {
  background: #fff7e6;
}
h3 {
  margin-bottom: 12px;
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
dl {
  display: grid;
  gap: 8px;
}
dl > div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  line-height: 22px;
}
dt {
  color: var(--color-secondary);
  font-size: 15px;
}
dd {
  font-size: 16px;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.basis-label {
  margin-top: 12px;
}
.basis {
  margin-top: 8px;
}
.low .basis {
  color: #945200;
}
@media (min-width: 768px) {
  .precision-metrics {
    gap: 16px;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .precision-metric {
    padding: 20px 24px;
  }
  .metric-label {
    font-size: 13px;
  }
  .metric-value {
    font-size: 36px;
    line-height: 44px;
  }
}
@media (min-width: 640px) {
  .precision-types {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1280px) {
  .precision-types {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .precision-type {
    min-height: 276px;
  }
}
</style>
