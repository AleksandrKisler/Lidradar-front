<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { GLYPHS, UiAlert, UiButton, UiErrorState, UiSkeleton } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import { useLocationsQuery } from '@/entities/location'
import { formatPriceRange, useServicesQuery, type ServiceCatalogItem } from '@/entities/service'
import {
  ServiceAddButton,
  ServiceFormDialog,
  ServiceStatusButton,
} from '@/features/manage-services'
import SettingsPageHead from './SettingsPageHead.vue'
import SettingsServiceName from './SettingsServiceName.vue'

type Filter = 'all' | 'active' | 'inactive'
const session = useSessionStore()
const tenantId = computed(() => session.tenantId ?? '')
const organization = useOrganizationQuery(() => session.tenantId)
const locations = useLocationsQuery(() => session.tenantId)
const services = useServicesQuery(() => session.tenantId)
const filter = ref<Filter>('all')
const items = computed(() => services.data.value ?? [])
const known = computed(() => services.data.value !== undefined)
const counts = computed(() => ({
  all: items.value.length,
  active: items.value.filter((item) => item.active).length,
  inactive: items.value.filter((item) => !item.active).length,
}))
const visible = computed(() =>
  items.value.filter(
    (item) => filter.value === 'all' || (filter.value === 'active') === item.active,
  ),
)
const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'active', label: 'Активные' },
  { key: 'inactive', label: 'Отключённые' },
]
const width = ref(typeof window === 'undefined' ? 1440 : innerWidth)
let mounted = true
const resize = () => {
  width.value = innerWidth
}
onMounted(() => window.addEventListener('resize', resize))
onBeforeUnmount(() => {
  mounted = false
  window.removeEventListener('resize', resize)
})
const layout = computed(() =>
  width.value < 768 ? 'phone' : width.value < 1024 ? 'tablet' : 'desktop',
)
const columns = computed(() =>
  layout.value === 'desktop' ? [292, 202, 182, 142, 252] : [220, 116, 136, 116, 148],
)
const colWidth = (value: number) => `${(value / (layout.value === 'desktop' ? 1070 : 736)) * 100}%`
const locationName = (id: string | null) =>
  id ? (locations.data.value?.find((item) => item.id === id)?.name ?? 'Точка') : 'Все точки'
const price = (item: ServiceCatalogItem) =>
  formatPriceRange(item.priceFrom, item.priceTo, item.currency)
const dialogOpen = ref(false)
const editing = ref<ServiceCatalogItem | null>(null)
const unavailable = computed(() => !organization.data.value || !locations.data.value)
function openCreate(event: MouseEvent) {
  ;(event.currentTarget as HTMLElement).focus()
  editing.value = null
  dialogOpen.value = true
}
function retryData() {
  void organization.refetch()
  void locations.refetch()
}
function openEdit(item: ServiceCatalogItem, event: MouseEvent) {
  ;(event.currentTarget as HTMLElement).focus()
  editing.value = item
  dialogOpen.value = true
}
function returnFocusFor(expectedTenant: string) {
  return () => {
    if (!mounted || tenantId.value !== expectedTenant) return null
    return (
      [
        ...document.querySelectorAll<HTMLButtonElement>('button[aria-label="Добавить услугу"]'),
      ].find((button) => button.getClientRects().length && !button.disabled) ?? null
    )
  }
}
watch(tenantId, () => {
  filter.value = 'all'
  dialogOpen.value = false
  editing.value = null
})
</script>

