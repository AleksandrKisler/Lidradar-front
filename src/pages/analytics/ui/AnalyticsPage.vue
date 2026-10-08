<script setup lang="ts">
/**
 * Аналитика (макет 07): сводка, точность и оплаты за одно календарное окно.
 * Три запроса независимы — сбой одного показывает ошибку только своего блока.
 * Окно по умолчанию считается по поясу организации, поэтому запросы стартуют
 * после загрузки организации, а не дважды. Подпись периода берётся из ответа.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatCalendarDate, formatDateTime } from '@/shared/lib'
import { UiCard, UiErrorState, UiPageHeader, UiSkeleton } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import {
  defaultRange,
  rangeToInstants,
  useAnalyticsSummaryQuery,
  usePaymentsQuery,
  usePrecisionQuery,
  validateRange,
  type AnalyticsPeriod,
  type DateRange,
} from '@/entities/report'
import { PeriodPicker } from '@/features/select-analytics-period'
import {
  ActivityGrid,
  AttributionBreakdown,
  MetricCards,
  PaymentsTable,
  PrecisionTable,
  RevenueChart,
  RiskTypeTable,
} from '@/widgets/analytics'
import { parseRangeQuery, rangeToQuery } from '../model/range-query'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const tenantId = computed(() => session.tenantId)
const organization = useOrganizationQuery(tenantId)
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')

const range = computed<DateRange>(
  () => parseRangeQuery(route.query) ?? defaultRange(timeZone.value),
)
const rangeError = computed(() => validateRange(range.value))
/** Окно для запросов: только после организации и только допустимое. */
const activeRange = computed(() =>
  organization.data.value && rangeError.value === null ? range.value : null,
)
const instants = computed(() =>
  activeRange.value ? rangeToInstants(activeRange.value, timeZone.value) : null,
)

const summary = useAnalyticsSummaryQuery(tenantId, activeRange)
const precision = usePrecisionQuery(tenantId, instants)
const payments = usePaymentsQuery(tenantId, activeRange)

const paymentRows = computed(() => payments.data.value?.pages.flatMap((page) => page.items) ?? [])
const currency = computed(() => summary.data.value?.revenue.currency ?? '')

function periodCaption(period: AnalyticsPeriod): string {
  return `${formatCalendarDate(period.fromDate, { year: false })} – ${formatCalendarDate(period.toDate)} · ${period.timezone}`
}

function periodBounds(period: AnalyticsPeriod): string {
  return `UTC с ${formatDateTime(period.from, 'UTC')} до ${formatDateTime(period.to, 'UTC')} (исключительно)`
}

function setRange(next: DateRange): void {
  void router.replace({ query: rangeToQuery(next) })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiPageHeader
      title="От риска — к результату"
      subtitle="В показателях выручки учитываются подтверждения, а не предположения"
    />
    <UiCard>
      <PeriodPicker
        :range="range"
        :time-zone="timeZone"
        :error="rangeError"
        @update:range="setRange"
      />
      <p
        v-if="summary.data.value"
        class="mt-4 border-t border-line pt-4 text-sm text-ink"
        data-testid="analytics-period"
      >
        Период: {{ periodCaption(summary.data.value.period) }}
        <span class="block text-xs text-muted">{{ periodBounds(summary.data.value.period) }}</span>
      </p>
    </UiCard>

    <section aria-labelledby="summary-title" class="flex flex-col gap-4">
      <h2 id="summary-title" class="sr-only">Сводка</h2>
      <div v-if="rangeError" class="text-sm text-muted">
        Исправьте период, чтобы увидеть показатели.
      </div>
      <div v-else-if="summary.isPending.value" role="status" aria-label="Загрузка сводки">
        <UiSkeleton class="h-32 w-full" />
      </div>
      <UiErrorState
        v-else-if="summary.isError.value"
        :error="summary.error.value"
        title="Не удалось загрузить сводку"
        @retry="summary.refetch()"
      />
      <template v-else-if="summary.data.value">
        <MetricCards :summary="summary.data.value" />
        <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <UiCard as="section" aria-labelledby="chart-title" class="flex flex-col">
            <h2 id="chart-title" class="text-lg font-bold text-ink">Возвращённая выручка</h2>
            <p class="mt-1 text-sm text-muted">Только подтверждённые суммы · {{ currency }}</p>
            <div class="mt-4 flex flex-1 flex-col">
              <RevenueChart :series="summary.data.value.series" :currency="currency" />
            </div>
          </UiCard>
          <UiCard as="section" aria-labelledby="attribution-title">
            <h2 id="attribution-title" class="text-lg font-bold text-ink">
              Разделение подтверждённых оплат
            </h2>
            <div class="mt-4">
              <AttributionBreakdown
                :attribution="summary.data.value.attribution"
                :currency="currency"
              />
            </div>
          </UiCard>
        </div>
        <ActivityGrid :summary="summary.data.value" />
        <UiCard as="section" aria-labelledby="by-type-title">
          <h2 id="by-type-title" class="text-lg font-bold text-ink">Риски по типам</h2>
          <div class="mt-4">
            <RiskTypeTable :rows="summary.data.value.risks.byType" />
          </div>
        </UiCard>
      </template>
    </section>

    <UiCard as="section" aria-labelledby="precision-title">
      <h2 id="precision-title" class="text-lg font-bold text-ink">Точность сигналов</h2>
      <p class="mt-1 text-sm text-muted">
        По вердиктам команды: каждый риск учитывается один раз по последнему вердикту.
      </p>
      <div v-if="rangeError" class="mt-4 text-sm text-muted">Исправьте период.</div>
      <div
        v-else-if="precision.isPending.value"
        class="mt-4"
        role="status"
        aria-label="Загрузка точности"
      >
        <UiSkeleton class="h-24 w-full" />
      </div>
      <UiErrorState
        v-else-if="precision.isError.value"
        class="mt-4"
        :error="precision.error.value"
        title="Не удалось загрузить точность"
        @retry="precision.refetch()"
      />
      <div v-else-if="precision.data.value" class="mt-4">
        <PrecisionTable :report="precision.data.value" :time-zone="timeZone" />
      </div>
    </UiCard>

    <UiCard as="section" aria-labelledby="payments-title">
      <h2 id="payments-title" class="text-lg font-bold text-ink">Подтверждённые оплаты</h2>
      <p class="mt-1 text-sm text-muted">
        От новых к старым, каждая в своей валюте. Возвращённая выручка связана с риском, действием и
        результатом.
      </p>
      <div v-if="rangeError" class="mt-4 text-sm text-muted">Исправьте период.</div>
      <div
        v-else-if="payments.isPending.value"
        class="mt-4"
        role="status"
        aria-label="Загрузка оплат"
      >
        <UiSkeleton class="h-24 w-full" />
      </div>
      <UiErrorState
        v-else-if="payments.isError.value"
        class="mt-4"
        :error="payments.error.value"
        title="Не удалось загрузить оплаты"
        @retry="payments.refetch()"
      />
      <div v-else class="mt-4">
        <PaymentsTable
          :items="paymentRows"
          :has-more="payments.hasNextPage.value"
          :loading-more="payments.isFetchingNextPage.value"
          :time-zone="timeZone"
          @more="payments.fetchNextPage()"
        />
      </div>
    </UiCard>
  </div>
</template>
