<script setup lang="ts">
/**
 * Настройки услуг (макет 10): весь каталог с фильтром активности, создание
 * и изменение в диалоге, отключение с подтверждением и повторное включение.
 */
import { computed, ref } from 'vue'
import { UiBadge, UiButton, UiCard, UiErrorState, UiPageHeader, UiSkeleton } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import { useLocationsQuery } from '@/entities/location'
import { formatPriceRange, useServicesQuery, type ServiceCatalogItem } from '@/entities/service'
import { ServiceFormDialog, ServiceStatusButton } from '@/features/manage-services'
import SettingsTabs from './SettingsTabs.vue'

type Filter = 'all' | 'active' | 'inactive'

const session = useSessionStore()
const tenantId = computed(() => session.tenantId ?? '')
const organization = useOrganizationQuery(() => session.tenantId)
const locations = useLocationsQuery(() => session.tenantId)
const services = useServicesQuery(() => session.tenantId)

const filter = ref<Filter>('all')
const items = computed(() => services.data.value ?? [])
const counts = computed(() => ({
  all: items.value.length,
  active: items.value.filter((item) => item.active).length,
  inactive: items.value.filter((item) => !item.active).length,
}))
const visible = computed(() =>
  items.value.filter((item) =>
    filter.value === 'all' ? true : filter.value === 'active' ? item.active : !item.active,
  ),
)
const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Все услуги' },
  { key: 'active', label: 'Активные' },
  { key: 'inactive', label: 'Отключённые' },
]

const locationName = (locationId: string | null) =>
  locationId
    ? (locations.data.value?.find((item) => item.id === locationId)?.name ?? 'Точка')
    : 'Все точки'

const dialogOpen = ref(false)
const editing = ref<ServiceCatalogItem | null>(null)
function openCreate(): void {
  editing.value = null
  dialogOpen.value = true
}
function openEdit(service: ServiceCatalogItem): void {
  editing.value = service
  dialogOpen.value = true
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiPageHeader
      title="Услуги и цены"
      subtitle="Каталог помогает распознать услугу и оценить потенциальную выручку"
    />
    <SettingsTabs />

    <UiCard as="section" aria-labelledby="services-title">
      <h2 id="services-title" class="sr-only">Каталог услуг</h2>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap gap-2" role="group" aria-label="Фильтр услуг">
          <UiButton
            v-for="option in filters"
            :key="option.key"
            size="sm"
            :variant="filter === option.key ? 'primary' : 'secondary'"
            :aria-pressed="filter === option.key"
            @click="filter = option.key"
          >
            {{ option.label }} · {{ counts[option.key] }}
          </UiButton>
        </div>
        <UiButton @click="openCreate">Добавить услугу</UiButton>
      </div>

      <div v-if="services.isPending.value" class="mt-5" role="status" aria-label="Загрузка услуг">
        <UiSkeleton class="h-12 w-full" />
        <UiSkeleton class="mt-2 h-12 w-full" />
      </div>
      <UiErrorState
        v-else-if="services.isError.value"
        class="mt-5"
        :error="services.error.value"
        title="Не удалось загрузить услуги"
        @retry="services.refetch()"
      />
      <p v-else-if="!items.length" class="mt-5 text-sm text-muted">
        Услуг пока нет. Добавьте первую: без каталога LidRadar не сможет оценить потенциальную
        выручку.
      </p>
      <p v-else-if="!visible.length" class="mt-5 text-sm text-muted">В этом фильтре услуг нет.</p>
      <div v-else class="mt-5 relative overflow-x-auto">
        <table class="w-full min-w-[640px] text-left text-sm">
          <caption class="sr-only">
            Услуги организации
          </caption>
          <thead>
            <tr class="text-xs font-semibold tracking-wide text-muted">
              <th scope="col" class="pb-2">Название</th>
              <th scope="col" class="pb-2">Точка</th>
              <th scope="col" class="pb-2">Цена</th>
              <th scope="col" class="pb-2">Состояние</th>
              <th scope="col" class="pb-2"><span class="sr-only">Действия</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="service in visible" :key="service.id">
              <td
                class="py-3 pr-4 font-semibold"
                :class="service.active ? 'text-ink' : 'text-muted'"
              >
                {{ service.name }}
              </td>
              <td class="py-3 pr-4 text-muted">{{ locationName(service.locationId) }}</td>
              <td class="py-3 pr-4 text-ink tabular-nums">
                {{ formatPriceRange(service.priceFrom, service.priceTo, service.currency) }}
              </td>
              <td class="py-3 pr-4">
                <UiBadge :tone="service.active ? 'success' : 'neutral'">
                  {{ service.active ? 'Активна' : 'Отключена' }}
                </UiBadge>
              </td>
              <td class="py-3">
                <div class="flex items-center justify-end gap-2">
                  <UiButton variant="secondary" size="sm" @click="openEdit(service)"
                    >Изменить</UiButton
                  >
                  <ServiceStatusButton :tenant-id="tenantId" :service="service" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>

    <p class="text-sm text-muted">
      Отключение не удаляет историю: услуга исчезнет из новых сопоставлений, но останется в прежних
      диалогах и рисках. Неизвестная цена показывается как «Не указана», а не как нулевая выручка.
    </p>

    <ServiceFormDialog
      v-model:open="dialogOpen"
      :tenant-id="tenantId"
      :service="editing"
      :locations="locations.data.value ?? []"
      :default-currency="organization.data.value?.defaultCurrency ?? 'RUB'"
    />
  </div>
</template>
