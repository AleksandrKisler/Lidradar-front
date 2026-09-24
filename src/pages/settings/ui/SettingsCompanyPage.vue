<script setup lang="ts">
/**
 * Настройки компании, точек и графика (макет 09). Организация и точки
 * загружаются независимо: ошибка одного блока не скрывает другой. Смена
 * выбранной точки при несохранённом графике и уход со страницы требуют
 * подтверждения.
 */
import { computed, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import {
  UiBadge,
  UiButton,
  UiCard,
  UiErrorState,
  UiPageHeader,
  UiSelect,
  UiSkeleton,
  type UiSelectOption,
} from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import { describeDay, useLocationsQuery, type Location } from '@/entities/location'
import { OrganizationForm } from '@/features/edit-organization'
import { LocationFormDialog } from '@/features/manage-locations'
import { BusinessHoursEditor } from '@/features/edit-business-hours'
import SettingsTabs from './SettingsTabs.vue'

const session = useSessionStore()
const tenantId = computed(() => session.tenantId ?? '')
const organization = useOrganizationQuery(() => session.tenantId)
const locations = useLocationsQuery(() => session.tenantId)

const selectedId = ref<string | null>(null)
const hoursDirty = ref(false)
const allLocations = computed(() => locations.data.value ?? [])
watch(
  allLocations,
  (items) => {
    if (!items.some((item) => item.id === selectedId.value)) {
      selectedId.value = items.find((item) => item.active)?.id ?? items[0]?.id ?? null
    }
  },
  { immediate: true },
)
const selected = computed<Location | null>(
  () => allLocations.value.find((item) => item.id === selectedId.value) ?? null,
)
const locationOptions = computed<UiSelectOption[]>(() =>
  allLocations.value.map((item) => ({
    value: item.id,
    label: item.active ? item.name : `${item.name} (неактивна)`,
  })),
)

/** Смена точки с несохранённым графиком — только по подтверждению. */
function selectLocation(id: string | undefined): void {
  if (!id || id === selectedId.value) return
  if (
    hoursDirty.value &&
    !window.confirm('График не сохранён. Переключить точку и потерять изменения?')
  ) {
    return
  }
  selectedId.value = id
}

const LEAVE_PROMPT = 'Есть несохранённые изменения графика. Уйти без сохранения?'
onBeforeRouteLeave(() => (hoursDirty.value ? window.confirm(LEAVE_PROMPT) : true))
function beforeUnload(event: BeforeUnloadEvent): void {
  if (hoursDirty.value) event.preventDefault()
}
watch(hoursDirty, (dirty) => {
  if (dirty) window.addEventListener('beforeunload', beforeUnload)
  else window.removeEventListener('beforeunload', beforeUnload)
})

const dialogOpen = ref(false)
const editing = ref<Location | null>(null)
function openCreate(): void {
  editing.value = null
  dialogOpen.value = true
}
function openEdit(location: Location): void {
  editing.value = location
  dialogOpen.value = true
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiPageHeader
      title="Настройки рабочего пространства"
      subtitle="Раздел доступен владельцу компании"
    />
    <SettingsTabs />

    <div class="grid gap-6 lg:grid-cols-2 lg:items-start">
      <UiCard as="section" aria-labelledby="company-title">
        <h2 id="company-title" class="text-lg font-bold text-ink">Компания</h2>
        <div class="mt-4">
          <div v-if="organization.isPending.value" role="status" aria-label="Загрузка компании">
            <UiSkeleton class="h-11 w-full" />
            <UiSkeleton class="mt-4 h-11 w-full" />
          </div>
          <UiErrorState
            v-else-if="organization.isError.value || !organization.data.value"
            :error="organization.error.value"
            title="Не удалось загрузить компанию"
            @retry="organization.refetch()"
          />
          <OrganizationForm v-else :tenant-id="tenantId" :organization="organization.data.value" />
        </div>
      </UiCard>

      <UiCard as="section" aria-labelledby="locations-title">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 id="locations-title" class="text-lg font-bold text-ink">Точки</h2>
          <UiButton size="sm" @click="openCreate">Добавить точку</UiButton>
        </div>
        <div class="mt-4">
          <div v-if="locations.isPending.value" role="status" aria-label="Загрузка точек">
            <UiSkeleton class="h-14 w-full" />
          </div>
          <UiErrorState
            v-else-if="locations.isError.value"
            :error="locations.error.value"
            title="Не удалось загрузить точки"
            @retry="locations.refetch()"
          />
          <p v-else-if="!allLocations.length" class="text-sm text-muted">
            Точек пока нет. Добавьте первую, чтобы задать график и порог ответа.
          </p>
          <ul v-else class="divide-y divide-line" aria-label="Список точек">
            <li
              v-for="location in allLocations"
              :key="location.id"
              class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
            >
              <div class="min-w-0">
                <p class="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  {{ location.name }}
                  <UiBadge :tone="location.active ? 'success' : 'neutral'">
                    {{ location.active ? 'Активна' : 'Неактивна' }}
                  </UiBadge>
                </p>
                <p class="text-xs text-muted">
                  {{ location.timezone }} · порог ответа {{ location.responseThresholdMinutes }} мин
                  ·
                  <template v-if="location.businessHours.length">
                    пн
                    {{
                      describeDay(
                        location.businessHours.find((day) => day.weekday === 1) ?? {
                          weekday: 1,
                          closed: true,
                        },
                      )
                    }}
                  </template>
                  <template v-else>график не задан</template>
                </p>
              </div>
              <UiButton variant="secondary" size="sm" @click="openEdit(location)"
                >Изменить</UiButton
              >
            </li>
          </ul>
        </div>
      </UiCard>
    </div>

    <UiCard v-if="selected" as="section" aria-labelledby="schedule-title">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="schedule-title" class="text-lg font-bold text-ink">График работы</h2>
          <p class="mt-1 text-sm text-muted">{{ selected.name }}</p>
        </div>
        <label
          v-if="locationOptions.length > 1"
          class="flex min-w-56 flex-col gap-1.5 text-sm font-medium text-ink"
        >
          Точка
          <UiSelect
            :model-value="selectedId ?? ''"
            :options="locationOptions"
            @update:model-value="selectLocation"
          />
        </label>
      </div>
      <div class="mt-5">
        <BusinessHoursEditor
          :key="selected.id"
          :tenant-id="tenantId"
          :location="selected"
          @update:dirty="hoursDirty = $event"
        />
      </div>
    </UiCard>

    <LocationFormDialog
      v-model:open="dialogOpen"
      :tenant-id="tenantId"
      :location="editing"
      :default-timezone="organization.data.value?.defaultTimezone ?? 'Europe/Moscow'"
    />
  </div>
</template>
