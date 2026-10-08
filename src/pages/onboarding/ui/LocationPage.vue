<script setup lang="ts">
/**
 * Шаг 2: первая точка и её недельный график. Если точка уже есть (например,
 * после перезагрузки), дубликат не создаётся — сразу показывается редактор
 * графика выбранной точки. Кнопка шага сама сохраняет неделю и идёт дальше,
 * только если сохранение удалось: отдельной «Сохранить» и блокировки
 * «Продолжить» нет.
 */
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  UiButton,
  UiCard,
  UiErrorState,
  UiSelect,
  UiSkeleton,
  type UiSelectOption,
} from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
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
    const saved = (await editor.value?.save()) ?? true
    if (saved) await router.push({ name: 'onboarding-services' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <p class="text-xs font-semibold tracking-wide text-brand-dark">Шаг 2 из 4</p>
      <h1 class="mt-2 text-2xl font-bold text-ink">Когда вы отвечаете клиентам?</h1>
      <p class="mt-2 text-sm leading-6 text-muted">
        LidRadar учитывает рабочие часы точки при проверке ожидания ответа. Ночью и в выходные
        счётчик не растёт.
      </p>
    </div>

    <UiCard v-if="locations.isPending.value" role="status" aria-label="Загрузка точек">
      <UiSkeleton class="h-6 w-48" />
      <UiSkeleton class="mt-4 h-40 w-full" />
    </UiCard>
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

      <UiCard v-else as="section" aria-labelledby="hours-title">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="hours-title" class="text-lg font-bold text-ink">График точки</h2>
            <p class="mt-1 text-sm text-muted">{{ selected.name }} · {{ selected.timezone }}</p>
          </div>
          <label
            v-if="locationOptions.length > 1"
            class="flex min-w-56 flex-col gap-1.5 text-sm font-medium text-ink"
          >
            Точка
            <UiSelect v-model="selectedId as string" :options="locationOptions" />
          </label>
        </div>
        <div class="mt-5">
          <BusinessHoursEditor
            :key="selected.id"
            ref="editor"
            :tenant-id="tenantId"
            :location="selected"
            hide-submit
          />
        </div>
      </UiCard>

      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p class="text-sm text-muted">Настройки можно изменить позже в разделе «Настройки».</p>
        <div class="ml-auto flex gap-3">
          <RouterLink
            :to="{ name: 'onboarding-company' }"
            class="inline-flex h-11 items-center rounded-control border border-line px-5 text-sm font-semibold text-ink hover:bg-canvas"
          >
            Назад
          </RouterLink>
          <UiButton :disabled="!selected" :loading="saving" @click="continueToServices">
            Сохранить и продолжить
          </UiButton>
        </div>
      </div>
    </template>
  </div>
</template>
