<script setup lang="ts">
/**
 * Заглавные показатели окна (макет 07). Деньги — только подтверждённые суммы
 * в валюте ответа; доли считаются от найденных рисков и не показываются без
 * знаменателя.
 */
import { computed } from 'vue'
import { formatMoney } from '@/shared/lib'
import { UiCard } from '@/shared/ui'
import {
  activityRates,
  formatPercent,
  recoveredPayments,
  type AnalyticsSummary,
} from '@/entities/report'

const props = defineProps<{ summary: AnalyticsSummary }>()

const rates = computed(() => activityRates(props.summary))
const recovered = computed(
  () =>
    formatMoney(props.summary.revenue.confirmedRecovered, props.summary.revenue.currency) ?? '—',
)
const recoveredCount = computed(() => recoveredPayments(props.summary))

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="list" aria-label="Главные показатели">
    <UiCard as="div" role="listitem">
      <p class="text-sm text-muted">Найдено рисков</p>
      <p class="mt-2 text-3xl font-bold text-ink tabular-nums">{{ summary.risks.detected }}</p>
      <p class="mt-2 text-xs text-muted">За выбранный период</p>
    </UiCard>
    <UiCard as="div" role="listitem">
      <p class="text-sm text-muted">Команда отреагировала</p>
      <p class="mt-2 text-3xl font-bold text-ink tabular-nums">{{ summary.risks.acted }}</p>
      <p class="mt-2 text-xs text-muted">
        Есть записанное действие<template v-if="rates.acted !== null">
          · {{ formatPercent(rates.acted) }} найденных</template
        >
      </p>
    </UiCard>
    <UiCard as="div" role="listitem">
      <p class="text-sm text-muted">Риски закрыты</p>
      <p class="mt-2 text-3xl font-bold text-ink tabular-nums">{{ summary.risks.resolved }}</p>
      <p class="mt-2 text-xs text-muted">
        Из найденных за период<template v-if="summary.risks.falsePositive > 0">
          · ложных срабатываний: {{ summary.risks.falsePositive }}</template
        >
      </p>
    </UiCard>
    <div class="rounded-card bg-nav p-5 text-white md:p-6" role="listitem">
      <p class="text-sm text-white/80">Возвращено и подтверждено</p>
      <p class="mt-2 text-3xl font-bold tabular-nums">{{ recovered }}</p>
      <p class="mt-2 text-xs text-brand-pale">
        <template v-if="recoveredCount !== null">
          {{ recoveredCount }} {{ plural(recoveredCount, 'оплата', 'оплаты', 'оплат') }} со связью с
          рисками
        </template>
        <template v-else>Только подтверждённые суммы</template>
      </p>
    </div>
  </div>
</template>
