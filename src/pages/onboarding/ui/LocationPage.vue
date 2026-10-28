<script setup lang="ts">
/**
 * Шаг 2 по макету «Точка и график» (Figma 477:8024 и состояния): первая точка и её недельный график. Если точка уже есть (например,
 * после перезагрузки), дубликат не создаётся — сразу показывается редактор
 * графика выбранной точки. Кнопка шага сама сохраняет неделю и идёт дальше,
 * только если сохранение удалось: отдельной «Сохранить» и блокировки
 * «Продолжить» нет.
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  UiButton,
  UiCard,
  UiErrorState,
  UiPageIntro,
  UiSelect,
  type UiSelectOption,
} from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { timeZoneLabel, useOrganizationQuery } from '@/entities/organization'
import { useLocationsQuery, type Location } from '@/entities/location'
import { LocationForm } from '@/features/manage-locations'
import { BusinessHoursEditor } from '@/features/edit-business-hours'

const router = useRouter()
const session = useSessionStore()
const tenantId = computed(() => session.tenantId ?? '')
const organization = useOrganizationQuery(() => session.tenantId)
const locations = useLocationsQuery(() => session.tenantId)

const activeLocations = computed(() => (locations.data.value ?? []).filter((item) => item.active))
const selectedId = ref<string | null>(null)
watch(
  activeLocations,
  (items) => {
    if (!items.some((item) => item.id === selectedId.value)) selectedId.value = items[0]?.id ?? null
  },
  { immediate: true },
)
const selected = computed<Location | null>(
  () => activeLocations.value.find((item) => item.id === selectedId.value) ?? null,
)
const locationOptions = computed<UiSelectOption[]>(() =>
  activeLocations.value.map((item) => ({ value: item.id, label: item.name })),
)
const editor = ref<InstanceType<typeof BusinessHoursEditor> | null>(null)
const saving = ref(false)

function onLocationCreated(location: Location): void {
  selectedId.value = location.id
}

/** Сохраняет неделю и переходит к услугам; при ошибке остаётся на шаге с сообщением. */
async function continueToServices(): Promise<void> {
  if (saving.value) return
  saving.value = true
  try {
    const saved = (await editor.value?.save()) ?? false
    if (saved) await router.push({ name: 'onboarding-services' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <UiPageIntro
      wide
      title="Когда вы отвечаете клиентам?"
      description="LidRadar учитывает рабочие часы точки при проверке ожидания ответа. Вне рабочего графика счётчик не растёт."
    />

    <div
      v-if="locations.isPending.value"
      class="rounded-card border border-line bg-paper px-5 pt-4 pb-1 md:px-6"
      role="status"
      aria-label="Загрузка точек"
    >
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div class="h-3 w-[316px] max-w-full rounded-full bg-line md:w-[204px]" />
        <div class="h-3 w-[76px] rounded-full bg-line" />
      </div>
      <div class="mt-4 flex flex-col gap-2.5">
        <div class="h-3 max-w-full rounded-full bg-line md:w-[641px]" />
        <div class="h-3 max-w-full rounded-full bg-line md:w-[484px]" />
        <div class="h-3 w-[216px] rounded-full bg-line md:hidden" />
      </div>
      <div class="mt-5 h-[46px] rounded-field bg-line md:h-3 md:w-[386px] md:rounded-full" />
      <ul class="mt-6">
        <li
          v-for="row in 7"
          :key="row"
          class="flex flex-col gap-2.5 border-t border-hairline py-3 md:min-h-[46px] md:flex-row md:items-center md:justify-between md:gap-4 md:py-[9px] lg:py-1.5"
        >
          <div class="flex items-center gap-3 pl-4 md:pl-0">
            <div class="size-4 rounded-sm bg-line" />
            <div class="h-3 w-16 rounded-full bg-line" />
          </div>
          <div v-if="row < 7" class="flex gap-10">
            <div
              class="h-[46px] flex-1 rounded-field bg-line md:w-24 md:flex-none lg:h-[34px] lg:w-20"
            />
            <div
              class="h-[46px] flex-1 rounded-field bg-line md:w-24 md:flex-none lg:h-[34px] lg:w-20"
            />
          </div>
          <div v-else class="hidden h-3 w-[50px] rounded-full bg-line md:block" />
        </li>
      </ul>
    </div>
    <UiErrorState
      v-else-if="locations.isError.value"
      :error="locations.error.value"
      title="Не удалось загрузить точки"
      @retry="locations.refetch()"
    />
    <template v-else>
      <UiCard v-if="!selected" as="section" aria-labelledby="first-location-title">
        <h2 id="first-location-title" class="text-lg font-bold text-ink">Первая точка</h2>
        <p class="mt-1 mb-5 text-sm text-muted">
          Точка — место, где вы работаете. Для неё задаются отдельные часы работы и порог ожидания
          ответа.
        </p>
        <LocationForm
          :tenant-id="tenantId"
          :location="null"
          :default-timezone="organization.data.value?.defaultTimezone ?? 'Europe/Moscow'"
          submit-label="Создать точку"
          @saved="onLocationCreated"
          @cancel="router.push({ name: 'workspaces' })"
        />
      </UiCard>

      <section
        v-else
        aria-labelledby="hours-title"
        class="rounded-card border border-line bg-paper px-5 pt-4 pb-1 md:px-6"
      >
        <div class="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-4">
          <h2 id="hours-title" class="text-field leading-6 font-semibold break-words text-ink">
            График точки · {{ selected.name }}
          </h2>
          <p class="text-sm leading-5 text-secondary">{{ timeZoneLabel(selected.timezone) }}</p>
        </div>
        <label
          v-if="locationOptions.length > 1"
          class="mt-3 flex max-w-xs flex-col gap-1.5 text-sm font-medium text-ink"
        >
          Точка
          <UiSelect v-model="selectedId as string" :options="locationOptions" :disabled="saving" />
        </label>
        <div class="mt-2">
          <BusinessHoursEditor
            :key="selected.id"
            ref="editor"
            :tenant-id="tenantId"
            :location="selected"
            hide-submit
          />
        </div>
      </section>
    </template>

    <p class="mt-4 px-1 text-sm leading-5 text-secondary md:px-6">
      Настройки можно изменить позже в разделе «Настройки».
    </p>
    <div class="mt-5 flex flex-wrap items-center gap-3 md:flex-nowrap">
      <UiButton
        variant="secondary"
        class="bg-panel! md:w-[100px]"
        @click="router.push({ name: 'onboarding-company' })"
      >
        Назад
      </UiButton>
      <p class="ml-auto text-sm leading-5 text-secondary">Далее: Услуги и цены</p>
      <div
        v-if="locations.isPending.value"
        class="flex h-input items-center justify-center rounded-button bg-line px-6 text-field leading-5 font-medium text-muted max-md:flex-1 md:w-[270px]"
      >
        Сохранить и продолжить
      </div>
      <UiButton
        v-else
        class="flex-1 md:w-[270px] md:flex-none"
        :disabled="!selected"
        :loading="saving"
        @click="continueToServices"
      >
        <template v-if="saving">
          <span aria-hidden="true">Сохраняем…</span
          ><span class="sr-only">Сохранить и продолжить</span>
        </template>
        <template v-else>Сохранить и продолжить</template>
      </UiButton>
    </div>
  </div>
</template>
