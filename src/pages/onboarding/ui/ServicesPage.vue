<script setup lang="ts">
/**
 * Шаг 3 по макету «Услуги и цены» (Figma 477:8201 и состояния): услуги и цены. Каждая услуга создаётся отдельным запросом:
 * успешные строки остаются, даже если следующая не принята. Минимум одна
 * услуга — цель продукта, но сервер шаг не блокирует.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { UiButton, UiErrorState, UiPageIntro } from '@/shared/ui'
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

/** Пока не пришли услуги и точки, показывается каркас: без списка точек услугу нельзя привязать к нужной. */
const loading = computed(() => services.isPending.value || locations.isPending.value)
const active = computed(() => (services.data.value ?? []).filter((item) => item.active))
const locationName = (locationId: string | null) =>
  locationId
    ? (locations.data.value?.find((item) => item.id === locationId)?.name ?? 'Точка')
    : 'Все точки'
</script>

<template>
  <div>
    <UiPageIntro
      wide
      title="Добавьте основные услуги"
      :description="'Цены нужны для оценки потенциальной выручки.\nЕсли сумма неизвестна, мы не будем её придумывать.'"
    />

    <section
      aria-labelledby="catalog-title"
      class="rounded-card border border-line bg-paper px-5 pt-3 pb-1 md:px-6"
    >
      <div
        v-if="loading"
        class="flex flex-col gap-3 pt-3 pb-5 md:flex-row md:items-center md:justify-between md:gap-4 md:pb-[17px]"
        aria-hidden="true"
      >
        <div class="h-3 w-[210px] rounded-full bg-line md:w-[82px]" />
        <div class="h-3 w-[322px] max-w-full rounded-full bg-line md:mr-28 md:w-[238px]" />
        <div class="h-3 w-[216px] rounded-full bg-line md:hidden" />
      </div>
      <div
        v-else
        class="flex flex-col gap-1 pb-3.5 md:flex-row md:items-baseline md:justify-between md:gap-4"
      >
        <h2 id="catalog-title" class="text-field leading-6 font-semibold text-ink">
          Каталог услуг
        </h2>
        <p class="text-sm leading-5 text-secondary">
          Для начала достаточно двух-трёх основных услуг.
        </p>
      </div>
      <div
        v-if="loading"
        class="flex flex-col gap-3 border-t border-hairline py-4 md:flex-row md:items-center md:justify-between"
        role="status"
        aria-label="Загрузка услуг"
      >
        <div class="h-3 w-[210px] rounded-full bg-line md:w-[292px]" />
        <div class="h-3 w-[210px] rounded-full bg-line md:w-[108px]" />
        <div class="h-3 w-[210px] rounded-full bg-line md:mr-6 md:w-[50px]" />
      </div>
      <UiErrorState
        v-else-if="services.isError.value"
        class="mb-4"
        :error="services.error.value"
        title="Не удалось загрузить услуги"
        @retry="services.refetch()"
      />
      <ul
        v-else-if="active.length"
        class="border-t border-hairline"
        aria-label="Добавленные услуги"
      >
        <li
          v-for="service in active"
          :key="service.id"
          class="flex flex-col gap-1 border-t border-hairline py-4 first:border-t-0 md:grid md:grid-cols-[minmax(0,1fr)_108px_150px] md:items-center md:gap-0"
        >
          <span class="text-base leading-[22px] font-medium break-words text-ink">{{
            service.name
          }}</span>
          <span class="text-sm leading-5 text-secondary">{{
            locationName(service.locationId)
          }}</span>
          <span class="text-field leading-6 font-medium text-ink tabular-nums md:text-right">
            {{ formatPriceRange(service.priceFrom, service.priceTo, service.currency) }}
          </span>
        </li>
      </ul>
      <p v-else class="border-t border-hairline py-4 text-sm leading-5 text-secondary">
        Услуг пока нет.
      </p>
    </section>

    <section
      aria-labelledby="new-service-title"
      class="mt-4 rounded-card border border-line bg-paper px-5 pt-4 pb-4 md:px-6"
    >
      <div
        v-if="loading"
        class="mb-3 flex flex-col gap-2.5 md:mb-5 md:flex-row md:items-center md:justify-between md:gap-4"
        aria-hidden="true"
      >
        <div class="h-3 w-[120px] rounded-full bg-line md:w-[98px]" />
        <div class="h-3 w-40 rounded-full bg-line md:mr-[61px] md:w-[130px]" />
      </div>
      <div
        v-else
        class="mb-3 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-4"
      >
        <h2 id="new-service-title" class="text-field leading-6 font-semibold text-ink">
          Добавить услугу
        </h2>
        <p class="text-meta leading-[18px] text-secondary">Название — до 200 символов</p>
      </div>
      <div v-if="loading" class="flex flex-col gap-4" aria-hidden="true">
        <div class="grid gap-4 md:grid-cols-[420px_minmax(0,1fr)]">
          <div class="flex flex-col gap-2.5">
            <div class="h-3 w-[120px] rounded-full bg-line" />
            <div class="h-[46px] rounded-field bg-line" />
          </div>
          <div class="flex flex-col gap-2.5">
            <div class="h-3 w-20 rounded-full bg-line" />
            <div class="h-[46px] rounded-field bg-line" />
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-[172px_172px_minmax(0,1fr)]">
          <div
            v-for="width in ['w-16', 'w-16', 'w-[68px]']"
            :key="width"
            class="flex flex-col gap-2.5"
          >
            <div :class="['h-3 rounded-full bg-line', width]" />
            <div class="h-[46px] rounded-field bg-line" />
          </div>
        </div>
        <div class="-mt-2 h-3 w-[484px] max-w-full rounded-full bg-line" />
        <div class="flex justify-end gap-4">
          <div class="h-[46px] w-28 rounded-button bg-line" />
          <div class="h-[46px] w-48 rounded-button bg-line" />
        </div>
      </div>
      <ServiceForm
        v-else
        wizard
        :tenant-id="tenantId"
        :service="null"
        :locations="locations.data.value ?? []"
        :default-currency="organization.data.value?.defaultCurrency ?? 'RUB'"
        @cancel="router.push({ name: 'onboarding-location' })"
      />
    </section>

    <div class="mt-3 px-1 md:pr-0 md:pl-6">
      <p class="text-note leading-5 font-medium text-ink">Диапазон не подменяет точную сумму</p>
      <p class="mt-1 text-note text-secondary">
        Например, 50 000–90 000 ₽ не превращается автоматически в 70 000 ₽. В риске появится сумма,
        только когда для неё есть надёжное основание.
      </p>
      <p class="mt-4 text-sm leading-5 text-secondary">
        Настройки можно изменить позже в разделе «Настройки».
      </p>
    </div>
    <div class="mt-4 flex flex-wrap items-center gap-3 md:flex-nowrap">
      <UiButton
        variant="secondary"
        class="md:w-[100px]"
        @click="router.push({ name: 'onboarding-location' })"
      >
        Назад
      </UiButton>
      <p class="ml-auto text-sm leading-5 text-secondary md:mr-3">Далее: Источник сообщений</p>
      <div
        v-if="loading"
        class="flex h-input items-center justify-center rounded-button bg-line px-6 text-field leading-5 font-medium text-muted max-md:flex-1 md:w-[180px]"
      >
        Продолжить
      </div>
      <UiButton
        v-else
        class="flex-1 md:w-[180px] md:flex-none"
        @click="router.push({ name: 'onboarding-channel' })"
      >
        Продолжить
      </UiButton>
    </div>
  </div>
</template>
