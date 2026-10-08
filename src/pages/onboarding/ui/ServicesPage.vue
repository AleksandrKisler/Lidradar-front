<script setup lang="ts">
/**
 * Шаг 3: услуги и цены. Каждая услуга создаётся отдельным запросом:
 * успешные строки остаются, даже если следующая не принята. Минимум одна
 * услуга — цель продукта, но сервер шаг не блокирует.
 */
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { UiAlert, UiButton, UiCard, UiErrorState, UiSkeleton } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import { useLocationsQuery } from '@/entities/location'
import { formatPriceRange, useServicesQuery } from '@/entities/service'
import { ServiceForm } from '@/features/manage-services'

const router = useRouter()
const session = useSessionStore()
const tenantId = computed(() => session.tenantId ?? '')
const organization = useOrganizationQuery(() => session.tenantId)
const locations = useLocationsQuery(() => session.tenantId)
const services = useServicesQuery(() => session.tenantId)

const active = computed(() => (services.data.value ?? []).filter((item) => item.active))
const locationName = (locationId: string | null) =>
  locationId
    ? (locations.data.value?.find((item) => item.id === locationId)?.name ?? 'Точка')
    : 'Все точки'
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <p class="text-xs font-semibold tracking-wide text-brand-dark">Шаг 3 из 4</p>
      <h1 class="mt-2 text-2xl font-bold text-ink">Добавьте основные услуги</h1>
      <p class="mt-2 text-sm leading-6 text-muted">
        Цены нужны для оценки потенциальной выручки. Если сумма неизвестна, мы не будем её
        придумывать: диапазон не подменяет точную сумму.
      </p>
    </div>

    <UiCard as="section" aria-labelledby="catalog-title">
      <h2 id="catalog-title" class="text-lg font-bold text-ink">Каталог услуг</h2>
      <p class="mt-1 text-sm text-muted">Для начала достаточно двух-трёх основных услуг.</p>
      <div v-if="services.isPending.value" class="mt-4" role="status" aria-label="Загрузка услуг">
        <UiSkeleton class="h-10 w-full" />
      </div>
      <UiErrorState
        v-else-if="services.isError.value"
        class="mt-4"
        :error="services.error.value"
        title="Не удалось загрузить услуги"
        @retry="services.refetch()"
      />
      <ul
        v-else-if="active.length"
        class="mt-4 divide-y divide-line"
        aria-label="Добавленные услуги"
      >
        <li
          v-for="service in active"
          :key="service.id"
          class="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2.5 text-sm"
        >
          <span class="font-semibold text-ink">{{ service.name }}</span>
          <span class="text-muted">{{ locationName(service.locationId) }}</span>
          <span class="text-ink tabular-nums">
            {{ formatPriceRange(service.priceFrom, service.priceTo, service.currency) }}
          </span>
        </li>
      </ul>
      <p v-else class="mt-4 text-sm text-muted">Услуг пока нет.</p>
    </UiCard>

    <UiCard as="section" aria-labelledby="new-service-title">
      <h2 id="new-service-title" class="text-lg font-bold text-ink">Добавить услугу</h2>
      <div class="mt-4">
        <ServiceForm
          :tenant-id="tenantId"
          :service="null"
          :locations="locations.data.value ?? []"
          :default-currency="organization.data.value?.defaultCurrency ?? 'RUB'"
          @cancel="router.push({ name: 'onboarding-location' })"
        />
      </div>
    </UiCard>

    <UiAlert tone="info" title="Диапазон не подменяет точную сумму">
      Цена 50 000–90 000 ₽ не превращается автоматически в «70 000 ₽»: в риске появится сумма,
      только когда для неё есть надёжное основание.
    </UiAlert>

    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <p class="text-sm text-muted">Настройки можно изменить позже.</p>
      <div class="flex gap-3">
        <RouterLink
          :to="{ name: 'onboarding-location' }"
          class="inline-flex h-11 items-center rounded-control border border-line px-5 text-sm font-semibold text-ink hover:bg-canvas"
        >
          Назад
        </RouterLink>
        <UiButton @click="router.push({ name: 'onboarding-channel' })">Продолжить</UiButton>
      </div>
    </div>
  </div>
</template>
