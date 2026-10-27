<script setup lang="ts">
/**
 * Radar (Figma 21:1982 / 21:1753): контекст страницы, заголовок с ручным
 * обновлением, сводка и активная лента с общими фильтрами.
 * Сводка и первая страница ленты запрашиваются параллельно; валюта и
 * часовой пояс берутся из организации выбранного рабочего пространства.
 * Фильтры по статусу с счётчиками из макета не выводятся: сводка не
 * содержит разбивки по статусам (см. docs/frontend-v2/STATUS.md).
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatLongDateTime } from '@/shared/lib'
import { useRealtimeState } from '@/shared/api'
import { UiGlyph, UiSpinner } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import {
  isOnboardingStepDone,
  useOnboardingQuery,
  useOrganizationQuery,
} from '@/entities/organization'
import { useLocationsQuery } from '@/entities/location'
import {
  useRadarSummaryQuery,
  type RiskFeedStatus,
  type RiskFilters as Filters,
} from '@/entities/risk'
import { RadarSummary } from '@/widgets/radar-summary'
import { RiskFeed, RiskFilters, RiskStatusTabs } from '@/widgets/risk-feed'
import { OnboardingBanner } from '@/widgets/onboarding-progress'
import { parseRiskFeedStatus, parseRiskFilters, riskFiltersToQuery } from '../model/filters-query'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const tenantId = computed(() => session.tenantId)
const filters = computed<Filters>(() => parseRiskFilters(route.query))
/** Вкладка статуса фильтрует только ленту; сводка её не получает. */
const status = computed(() => parseRiskFeedStatus(route.query))

const organization = useOrganizationQuery(tenantId)
const locations = useLocationsQuery(tenantId)
const summary = useRadarSummaryQuery(tenantId, filters)

// Статус настройки читают только те, кто её ведёт: остальным подключение недоступно.
const onboarding = useOnboardingQuery(() =>
  session.can('location.manage') ? session.tenantId : null,
)
/** `true`, только когда сервер ответил и источник не подключён; пока неизвестно — `false`. */
const sourceMissing = computed(
  () =>
    onboarding.data.value !== undefined && !isOnboardingStepDone(onboarding.data.value, 'CHANNEL'),
)

const currency = computed(() => organization.data.value?.defaultCurrency ?? null)
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')

const feed = ref<InstanceType<typeof RiskFeed> | null>(null)
const realtime = useRealtimeState()
/** Автообновление недоступно: поток потерян или нет сети (красная точка у кнопки). */
const autoRefreshDown = computed(() => realtime.value === 'backoff' || realtime.value === 'offline')
const refreshing = computed(() => summary.isFetching.value || feed.value?.refreshing === true)
const loadedAt = computed(() => feed.value?.loadedAt ?? null)

const now = ref(new Date())
const todayLabel = computed(() => formatLongDateTime(now.value, timeZone.value))
const locationLabel = computed(
  () =>
    locations.data.value?.find((location) => location.id === filters.value.locationId)?.name ??
    'Все точки',
)
const locationNames = computed(() =>
  Object.fromEntries((locations.data.value ?? []).map((location) => [location.id, location.name])),
)
const organizationName = computed(() => session.membership?.organizationName ?? '')

function setFilters(next: Filters): void {
  void router.replace({ query: riskFiltersToQuery(next, status.value) })
}

function setStatus(next: RiskFeedStatus | null): void {
  void router.replace({ query: riskFiltersToQuery(filters.value, next) })
}

function refresh(): void {
  now.value = new Date()
  void summary.refetch()
  feed.value?.refresh()
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div
      class="flex flex-col gap-1 text-xs leading-[18px] text-muted md:flex-row md:items-center md:justify-between md:gap-x-4 lg:h-5"
    >
      <p>{{ organizationName }}&nbsp;&nbsp;/&nbsp;&nbsp;{{ locationLabel }}</p>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p>{{ todayLabel }}</p>
      </div>
    </div>

    <header
      class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 lg:min-h-20 lg:gap-y-1.5"
    >
      <h1 class="text-[32px] leading-10 font-semibold text-ink lg:text-[38px] lg:leading-[46px]">
        Radar
      </h1>
      <div class="flex items-center gap-3 lg:row-span-2 lg:row-start-1 lg:col-start-2">
        <p v-if="loadedAt" class="text-xs leading-[18px] text-muted" role="status">
          Обновлено в {{ loadedAt }}
        </p>
        <button
          type="button"
          class="relative flex size-[46px] shrink-0 items-center justify-center rounded-full border border-line bg-paper text-ink hover:bg-canvas"
          :aria-busy="refreshing || undefined"
          :aria-disabled="refreshing || undefined"
          :title="autoRefreshDown ? 'Автообновление недоступно: обновляйте вручную' : undefined"
          @click="!refreshing && refresh()"
        >
          <UiSpinner v-if="refreshing" class="size-5" />
          <UiGlyph v-else name="refresh" class="size-5" />
          <span
            v-if="autoRefreshDown"
            class="absolute top-[1px] right-[1px] size-3 rounded-full border-2 border-paper bg-danger"
            aria-hidden="true"
          />
          <!-- Состояние потока — в имени кнопки: текстовой плашки в макете нет (Figma 256:2511). -->
          <span class="sr-only"
            >Обновить Radar<template v-if="autoRefreshDown"
              >. Автообновление недоступно: обновляйте вручную</template
            ></span
          >
        </button>
      </div>
      <p class="col-span-2 text-[15px] leading-[22px] text-muted lg:col-span-1 lg:row-start-2">
        Риски в переписке, которым нужно ваше внимание
      </p>
    </header>

    <!-- Смена состояния потока озвучивается без плашки: её в макете нет (Figma 256:2511). -->
    <p v-if="autoRefreshDown" class="sr-only" role="status">
      Автообновление недоступно: обновляйте вручную
    </p>
    <OnboardingBanner v-if="tenantId && session.can('location.manage')" :tenant-id="tenantId" />
    <RadarSummary
      :summary="summary.data.value"
      :currency="currency"
      :loading="summary.isPending.value"
      :error="summary.error.value"
      @retry="summary.refetch()"
    />
    <RiskFeed
      v-if="tenantId"
      ref="feed"
      :tenant-id="tenantId"
      :filters="filters"
      :status="status"
      :time-zone="timeZone"
      :source-missing="sourceMissing"
      :can-connect-source="session.can('integration.manage')"
      :total="status ? undefined : summary.data.value?.openRisks"
      :location-names="locationNames"
    >
      <template #filters-button>
        <RiskFilters
          variant="panel"
          :model-value="filters"
          :locations="locations.data.value ?? []"
          @update:model-value="setFilters"
        />
      </template>
      <template #filters>
        <RiskStatusTabs class="lg:hidden" :model-value="status" @update:model-value="setStatus" />
        <RiskFilters
          :model-value="filters"
          :status="status"
          :locations="locations.data.value ?? []"
          @update:status="setStatus"
          @update:model-value="setFilters"
        />
      </template>
    </RiskFeed>
  </div>
</template>
