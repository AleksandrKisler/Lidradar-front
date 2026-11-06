<script setup lang="ts">
/** События по датам обнаружения, действия и закрытия; это не cohort precision. */
import { computed } from 'vue'
import { riskTypeLabel } from '@/entities/risk'
import type { AnalyticsRiskType } from '@/entities/report'

const props = defineProps<{ rows: AnalyticsRiskType[] }>()
const order: AnalyticsRiskType['riskType'][] = [
  'NO_RESPONSE',
  'CUSTOMER_SILENT_AFTER_PRICE',
  'BOOKING_NOT_CONFIRMED',
  'PROMISE_NOT_FULFILLED',
  'FOLLOW_UP_CANDIDATE',
  'UNFINISHED_AGREEMENT',
]
const types = computed(() =>
  order.map(
    (riskType) =>
      props.rows.find((row) => row.riskType === riskType) ?? {
        riskType,
        detected: 0,
        acted: 0,
        resolved: 0,
        falsePositive: 0,
      },
  ),
)
const metrics = [
  ['detected', 'Найдено'],
  ['acted', 'С действием'],
  ['resolved', 'Закрыто'],
  ['falsePositive', 'Ложных'],
] as const
</script>

<template>
  <div class="risk-types" role="list" aria-label="Риски по типам">
    <article v-for="row in types" :key="row.riskType" role="listitem" class="risk-type">
      <h3>{{ riskTypeLabel(row.riskType) }}</h3>
      <dl>
        <div v-for="[key, label] in metrics" :key="key">
          <dt>{{ label }}</dt>
          <dd>{{ row[key].toLocaleString('ru-RU') }}</dd>
        </div>
      </dl>
    </article>
  </div>
</template>

<style scoped>
.risk-types {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr);
}
.risk-type {
  min-width: 0;
  min-height: 178px;
  padding: 16px;
  border: 1px solid #cdd2db;
  border-radius: var(--radius-card);
  background: var(--color-paper);
}
h3 {
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  overflow-wrap: anywhere;
}
dl {
  display: grid;
  gap: 8px;
}
dl > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  line-height: 22px;
}
dt {
  min-width: 0;
  font-size: 15px;
  color: var(--color-secondary);
}
dd {
  font-size: 16px;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
@media (min-width: 640px) {
  .risk-types {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1280px) {
  .risk-types {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .risk-type {
    min-height: 210px;
  }
}
</style>