<template>
  <div class="lr-services flex min-w-0 flex-col gap-5 pb-2 md:gap-6 md:max-lg:-mx-2">
    <SettingsPageHead
      title="Услуги и цены"
      subtitle="Каталог помогает распознать услугу и оценить потенциальную выручку."
      scrolling-tabs
    >
      <template #action
        ><ServiceAddButton class="md:hidden" :disabled="unavailable" @click="openCreate"
      /></template>
    </SettingsPageHead>
    <section
      class="lr-service-catalog rounded-[18px] md:border md:border-line md:bg-paper md:p-6"
      aria-labelledby="services-title"
    >
      <h2 id="services-title" class="sr-only">Каталог услуг</h2>
      <header class="flex h-8 items-center justify-between gap-4 md:h-auto lg:h-9">
        <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Фильтр услуг">
          <button
            v-for="option in filters"
            :key="option.key"
            type="button"
            class="h-8 rounded-button px-3 text-sm leading-5 font-medium whitespace-nowrap"
            :class="filter === option.key ? 'border border-line text-ink' : 'text-muted'"
            :aria-pressed="filter === option.key"
            @click="filter = option.key"
          >
            {{ option.label }}{{ known ? ` · ${counts[option.key]}` : '' }}
          </button>
        </div>
        <ServiceAddButton class="hidden md:flex" :disabled="unavailable" @click="openCreate" />
      </header>
      <div v-if="services.isPending.value" class="mt-5" role="status" aria-label="Загрузка услуг">
        <UiSkeleton v-for="n in 3" :key="n" class="mt-2 h-12 w-full" />
      </div>
      <UiErrorState
        v-else-if="!known && services.isError.value"
        class="mt-5"
        :error="services.error.value"
        title="Не удалось загрузить услуги"
        @retry="services.refetch()"
      />
      <template v-else>
        <p v-if="services.isFetching.value" role="status" class="mt-4 text-sm text-muted">
          Обновляем данные. Предыдущие значения остаются на экране.
        </p>
        <UiAlert
          v-if="known && services.isError.value"
          tone="danger"
          class="mt-4"
          title="Не удалось обновить услуги"
        >
          Предыдущие данные остаются на экране.
          <UiButton variant="plain" @click="services.refetch()">Повторить</UiButton>
        </UiAlert>
        <UiAlert
          v-if="unavailable && (organization.isError.value || locations.isError.value)"
          tone="danger"
          class="mt-4"
          title="Не удалось загрузить данные компании"
        >
          Добавление станет доступно после загрузки данных.
          <UiButton variant="plain" @click="retryData">Повторить загрузку</UiButton>
        </UiAlert>
        <p v-if="!items.length" class="mt-5 text-sm text-muted">
          Услуг пока нет. Добавьте первую: без каталога LidRadar не сможет оценить потенциальную
          выручку.
        </p>
        <p v-else-if="!visible.length" class="mt-5 text-sm text-muted">В этом фильтре услуг нет.</p>
        <template v-else>
          <div class="mt-4 hidden border-t border-line pt-4 md:block">
            <table class="w-full text-left" style="table-layout: fixed">
              <caption class="sr-only">
                Услуги организации
              </caption>
              <colgroup>
                <col
                  v-for="(value, index) in columns"
                  :key="index"
                  :style="{ width: colWidth(value) }"
                />
              </colgroup>
              <thead>
                <tr class="text-xs leading-[18px] text-muted">
                  <th
                    v-for="(label, index) in ['Название', 'Точка', 'Цена', 'Состояние', 'Действия']"
                    :key="label"
                    scope="col"
                    class="pb-2 font-normal"
                    :class="index < 4 ? 'pr-3' : ''"
                  >
                    <span :class="index === 4 ? 'sr-only' : ''">{{ label }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in visible" :key="tenantId + item.id">
                  <td class="py-2 pr-3"><SettingsServiceName :name="item.name" /></td>
                  <td class="break-words py-2 pr-3 text-sm leading-5 text-muted">
                    {{ locationName(item.locationId) }}
                  </td>
                  <td class="break-words py-2 pr-3 text-sm leading-5 text-ink">
                    {{ price(item) }}
                  </td>
                  <td class="py-2 pr-3">
                    <span
                      class="inline-flex h-7 items-center rounded-full bg-canvas px-2.5 text-xs leading-[18px] whitespace-nowrap"
                      :class="item.active ? 'text-success' : 'text-muted'"
                      :style="item.active ? { backgroundColor: '#e5f7f0' } : undefined"
                      >{{ item.active ? 'Активна' : 'Отключена' }}</span
                    >
                  </td>
                  <td class="py-2">
                    <div
                      class="flex items-center justify-end"
                      :class="layout === 'desktop' ? 'gap-3' : 'gap-2'"
                    >
                      <button
                        type="button"
                        class="flex size-11 shrink-0 items-center justify-center rounded-field"
                        :aria-label="`Изменить услугу «${item.name}»`"
                        @click="openEdit(item, $event)"
                      >
                        <img :src="GLYPHS.pencil" width="18" height="18" alt="" />
                      </button>
                      <ServiceStatusButton
                        :tenant-id="tenantId"
                        :service="item"
                        :layout="layout"
                        :return-focus="returnFocusFor(tenantId)"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="mt-5 flex flex-col gap-3 md:hidden">
            <article
              v-for="item in visible"
              :key="tenantId + item.id"
              :aria-label="item.name"
              class="flex min-w-0 flex-col gap-3 rounded-[18px] border border-line bg-paper p-4"
            >
              <header class="flex items-center gap-2">
                <h3 class="min-w-0 flex-1"><SettingsServiceName :name="item.name" /></h3>
                <button
                  type="button"
                  class="flex size-11 shrink-0 items-center justify-center rounded-field"
                  :aria-label="`Изменить услугу «${item.name}»`"
                  @click="openEdit(item, $event)"
                >
                  <img :src="GLYPHS.pencil" width="18" height="18" alt="" />
                </button>
              </header>
              <div class="grid grid-cols-2 gap-4">
                <div class="min-w-0">
                  <p class="text-xs leading-[18px] text-muted">Точка</p>
                  <p class="mt-1 break-words text-sm leading-5 text-muted">
                    {{ locationName(item.locationId) }}
                  </p>
                </div>
                <div class="min-w-0">
                  <p class="text-xs leading-[18px] text-muted">Цена</p>
                  <p class="mt-1 break-words text-base leading-[22px] font-semibold text-ink">
                    {{ price(item) }}
                  </p>
                </div>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span
                  class="inline-flex h-7 items-center rounded-full bg-canvas px-2.5 text-xs leading-[18px] whitespace-nowrap"
                  :class="item.active ? 'text-success' : 'text-muted'"
                  :style="item.active ? { backgroundColor: '#e5f7f0' } : undefined"
                  >{{ item.active ? 'Активна' : 'Отключена' }}</span
                ><ServiceStatusButton
                  :tenant-id="tenantId"
                  :service="item"
                  layout="phone"
                  :return-focus="returnFocusFor(tenantId)"
                />
              </div>
            </article>
          </div>
        </template>
        <p
          v-if="known"
          class="mt-5 text-xs leading-[18px] text-muted md:mt-2 md:border-t md:border-line md:pt-4"
        >
          Показано {{ visible.length }} услуг
        </p>
      </template>
    </section>
    <ServiceFormDialog
      v-model:open="dialogOpen"
      :tenant-id="tenantId"
      :service="editing"
      :locations="locations.data.value ?? []"
      :default-currency="organization.data.value?.defaultCurrency ?? 'RUB'"
    />
  </div>
</template>
