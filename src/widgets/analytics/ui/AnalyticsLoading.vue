<script setup lang="ts">
/** Approved loading composition; unknown facts are never represented by numeric fixtures. */
import { computed } from 'vue'
import { riskTypeLabel, type RiskType } from '@/entities/risk'
import { UiCard, UiGlyph, UiSkeleton } from '@/shared/ui'
import metricIcon from './assets/quality-metric.svg?no-inline'

const props = defineProps<{
  variant: 'overview' | 'risk-events' | 'risk-precision' | 'payment-totals' | 'payment-journal'
  currency?: string
  /** The surrounding journal owns the timezone caption. */
  timeZone?: string
}>()
const riskTypes: readonly RiskType[] = [
  'NO_RESPONSE',
  'CUSTOMER_SILENT_AFTER_PRICE',
  'BOOKING_NOT_CONFIRMED',
  'PROMISE_NOT_FULFILLED',
  'FOLLOW_UP_CANDIDATE',
  'UNFINISHED_AGREEMENT',
]
const eventLabels = ['Найдено', 'С действием', 'Закрыто', 'Ложных']
const precisionLabels = ['Рисков', 'Оценено', 'Покрытие', 'Точность']
const typeLabels = computed(() =>
  props.variant === 'risk-events' ? eventLabels : [...precisionLabels, 'Ложные'],
)
const overviewRisks = ['Найдено рисков', 'С действием', 'Закрыто рисков']
const attribution = ['После работы с риском', 'Без связи с риском', 'Связь не определена']
const activityGroups = [
  {
    title: 'Сообщения',
    labels: ['Всего', 'Входящие', 'Исходящие', 'Новые переписки'],
    widths: [22, 21, 18, 11],
    hint: 'Сообщения — по дате отправки. Новые переписки — по первому сообщению.',
  },
  {
    title: 'Сделки',
    labels: ['Создано', 'Переход в запись', 'Выиграно', 'Потеряно'],
    widths: [11, 11, 154, 8],
    hint: 'События за период могут относиться к сделкам, созданным ранее.',
  },
  {
    title: 'Записанные исходы',
    labels: ['Запись', 'Оплачено', 'Потеря'],
    widths: [11, 11, 8],
    hint: 'Исход «Оплачено» сам по себе не подтверждает выручку.',
  },
]
const estimates = [
  'Открытые сделки, созданные в периоде',
  'Сделки с активным риском',
  'Известная оценка сделок с риском',
]
</script>

