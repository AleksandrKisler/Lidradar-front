<script setup lang="ts">
/** Three views share one organization/calendar window and independent query families. */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { isApiError } from '@/shared/api'
import { formatCalendarDate } from '@/shared/lib'
import { UiErrorState, UiGlyph } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import {
  analyticsKeys,
  defaultRange,
  rangeToInstants,
  useAnalyticsSummaryQuery,
  usePaymentsQuery,
  usePrecisionQuery,
  validateRange,
  type DateRange,
  type Payment,
} from '@/entities/report'
import { PeriodPicker } from '@/features/select-analytics-period'
import {
  OverviewPanel,
  RiskQualityPanel,
  PaymentsPanel,
  AnalyticsLoading,
  AnalyticsError,
} from '@/widgets/analytics'
import { parseRangeQuery, rangeToQuery } from '../model/range-query'
import { readAnalyticsReturn, saveAnalyticsReturn } from '../model/return-state'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const tenantId = computed(() => (session.can('analytics.read') ? session.tenantId : null))
const organization = useOrganizationQuery(tenantId)
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')
const range = computed<DateRange>(
  () => parseRangeQuery(route.query) ?? defaultRange(timeZone.value),
)
const rangeError = computed(() => validateRange(range.value))
const activeRange = computed(() =>
  organization.data.value && !organization.isError.value && !rangeError.value && tenantId.value
    ? range.value
    : null,
)
const instants = computed(() =>
  activeRange.value ? rangeToInstants(activeRange.value, timeZone.value) : null,
)
const currency = computed(() => organization.data.value?.defaultCurrency ?? '—')
const periodDescription = computed(() => {
  const { from, to } = range.value
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${Number(from.slice(8))}–${formatCalendarDate(to, { year: false })}`
    : `${formatCalendarDate(from, { year: false })} – ${formatCalendarDate(to, { year: false })}`
})
const overviewErrorDescription = computed(
  () =>
    `Данные за ${periodDescription.value} сейчас недоступны. Проверьте соединение и повторите запрос.`,
)
const summary = useAnalyticsSummaryQuery(tenantId, activeRange)
const precision = usePrecisionQuery(tenantId, instants)
const payments = usePaymentsQuery(tenantId, activeRange)
const summaryData = computed(() => (!summary.isError.value ? summary.data.value : undefined))
const precisionData = computed(() => (!precision.isError.value ? precision.data.value : undefined))
const initialPaymentsError = computed(
  () => payments.isError.value && !payments.isFetchNextPageError.value,
)
const paymentRows = computed(() => {
  if (initialPaymentsError.value) return []
  const unique = new Map<string, Payment>()
  for (const page of payments.data.value?.pages ?? [])
    for (const item of page.items) if (!unique.has(item.eventId)) unique.set(item.eventId, item)
  return [...unique.values()]
})
const invalidCursor = computed(
  () =>
    payments.isFetchNextPageError.value &&
    isApiError(payments.error.value) &&
    payments.error.value.httpStatus === 400 &&
    payments.error.value.code === 'INVALID_ARGUMENT',
)
const tabs = [
  { id: 'overview', label: 'Обзор' },
  { id: 'quality', label: 'Риски и качество' },
  { id: 'payments', label: 'Оплаты' },
] as const
const activeTab = computed(() =>
  tabs.some((tab) => tab.id === route.query.tab) ? String(route.query.tab) : 'overview',
)
const refreshing = computed(
  () => summary.isFetching.value || precision.isFetching.value || payments.isFetching.value,
)
const pageDescription = computed(() => {
  const ready = 'Результаты работы с рисками и подтверждённые оплаты'
  if (!tenantId.value || rangeError.value || organization.isError.value) return ready
  if (activeTab.value === 'overview') {
    if (summary.isPending.value) return 'Загружаем сводку за выбранный период…'
    if (summary.data.value && summary.isFetching.value)
      return `Обновляем сводку за ${periodDescription.value}…`
  } else if (activeTab.value === 'quality') {
    if (summary.isPending.value && precision.isPending.value)
      return 'Загружаем риски и оценки за выбранный период…'
    if (summary.isError.value && precision.isError.value) return 'Данные блоков пока недоступны.'
    if (
      !summary.isPending.value &&
      !precision.isPending.value &&
      (summary.data.value || precision.data.value) &&
      (summary.isFetching.value || precision.isFetching.value)
    )
      return 'Обновляем риски и оценки текущего периода…'
  } else {
    if (summary.isPending.value && payments.isPending.value)
      return 'Загружаем итоги и журнал за выбранный период…'
    if (summary.isError.value && initialPaymentsError.value)
      return 'Итоги и журнал пока недоступны.'
    if (
      !summary.isPending.value &&
      !payments.isPending.value &&
      (summary.data.value || payments.data.value) &&
      (summary.isFetching.value ||
        (payments.isFetching.value && !payments.isFetchingNextPage.value))
    )
      return 'Обновляем итоги и журнал текущего периода…'
  }
  return ready
})
const identity = computed(
  () => `${session.user?.id ?? ''}:${tenantId.value ?? ''}:${session.role ?? ''}`,
)
const selectedPayment = ref<string | null>(null)

function setRange(next: DateRange): void {
  void router.replace({ query: rangeToQuery(next, route.query) })
}
function setTab(tab: string): void {
  void router.replace({ query: { ...route.query, tab } })
}
function tabKey(event: KeyboardEvent, index: number): void {
  let next: number
  if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
  else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = tabs.length - 1
  else return
  event.preventDefault()
  setTab(tabs[next]!.id)
  document.getElementById(`analytics-tab-${tabs[next]!.id}`)?.focus()
}
function refresh(): void {
  if (!activeRange.value) return
  void summary.refetch()
  void precision.refetch()
  void payments.refetch()
}
async function resetPayments(): Promise<void> {
  if (!tenantId.value || !activeRange.value) return
  document.getElementById('analytics-payments-journal')?.scrollIntoView({ block: 'start' })
  await queryClient.resetQueries({
    queryKey: analyticsKeys.payments(tenantId.value, activeRange.value),
    exact: true,
  })
}
function rememberPayment({ eventId, link }: { eventId: string; link?: string }): void {
  selectedPayment.value = `${eventId}:${link ?? 'risk'}`
}
onBeforeRouteLeave(() => {
  saveAnalyticsReturn({
    identity: identity.value,
    path: route.fullPath,
    top: window.scrollY,
    eventId: selectedPayment.value,
  })
})
watch(identity, () => {
  selectedPayment.value = null
})
onMounted(() => {
  const saved = readAnalyticsReturn(identity.value, route.fullPath)
  if (
    !saved ||
    !tenantId.value ||
    !activeRange.value ||
    !queryClient.getQueryData(analyticsKeys.payments(tenantId.value, activeRange.value))
  )
    return
  const stop = watch(
    () => payments.data.value,
    async (data) => {
      if (!data) return
      await nextTick()
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (
            identity.value !== saved.identity ||
            route.fullPath !== saved.path ||
            !session.can('analytics.read')
          )
            return
          window.scrollTo({ top: saved.top })
          if (saved.eventId)
            document
              .querySelector<HTMLElement>(`[data-payment-link="${CSS.escape(saved.eventId)}"]`)
              ?.focus({ preventScroll: true })
        }),
      )
    },
    { immediate: true, once: true },
  )
  void stop
})
</script>

<template>
  <div class="flex min-w-0 flex-col gap-6">
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h1
          class="text-2xl leading-8 font-semibold md:text-[34px] md:leading-[42px] lg:text-[38px] lg:leading-[46px]"
        >
          Аналитика
        </h1>
        <p class="mt-1 text-sm leading-[22px] text-secondary md:text-note">
          {{ pageDescription }}
        </p>
      </div>
      <button
        type="button"
        class="flex size-[46px] shrink-0 items-center justify-center rounded-full border border-line bg-paper hover:bg-canvas disabled:opacity-50"
        aria-label="Обновить аналитику"
        :aria-busy="refreshing"
        :disabled="refreshing || !activeRange"
        @click="refresh"
      >
        <UiGlyph name="refresh" class="size-5" />
      </button>
    </header>
    <UiErrorState
      v-if="organization.isError.value"
      :error="organization.error.value"
      title="Организация недоступна"
      @retry="organization.refetch()"
    />
    <template v-else>
      <PeriodPicker
        :key="tenantId ?? ''"
        :range="range"
        :time-zone="timeZone"
        :error="rangeError"
        @update:range="setRange"
      />
      <div
        class="grid w-full max-w-[516px] grid-cols-[minmax(0,140fr)_minmax(0,220fr)_minmax(0,140fr)] gap-1 rounded-control bg-line p-1"
        role="tablist"
        aria-label="Разделы аналитики"
      >
        <button
          v-for="(tab, index) in tabs"
          :id="`analytics-tab-${tab.id}`"
          :key="tab.id"
          role="tab"
          type="button"
          class="min-h-[46px] min-w-0 rounded-control px-2 text-sm font-medium"
          :class="activeTab === tab.id ? 'bg-paper text-brand' : 'text-secondary hover:bg-paper/50'"
          :aria-selected="activeTab === tab.id"
          :aria-controls="`analytics-panel-${tab.id}`"
          :tabindex="activeTab === tab.id ? 0 : -1"
          @click="setTab(tab.id)"
          @keydown="tabKey($event, index)"
        >
          {{ tab.label }}
        </button>
      </div>
      <p v-if="rangeError" class="text-sm text-secondary">
        Исправьте период, чтобы увидеть показатели.
      </p>
      <section
        v-else
        :id="`analytics-panel-${activeTab}`"
        role="tabpanel"
        :aria-labelledby="`analytics-tab-${activeTab}`"
        class="min-w-0"
        tabindex="0"
      >
        <template v-if="activeTab === 'overview'">
          <AnalyticsError
            v-if="summary.isError.value"
            :error="summary.error.value"
            title="Не удалось загрузить сводку"
            :description="overviewErrorDescription"
            @retry="summary.refetch()"
          />
          <OverviewPanel v-else-if="summaryData" :summary="summaryData" />
          <div v-else role="status" aria-label="Загрузка сводки">
            <AnalyticsLoading variant="overview" :currency="currency" :time-zone="timeZone" />
          </div>
        </template>
        <RiskQualityPanel
          v-else-if="activeTab === 'quality'"
          :summary="summaryData"
          :report="precisionData"
          :time-zone="timeZone"
        >
          <template v-if="!summaryData" #summary-state>
            <AnalyticsError
              v-if="summary.isError.value"
              :error="summary.error.value"
              title="Не удалось загрузить риски"
              embedded
              @retry="summary.refetch()"
            />
            <div v-else role="status" aria-label="Загрузка сводки">
              <AnalyticsLoading variant="risk-events" :currency="currency" />
            </div>
          </template>
          <template v-if="!precisionData" #precision-state>
            <AnalyticsError
              v-if="precision.isError.value"
              :error="precision.error.value"
              title="Не удалось загрузить оценки"
              embedded
              @retry="precision.refetch()"
            />
            <div v-else role="status" aria-label="Загрузка точности">
              <AnalyticsLoading variant="risk-precision" :time-zone="timeZone" />
            </div>
          </template>
        </RiskQualityPanel>
        <PaymentsPanel
          v-else
          :summary="summaryData"
          :items="paymentRows"
          :has-more="payments.hasNextPage.value"
          :loading-more="payments.isFetchingNextPage.value"
          :time-zone="timeZone"
          :next-error="payments.isFetchNextPageError.value ? payments.error.value : undefined"
          :invalid-cursor="invalidCursor"
          @more="payments.fetchNextPage()"
          @reset="resetPayments"
          @navigate="rememberPayment"
        >
          <template v-if="!summaryData" #summary-state>
            <AnalyticsError
              v-if="summary.isError.value"
              :error="summary.error.value"
              title="Не удалось загрузить итоги"
              @retry="summary.refetch()"
            />
            <div v-else role="status" aria-label="Загрузка итогов">
              <AnalyticsLoading variant="payment-totals" :currency="currency" />
            </div>
          </template>
          <template v-if="payments.isPending.value || initialPaymentsError" #payments-state>
            <AnalyticsError
              v-if="initialPaymentsError"
              :error="payments.error.value"
              title="Не удалось загрузить журнал"
              embedded
              @retry="payments.refetch()"
            />
            <div v-else role="status" aria-label="Загрузка оплат">
              <AnalyticsLoading variant="payment-journal" />
            </div>
          </template>
        </PaymentsPanel>
      </section>
    </template>
  </div>
</template>
