<script setup lang="ts">
/**
 * Radar: сводка и активная лента с общими фильтрами.
 * Сводка и первая страница ленты запрашиваются параллельно; валюта и
 * часовой пояс берутся из организации выбранного рабочего пространства.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UiPageHeader } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import { useLocationsQuery } from '@/entities/location'
import { useRadarSummaryQuery, type RiskFilters as Filters } from '@/entities/risk'
import { RadarSummary } from '@/widgets/radar-summary'
import { RiskFeed, RiskFilters } from '@/widgets/risk-feed'
import { OnboardingBanner } from '@/widgets/onboarding-progress'
import { parseRiskFilters, riskFiltersToQuery } from '../model/filters-query'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const tenantId = computed(() => session.tenantId)
const filters = computed<Filters>(() => parseRiskFilters(route.query))

const organization = useOrganizationQuery(tenantId)
const locations = useLocationsQuery(tenantId)
const summary = useRadarSummaryQuery(tenantId, filters)

const currency = computed(() => organization.data.value?.defaultCurrency ?? null)
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')

function setFilters(next: Filters): void {
  void router.replace({ query: riskFiltersToQuery(next) })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiPageHeader title="Radar" subtitle="Ситуации, где деньги можно вернуть прямо сейчас" />
    <OnboardingBanner v-if="tenantId && session.can('location.manage')" :tenant-id="tenantId" />
    <RiskFilters
      :model-value="filters"
      :locations="locations.data.value ?? []"
      @update:model-value="setFilters"
    />
    <RadarSummary
      :summary="summary.data.value"
      :currency="currency"
      :loading="summary.isPending.value"
      :error="summary.error.value"
      @retry="summary.refetch()"
    />
    <RiskFeed v-if="tenantId" :tenant-id="tenantId" :filters="filters" :time-zone="timeZone" />
  </div>
</template>