<template>
  <div v-if="variant === 'overview'" class="loading-overview">
    <div class="revenue-layout">
      <UiCard :padded="false" class="metric-card recovered overview-hero">
        <p class="metric-label">
          <UiGlyph name="banknote" class="size-4 text-muted" />Возвращено и подтверждено
        </p>
        <UiSkeleton class="placeholder metric-value" />
        <UiSkeleton class="placeholder metric-hint" />
      </UiCard>
      <UiCard as="section" :padded="false" class="chart-card">
        <h3><UiGlyph name="banknote" class="size-[18px] text-muted" />Возвращённая выручка</h3>
        <p class="description">
          Подтверждённые оплаты после работы с риском<template v-if="currency">
            · {{ currency }}</template
          >
        </p>
        <div class="chart-space" aria-hidden="true">
          <UiSkeleton class="placeholder chart-placeholder" />
        </div>
        <div class="chart-footer">
          <UiSkeleton class="placeholder chart-caption" />
          <button type="button" disabled class="days-button">Данные по дням</button>
        </div>
      </UiCard>
      <UiCard as="section" :padded="false" class="confirmed-card">
        <h3><UiGlyph name="banknote" class="size-[18px] text-muted" />Подтверждённые оплаты</h3>
        <p class="description">
          Итоги в валюте организации<template v-if="currency"> · {{ currency }}</template>
        </p>
        <div class="confirmed-total" aria-hidden="true">
          <UiSkeleton class="placeholder metric-value" /><UiSkeleton
            class="placeholder metric-hint"
          />
        </div>
        <dl class="attribution">
          <div
            v-for="(label, index) in attribution"
            :key="label"
            class="attribution-row"
            :class="{ unknown: index === 2 }"
          >
            <dt><span v-if="index === 0" class="recovered-dot" aria-hidden="true" />{{ label }}</dt>
            <dd><UiSkeleton class="placeholder metric-hint" /></dd>
          </div>
        </dl>
      </UiCard>
    </div>
    <div class="overview-risk-section">
      <div class="overview-risks">
        <UiCard
          v-for="(label, index) in overviewRisks"
          :key="label"
          :padded="false"
          class="metric-card"
        >
          <p class="metric-label">
            <UiGlyph v-if="index === 0" name="circle-alert" class="size-4 text-muted" />{{ label }}
          </p>
          <UiSkeleton class="placeholder metric-value" />
          <UiSkeleton class="placeholder metric-hint" />
        </UiCard>
      </div>
      <p class="note">
        Риски считаются по дате обнаружения, действия или закрытия. Это независимые показатели.
      </p>
    </div>
    <UiCard :padded="false" class="activity-grid">
      <section v-for="group in activityGroups" :key="group.title" class="activity-group">
        <h3>{{ group.title }}</h3>
        <dl>
          <div v-for="(label, index) in group.labels" :key="label" class="activity-row">
            <dt>{{ label }}</dt>
            <dd>
              <UiSkeleton
                class="placeholder activity-value"
                :style="{ width: `${group.widths[index]}px` }"
              />
            </dd>
          </div>
        </dl>
        <p class="note">{{ group.hint }}</p>
      </section>
    </UiCard>
    <UiCard as="section" :padded="false" class="estimates-card">
      <h3><UiGlyph name="banknote" class="size-[18px] text-muted" />Оценки сделок</h3>
      <p class="description">Оценки не являются выручкой и не входят в подтверждённые оплаты.</p>
      <dl class="estimates-grid">
        <div v-for="label in estimates" :key="label">
          <dt>{{ label }}</dt>
          <dd><UiSkeleton class="placeholder metric-value" /></dd>
        </div>
      </dl>
      <UiSkeleton class="placeholder metric-hint estimate-unknown" />
      <p class="note">
        Сделка с несколькими рисками учитывается один раз. Оценка — на текущий момент.
      </p>
    </UiCard>
    <p class="note overview-footer">
      Показатели отражают записанные факты. Оценки сделок и исходы не заменяют подтверждённые
      оплаты.
    </p>
  </div>
  <div
    v-else-if="variant === 'risk-events' || variant === 'risk-precision'"
    class="quality-loading"
    :class="variant"
  >
    <p v-if="variant === 'risk-precision'" class="note">Загружаем оценки за выбранный период…</p>
    <div class="quality-metrics">
      <div
        v-for="(label, index) in variant === 'risk-events' ? eventLabels : precisionLabels"
        :key="label"
        class="quality-metric"
        :class="{ accent: index === 0 }"
      >
        <p class="metric-label">
          <img :src="metricIcon" alt="" width="16" height="16" />{{ label }}
        </p>
        <UiSkeleton class="placeholder metric-value" />
        <UiSkeleton class="placeholder metric-hint" />
      </div>
    </div>
    <div class="quality-types">
      <article v-for="type in riskTypes" :key="type" class="quality-type">
        <h3>{{ riskTypeLabel(type) }}</h3>
        <dl>
          <div v-for="label in typeLabels" :key="label">
            <dt>{{ label }}</dt>
            <dd><UiSkeleton class="placeholder type-value" /></dd>
          </div>
        </dl>
        <div v-if="variant === 'risk-precision'" class="precision-basis" aria-hidden="true">
          <UiSkeleton class="placeholder" /><UiSkeleton class="placeholder" />
        </div>
      </article>
    </div>
    <p v-if="variant === 'risk-precision'" class="note">
      «—» означает, что оценок нет. Низкое покрытие не является ошибкой. Поздние вердикты могут
      уточнять отчёт.
    </p>
  </div>
  <div v-else-if="variant === 'payment-totals'" class="payment-totals">
    <UiCard
      v-for="(label, index) in ['Подтверждено', 'Из них возвращено']"
      :key="label"
      :padded="false"
      class="metric-card payment-total"
      :class="{ recovered: index === 1 }"
    >
      <p class="metric-label">
        <UiGlyph name="banknote" class="size-4 text-muted" />{{ label
        }}<template v-if="index === 0 && currency"> · {{ currency }}</template>
      </p>
      <UiSkeleton class="placeholder metric-value" /><UiSkeleton class="placeholder metric-hint" />
    </UiCard>
  </div>
  <div v-else class="payment-journal" aria-hidden="true">
    <div v-for="row in 4" :key="row" class="payment-row">
      <div class="payment-person">
        <UiSkeleton class="placeholder payment-title" /><UiSkeleton
          class="placeholder payment-service"
        />
      </div>
      <UiSkeleton class="placeholder payment-amount" />
      <UiSkeleton class="placeholder payment-date" />
      <UiSkeleton class="placeholder payment-attribution" />
      <UiSkeleton class="placeholder payment-links" />
    </div>
  </div>
