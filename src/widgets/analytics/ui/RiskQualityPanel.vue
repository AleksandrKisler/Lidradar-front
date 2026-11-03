<script setup lang="ts">
import { computed } from 'vue'
import type { AnalyticsSummary, RiskPrecisionReport } from '@/entities/report'
import { UiCard } from '@/shared/ui'
import RiskTypeTable from './RiskTypeTable.vue'
import PrecisionTable from './PrecisionTable.vue'
import headingIcon from './assets/quality-heading.svg?no-inline'
import metricIcon from './assets/quality-metric.svg?no-inline'

const props = defineProps<{
  summary?: AnalyticsSummary | undefined
  report?: RiskPrecisionReport | undefined
  timeZone: string
}>()
const metrics = computed(() =>
  props.summary
    ? [
        { label: 'Найдено', value: props.summary.risks.detected, hint: '6 типов рисков' },
        { label: 'С действием', value: props.summary.risks.acted, hint: 'По дате действия' },
        { label: 'Закрыто', value: props.summary.risks.resolved, hint: 'По дате закрытия' },
        { label: 'Ложных', value: props.summary.risks.falsePositive, hint: 'За выбранный период' },
      ]
    : [],
)
</script>

<template>
  <div class="quality-panel">
    <UiCard as="section" :padded="false" class="quality-section" aria-label="Риски по типам">
      <h2><img :src="headingIcon" alt="" width="16" height="16" />Риски по типам</h2>
      <p class="section-description">
        Найдено — по обнаружению; действие и закрытие — по дате соответствующего события.
      </p>
      <slot name="summary-state" />
      <template v-if="summary">
        <div class="event-metrics" role="list" aria-label="Сводка событий рисков">
          <div
            v-for="(metric, index) in metrics"
            :key="metric.label"
            role="listitem"
            class="event-metric"
            :class="{ accent: index === 0 }"
          >
            <p class="metric-label">
              <img :src="metricIcon" alt="" width="16" height="16" />{{ metric.label }}
            </p>
            <p class="metric-value">{{ metric.value.toLocaleString('ru-RU') }}</p>
            <p class="metric-hint">{{ metric.hint }}</p>
          </div>
        </div>
        <RiskTypeTable :rows="summary.risks.byType" />
      </template>
    </UiCard>
    <UiCard
      as="section"
      :padded="false"
      class="quality-section"
      aria-label="Точность по оценкам команды"
    >
      <h2><img :src="headingIcon" alt="" width="16" height="16" />Точность по оценкам команды</h2>
      <p class="section-description">
        Каждый обнаруженный риск учитывается один раз по последнему вердикту команды.
      </p>
      <slot name="precision-state" />
      <PrecisionTable v-if="report" :report="report" :time-zone="timeZone" />
    </UiCard>
    <p class="quality-footer">
      Показатели отражают записанные факты. Оценки сделок и исходы не заменяют подтверждённые
      оплаты.
    </p>
  </div>
</template>

<style scoped>
/* Error content replaces the metrics; approved E states retain a 24px bottom inset. */
.quality-section:has(:deep([role='alert'])) {
  padding-bottom: 24px;
}
.quality-footer {
  color: var(--color-secondary);
  font-size: 12px;
  line-height: 18px;
}
.quality-panel {
  display: grid;
  gap: 24px;
  min-width: 0;
}
.quality-section {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 24px 15px;
  border-color: #cdd2db;
}
h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}
h2 img,
.metric-label img {
  flex-shrink: 0;
}
.section-description {
  font-size: 14px;
  line-height: 20px;
  color: var(--color-secondary);
}
.event-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 12px;
}
.event-metric {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
  min-height: 140px;
  padding: 16px 12px;
  border-radius: 16px;
  background: #f5f7fa;
}
.event-metric.accent {
  background: #eaf3ff;
}
.metric-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
}
.metric-value {
  font-size: 30px;
  font-weight: 600;
  line-height: 36px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.accent .metric-value {
  color: #0066dc;
}
.metric-hint {
  color: var(--color-muted);
  font-size: 12px;
  line-height: 18px;
}
@media (min-width: 640px) {
  .quality-section {
    padding: 24px;
  }
}
@media (min-width: 768px) {
  .event-metrics {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }
  .event-metric {
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
@media (min-width: 1280px) {
  .quality-section {
    padding-bottom: 36px;
  }
}
</style>
