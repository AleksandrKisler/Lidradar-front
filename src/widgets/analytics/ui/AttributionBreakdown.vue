<script setup lang="ts">
import { formatMoney, plural } from '@/shared/lib'
import type { AnalyticsAttributionSplit } from '@/entities/report'

defineProps<{ attribution: AnalyticsAttributionSplit[]; currency: string }>()
const captions: Record<AnalyticsAttributionSplit['type'], string> = {
  RECOVERED: 'После работы с риском',
  ORGANIC: 'Без связи с риском',
  UNKNOWN: 'Связь не определена',
}
</script>

<template>
  <dl class="attribution">
    <div
      v-for="row in attribution"
      :key="row.type"
      class="attribution-row"
      :class="{ unknown: row.type === 'UNKNOWN' }"
    >
      <dt>
        <span v-if="row.type === 'RECOVERED'" class="recovered-dot" aria-hidden="true" />{{
          captions[row.type]
        }}
      </dt>
      <dd>
        <span data-testid="attribution-amount">{{ formatMoney(row.amount, currency) ?? '—' }}</span>
        · {{ row.count }} {{ plural(row.count, 'оплата', 'оплаты', 'оплат') }}
      </dd>
    </div>
  </dl>
</template>

<style scoped>
.attribution-row {
  padding: 24px 0;
  border-top: 1px solid var(--color-line);
}
dt {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  line-height: 22px;
}
.recovered-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-brand);
}
.unknown dt {
  color: var(--color-secondary);
}
dd {
  margin-top: 12px;
  color: var(--color-secondary);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
</style>