</template>

<style scoped>
.placeholder {
  max-width: 100%;
  flex-shrink: 0;
  border-radius: 4px;
  background-color: #e1e7f0;
}
h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-ink);
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
  overflow-wrap: anywhere;
}
.metric-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}
.metric-card {
  min-width: 0;
  min-height: 140px;
  padding: 20px 24px;
  border-color: var(--color-analytics-line);
}
.metric-value {
  width: 180px;
  height: 24px;
  margin-top: 8px;
}
.metric-hint {
  width: 180px;
  height: 18px;
  margin-top: 28px;
}
.recovered {
  background: var(--color-analytics-accent-surface);
  border-color: var(--color-analytics-accent-border);
}
.description {
  color: var(--color-secondary);
  font-size: 14px;
  line-height: 20px;
}
.note {
  color: var(--color-secondary);
  font-size: 12px;
  line-height: 18px;
}
.revenue-layout {
  display: grid;
  gap: 24px;
}
.chart-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  margin-top: -8px;
  border-color: var(--color-analytics-line);
}
.chart-space {
  height: 220px;
  padding: 24px 12px 36px;
}
.chart-placeholder {
  width: 100%;
  height: 160px;
  border-radius: 8px;
}
.chart-footer {
  display: flex;
  min-height: 46px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.chart-caption {
  width: 180px;
  height: 18px;
}
.days-button {
  min-height: 46px;
  padding: 12px 24px;
  color: var(--color-secondary);
  opacity: 0.45;
  font-size: 17px;
  font-weight: 500;
  line-height: 22px;
}
.confirmed-card {
  min-height: 588px;
  padding: 24px;
  border-color: var(--color-analytics-line);
}
.confirmed-card > .description {
  margin-top: 24px;
}
.confirmed-total {
  margin-top: 24px;
  min-height: 74px;
}
.confirmed-total .metric-value {
  margin-top: 0;
}
.confirmed-total .metric-hint {
  margin-top: 32px;
}
.attribution {
  margin-top: 24px;
}
.attribution-row {
  padding: 24px 0;
  border-top: 1px solid var(--color-line);
}
.attribution-row dt {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  line-height: 22px;
}
.attribution-row .metric-hint {
  margin-top: 12px;
}
.unknown dt {
  color: var(--color-secondary);
}
.recovered-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-brand);
}
.overview-risk-section {
  margin-top: 24px;
  margin-bottom: 24px;
}
.overview-risks {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
.overview-risk-section .note {
  margin-top: 16px;
}
.activity-grid {
  display: grid;
  grid-template-columns: 1fr;
  overflow: hidden;
  border-color: var(--color-analytics-line);
}
.activity-group {
  min-width: 0;
  padding: 24px;
}
.activity-group + .activity-group {
  border-top: 1px solid var(--color-line);
}
.activity-group dl {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}
.activity-row {
  display: flex;
  min-width: 0;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.activity-row dt {
  min-width: 0;
  color: var(--color-secondary);
  font-size: 15px;
  line-height: 22px;
}
.activity-row dd {
  flex-shrink: 0;
  max-width: 48%;
}
.activity-value {
  height: 22px;
}
.activity-group .note {
  margin-top: 16px;
}
.estimates-card {
  margin-top: 24px;
  padding: 24px;
  border-color: var(--color-analytics-line);
}
.estimates-card > .description {
  margin-top: 16px;
}
.estimates-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 32px;
  margin-top: 16px;
  padding-top: 24px;
  border-top: 1px solid var(--color-line);
}
.estimates-grid dt {
  min-height: 44px;
  color: var(--color-secondary);
  font-size: 15px;
  line-height: 22px;
}
.estimates-grid .metric-value {
  margin-top: 12px;
}
.estimate-unknown {
  margin-top: 28px;
}
.estimates-card .note {
  margin-top: 16px;
}
.overview-footer {
  margin-top: 24px;
}
.quality-loading {
  display: grid;
  min-width: 0;
  gap: 16px;
}
.quality-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}
.quality-metric {
  min-width: 0;
  min-height: 140px;
  padding: 16px 12px;
  border-radius: 16px;
  background: #f5f7fa;
}
.quality-metric.accent {
  background: #eaf3ff;
}
.quality-metric .metric-label {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 400;
}
.quality-metric .metric-value,
.quality-metric .metric-hint {
  width: 150px;
}
.quality-metric .metric-label img {
  flex-shrink: 0;
}
.quality-types {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
.quality-type {
  min-width: 0;
  min-height: 178px;
  padding: 16px;
  border: 1px solid var(--color-analytics-line);
  border-radius: var(--radius-card);
  background: var(--color-paper);
}
.quality-type h3 {
  margin-bottom: 12px;
  font-size: 15px;
  line-height: 22px;
}
.quality-type dl {
  display: grid;
  gap: 8px;
}
.quality-type dl > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.quality-type dt {
  color: var(--color-secondary);
  font-size: 15px;
  line-height: 22px;
}
.quality-type dd {
  width: 30.2%;
  flex-shrink: 0;
}
.type-value {
  width: 100%;
  height: 22px;
}
.risk-precision .quality-type {
  min-height: 264px;
}
.precision-basis {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}
.precision-basis .placeholder {
  width: 150px;
  height: 18px;
}
.payment-totals {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}
.payment-total .metric-value {
  height: 28px;
  margin-top: 16px;
}
.payment-total .metric-hint {
  width: 160px;
  height: 12px;
  margin-top: 19px;
}
.payment-journal {
  display: grid;
  min-width: 0;
  grid-template-columns: 1fr;
  gap: 16px;
}
.payment-row {
  display: grid;
  min-width: 0;
  min-height: 230px;
  align-content: start;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  background: #eef0f4;
}
.payment-person {
  display: grid;
  gap: 16px;
  padding-top: 5px;
}
.payment-title,
.payment-service,
.payment-attribution {
  width: 180px;
  height: 14px;
}
.payment-amount {
  width: 130px;
  height: 20px;
}
.payment-date {
  width: 100px;
  height: 14px;
}
.payment-links {
  width: 160px;
  height: 14px;
  margin-top: 12px;
}
@media (max-width: 599px) {
  .chart-card {
    padding: 16px;
  }
  .chart-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .chart-caption {
    margin-top: 12px;
  }
}
@media (min-width: 600px) {
  .overview-risks,
  .activity-grid,
  .estimates-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .activity-group + .activity-group {
    border-top: 0;
    border-left: 1px solid var(--color-line);
  }
}
@media (min-width: 600px) and (max-width: 1199px) {
  .overview-risks .metric-card:first-child {
    min-height: 158px;
  }
}
@media (min-width: 640px) {
  .quality-types,
  .payment-totals,
  .payment-journal {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .payment-totals {
    gap: 16px;
  }
}
@media (min-width: 768px) {
  .quality-metrics {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }
  .quality-metric {
    padding: 20px 24px;
  }
  .quality-metric .metric-label {
    font-size: 13px;
  }
}
@media (min-width: 1200px) {
  .revenue-layout {
    grid-template-columns: minmax(0, 1.915fr) minmax(0, 1fr);
    gap: 16px 24px;
  }
  .overview-hero {
    grid-column: 1;
    grid-row: 1;
    min-height: 160px;
  }
  .chart-card {
    grid-column: 1;
    grid-row: 2;
    margin-top: 0;
  }
  .confirmed-card {
    grid-column: 2;
    grid-row: 1/3;
  }
  .overview-risk-section {
    margin-top: 36px;
    margin-bottom: 32px;
  }
  .estimates-card {
    margin-top: 64px;
  }
  .overview-footer {
    margin-top: 4px;
  }
}
@media (min-width: 1280px) {
  .quality-types {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .quality-type {
    min-height: 210px;
  }
  .risk-precision .quality-type {
    min-height: 276px;
  }
  .payment-journal {
    grid-template-columns: 1fr;
  }
  .payment-row {
    grid-template-columns: minmax(0, 304fr) minmax(0, 352fr) minmax(0, 160fr) minmax(0, 208fr);
    grid-template-rows: auto auto;
    min-height: 104px;
    align-content: center;
    align-items: center;
    column-gap: 16px;
    row-gap: 4px;
    padding: 16px 0;
    border-radius: 0;
    background: transparent;
  }
  .payment-person {
    grid-column: 1;
    grid-row: 1/3;
    gap: 11px;
    padding-top: 0;
  }
  .payment-attribution {
    grid-column: 2;
    grid-row: 1;
  }
  .payment-links {
    grid-column: 2;
    grid-row: 2;
    margin-top: 0;
  }
  .payment-date {
    grid-column: 3;
    grid-row: 1/3;
  }
  .payment-amount {
    grid-column: 4;
    grid-row: 1/3;
  }
}
</style>
