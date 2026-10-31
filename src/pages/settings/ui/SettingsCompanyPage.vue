<script setup lang="ts">
/**
 * «Настройки → Компания и график» (Figma 529:4216 и состояния). Организация и точки
 * загружаются независимо: ошибка одного блока не скрывает другой. Смена
 * выбранной точки при несохранённом графике и уход со страницы требуют
 * подтверждения. Ошибка повторного чтения не стирает показанное: строка над карточками
 * предлагает «Повторить обновление».
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import {
  UiButton,
  UiErrorState,
  UiGlyph,
  UiSelect,
  UiSheetDialog,
  UiSkeleton,
  UiSpinner,
  type UiSelectOption,
} from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { timeZoneLabel, useOrganizationQuery } from '@/entities/organization'
import { WEEKDAYS, describeDay, useLocationsQuery, type Location } from '@/entities/location'
import { OrganizationForm } from '@/features/edit-organization'
import { LocationFormDialog } from '@/features/manage-locations'
import { BusinessHoursEditor } from '@/features/edit-business-hours'
import { useWorkspaceSwitchGuard } from '@/features/select-workspace'
import SettingsPageHead from './SettingsPageHead.vue'

const session = useSessionStore()
const tenantId = computed(() => session.tenantId ?? '')
const organization = useOrganizationQuery(() => session.tenantId)
const locations = useLocationsQuery(() => session.tenantId)

const selectedId = ref<string | null>(null)
const hoursDirty = ref(false)
const hoursBusy = ref(false)
watch(tenantId, () => {
  selectedId.value = null
  hoursDirty.value = false
  hoursBusy.value = false
  dialogOpen.value = false
  editing.value = null
  decideLeave(false)
})
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

/**
 * Несохранённый график защищён окном «Сохранить изменения графика?» (Figma «Настройки»): смена точки и
 * уход со страницы идут дальше только по «Продолжить без сохранения»; закрытие окна и
 * «К редактированию» оставляют всё как есть.
 */
const leaveOpen = ref(false)
let leaveDecision: ((leave: boolean) => void) | null = null
function askToLeave(): Promise<boolean> {
  leaveDecision?.(false)
  leaveOpen.value = true
  return new Promise((resolve) => {
    leaveDecision = resolve
  })
}
function decideLeave(leave: boolean): void {
  const decision = leaveDecision
  leaveDecision = null
  leaveOpen.value = false
  decision?.(leave)
}
watch(leaveOpen, (isOpen) => {
  if (!isOpen && leaveDecision) decideLeave(false)
})

const selectKey = ref(0)
async function selectLocation(id: string | undefined, trigger?: HTMLElement): Promise<void> {
  if (!id || id === selectedId.value || hoursBusy.value) return
  const origin =
    trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
  origin?.focus()
  if (hoursDirty.value && !(await askToLeave())) {
    selectKey.value += 1 // нативный список показывает выбранное: возвращаем прежнюю точку
    await nextTick()
    if (origin?.isConnected) origin.focus()
    else document.getElementById('schedule-location')?.focus()
    return
  }
  selectedId.value = id
}

async function confirmDeparture(): Promise<boolean> {
  if (hoursBusy.value) return false
  if (!hoursDirty.value) return true
  const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const leave = await askToLeave()
  if (!leave) {
    await nextTick()
    if (origin?.isConnected) origin.focus()
  }
  return leave
}
onBeforeRouteLeave(confirmDeparture)
useWorkspaceSwitchGuard(confirmDeparture)
function beforeUnload(event: BeforeUnloadEvent): void {
  if (!hoursDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}
// Страница уходит вместе с окном и слушателем: ни подвисшего вопроса, ни «Покинуть сайт?» без причины.
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  decideLeave(false)
})
watch(hoursDirty, (dirty) => {
  if (dirty) window.addEventListener('beforeunload', beforeUnload)
  else window.removeEventListener('beforeunload', beforeUnload)
})

/** Первое чтение ещё идёт; повторное чтение и ошибка повтора различаются. */
const initialLoading = computed(() => organization.isPending.value || locations.isPending.value)
const refreshing = computed(
  () => !initialLoading.value && (organization.isFetching.value || locations.isFetching.value),
)
const refreshFailed = computed(
  () =>
    (organization.isError.value && Boolean(organization.data.value)) ||
    (locations.isError.value && Boolean(locations.data.value)),
)
function retryRefresh(): void {
  if (organization.isError.value) void organization.refetch()
  if (locations.isError.value) void locations.refetch()
}

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
  <div class="flex flex-col md:max-lg:-mx-2">
    <SettingsPageHead
      class="lg:[&_header]:gap-2"
      title="Компания и график"
      subtitle="Параметры компании, точки и рабочее время для проверки рисков."
    />

    <div
      v-if="!(locations.data.value && !allLocations.length)"
      class="flex h-[116px] items-start pt-[25px] lg:h-[94px] lg:items-center lg:pt-0"
    >
      <div v-if="refreshFailed" class="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <UiButton variant="secondary" class="md:shrink-0" @click="retryRefresh">
          Повторить обновление
        </UiButton>
        <div class="flex items-start gap-3" role="alert">
          <UiGlyph name="circle-alert" class="mt-0.5 size-5 shrink-0 text-danger" />
          <div>
            <p class="text-sm leading-5 font-medium text-danger-ink">
              Параметры компании не обновлены
            </p>
            <p class="text-xs leading-[18px] text-secondary">
              Показаны последние загруженные данные. Несохранённый график сохранён в форме.
            </p>
          </div>
        </div>
      </div>
      <p
        v-else-if="initialLoading || refreshing"
        class="flex items-center gap-3 text-meta text-secondary"
        role="status"
      >
        <UiSpinner class="size-4 text-brand" />
        {{
          initialLoading
            ? 'Загружаем данные…'
            : 'Обновляем данные. Предыдущие значения остаются на экране.'
        }}
      </p>
      <p v-else class="text-xs leading-[18px] text-secondary">
        Изменения сохраняются отдельно в каждом блоке.
      </p>
    </div>
    <div v-else class="h-6" />

    <div
      class="grid gap-6 md:grid-cols-2 md:items-start md:gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-stretch"
    >
      <section
        aria-labelledby="company-title"
        :class="[
          'min-w-0 rounded-[20px] border border-hairline bg-paper p-4 md:p-6 lg:rounded-[18px] lg:col-span-2',
          organization.isPending.value ? 'lg:min-h-[230px]' : '',
        ]"
      >
        <div class="flex items-center max-lg:min-h-[46px]">
          <h2 id="company-title" class="text-xl leading-7 font-semibold text-ink">Компания</h2>
        </div>
        <div class="mt-4">
          <div
            v-if="organization.isPending.value"
            role="status"
            aria-label="Загрузка компании"
            class="flex flex-col gap-4"
          >
            <div class="flex flex-col gap-4 lg:hidden">
              <UiSkeleton class="bg-line! h-2.5 w-1/3" />
              <UiSkeleton class="bg-line! h-input w-full" />
              <UiSkeleton class="bg-line! h-2.5 w-2/3" />
              <UiSkeleton class="bg-line! h-input w-full" />
            </div>
            <div
              class="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,1.875fr)_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <div
                v-for="label in ['Название компании', 'Основная валюта', 'Часовой пояс']"
                :key="label"
                class="min-w-0"
              >
                <p class="mb-2 text-sm font-medium text-ink">{{ label }}</p>
                <UiSkeleton class="bg-line! h-input w-full" />
              </div>
            </div>
            <div class="hidden flex-wrap items-center justify-between gap-4 lg:flex">
              <UiSkeleton class="bg-line! h-2.5 w-2/3" />
              <UiSkeleton class="bg-line! h-2.5 w-40" />
            </div>
          </div>
          <UiErrorState
            v-else-if="!organization.data.value"
            :error="organization.error.value"
            title="Не удалось загрузить компанию"
            @retry="organization.refetch()"
          />
          <OrganizationForm
            v-else
            :key="tenantId"
            :tenant-id="tenantId"
            :organization="organization.data.value"
          />
        </div>
      </section>

      <section
        v-if="locations.data.value && !allLocations.length"
        aria-labelledby="locations-title"
        class="flex min-w-0 flex-col gap-3 rounded-[20px] border border-hairline bg-paper p-4 md:p-6 lg:rounded-[18px]"
      >
        <h2 id="locations-title" class="text-xl leading-7 font-semibold text-ink">
          Точек пока нет
        </h2>
        <p class="text-sm leading-5 text-secondary">
          Добавьте точку, чтобы задать её часовой пояс и пороги ожидания.
        </p>
        <UiButton variant="secondary" class="md:w-[280px]" @click="openCreate">
          Добавить точку
        </UiButton>
      </section>
      <section
        v-else
        aria-labelledby="locations-title"
        class="min-w-0 rounded-[20px] border border-hairline bg-paper p-4 md:p-6 lg:rounded-[18px] lg:col-start-1"
      >
        <div
          class="flex min-h-[46px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-3"
        >
          <h2 id="locations-title" class="text-xl leading-7 font-semibold text-ink">Точки</h2>
          <UiButton
            v-if="!locations.isPending.value"
            variant="primary"
            class="w-full max-lg:border max-lg:border-line max-lg:bg-paper max-lg:text-ink lg:size-[46px] lg:shrink-0 lg:p-0"
            :disabled="hoursBusy"
            aria-label="Добавить точку"
            @click="openCreate"
          >
            <span class="lg:hidden">Добавить точку</span>
            <span class="hidden lg:block"><UiGlyph name="plus" class="size-5" /></span>
          </UiButton>
          <UiSkeleton v-else class="h-3 w-28" />
        </div>
        <div class="mt-4 border-t border-hairline lg:border-0">
          <div
            v-if="locations.isPending.value"
            role="status"
            aria-label="Загрузка точек"
            class="flex flex-col gap-5 pt-5"
          >
            <UiSkeleton class="bg-line! h-3 w-4/5" />
            <UiSkeleton class="bg-line! h-3 w-3/4" />
            <UiSkeleton class="bg-line! h-3 w-3/4" />
          </div>
          <UiErrorState
            v-else-if="!locations.data.value"
            class="mt-4"
            :error="locations.error.value"
            title="Не удалось загрузить точки"
            @retry="locations.refetch()"
          />
          <ul
            v-else
            class="divide-y divide-hairline lg:divide-y-0 lg:space-y-4"
            aria-label="Список точек"
          >
            <li
              v-for="location in allLocations"
              :key="location.id"
              class="flex min-w-0 flex-col py-4 lg:py-0"
            >
              <div
                :class="[
                  'hidden min-w-0 items-start rounded-field border lg:flex',
                  selectedId === location.id ? 'border-[#b4ceff] bg-[#eaf2ff]' : 'border-hairline',
                ]"
              >
                <button
                  type="button"
                  class="min-h-[72px] min-w-0 flex-1 rounded-field px-3 py-3 text-left"
                  :aria-pressed="selectedId === location.id"
                  :disabled="hoursBusy"
                  @click="selectLocation(location.id, $event.currentTarget as HTMLElement)"
                >
                  <span class="block break-words text-base leading-[22px] font-medium text-ink">{{
                    location.name
                  }}</span>
                  <span class="mt-2 block text-xs text-secondary">{{
                    location.businessHours.length ? 'График сохранён' : 'График не сохранён'
                  }}</span>
                </button>
                <button
                  type="button"
                  class="mr-3 flex size-11 shrink-0 items-center justify-center rounded-field text-brand"
                  aria-label="Изменить точку"
                  :disabled="hoursBusy"
                  @click="openEdit(location)"
                >
                  <UiGlyph name="pencil" class="size-[18px]" />
                </button>
              </div>
              <div class="flex items-center justify-between gap-3 lg:contents">
                <p class="text-base leading-6 font-semibold text-ink lg:hidden">
                  {{ location.name }}
                </p>
                <span
                  :class="[
                    'inline-flex h-[26px] items-center rounded-full px-3 text-xs lg:order-last lg:mt-4 lg:h-7 lg:w-fit lg:px-2.5',
                    location.active ? 'bg-success-pale text-success' : 'bg-segment text-secondary',
                  ]"
                >
                  {{ location.active ? 'Активна' : 'Неактивна' }}
                </span>
              </div>
              <div
                class="mt-4 break-words text-sm leading-5 text-secondary max-lg:mt-3 max-lg:text-base max-lg:leading-6"
              >
                <p>{{ timeZoneLabel(location.timezone) }}</p>
                <p>Порог ответа: {{ location.responseThresholdMinutes }} рабочих минут</p>
                <p>
                  <span class="lg:hidden">Ожидание следующего шага:</span
                  ><span class="hidden lg:inline">Следующий шаг:</span>
                  {{ location.agreementThresholdMinutes }} рабочих минут
                </p>
              </div>
              <p class="mt-2.5 text-xs leading-[18px] text-secondary lg:hidden">
                <template v-if="location.businessHours.length">
                  График: пн
                  {{
                    describeDay(
                      location.businessHours.find((day) => day.weekday === 1) ?? {
                        weekday: 1,
                        closed: true,
                      },
                    )
                  }}
                </template>
                <template v-else>График ещё не сохранён</template>
              </p>
              <UiButton
                variant="plain"
                class="mt-2.5 w-full text-field lg:hidden"
                :disabled="hoursBusy"
                @click="openEdit(location)"
              >
                Изменить точку
              </UiButton>
            </li>
          </ul>
        </div>
      </section>
      <section
        v-if="selected"
        aria-labelledby="schedule-title"
        class="min-w-0 rounded-[20px] border border-hairline bg-paper p-4 md:col-span-2 md:p-6 lg:col-span-1 lg:col-start-2 lg:row-start-2 lg:rounded-[18px]"
      >
        <div class="flex items-center justify-between gap-3">
          <h2
            id="schedule-title"
            class="min-w-0 break-words text-xl leading-7 font-semibold text-ink"
          >
            <span class="lg:hidden">График работы</span
            ><span class="hidden lg:inline">График · {{ selected.name }}</span>
          </h2>
          <span
            class="inline-flex h-[26px] items-center rounded-full bg-segment px-3 text-xs text-secondary"
          >
            {{ selected.businessHours.length && !hoursDirty ? 'Сохранён' : 'Не сохранён' }}
          </span>
        </div>
        <p class="mt-1.5 text-sm leading-5 text-secondary lg:mt-2">
          <span class="lg:hidden">{{ selected.name }} · </span
          >{{ timeZoneLabel(selected.timezone) }}
        </p>
        <label
          v-if="locationOptions.length > 1"
          class="mt-4 flex min-w-0 max-w-sm flex-col gap-2 text-sm font-medium text-ink lg:hidden"
        >
          Точка
          <UiSelect
            id="schedule-location"
            :key="selectKey"
            class="min-w-0 overflow-hidden text-ellipsis"
            :disabled="hoursBusy"
            :model-value="selectedId ?? ''"
            :options="locationOptions"
            @change="
              selectLocation(
                ($event.target as HTMLSelectElement).value,
                $event.target as HTMLElement,
              )
            "
          />
        </label>
        <div class="mt-3 lg:mt-4">
          <BusinessHoursEditor
            :key="`${tenantId}:${selected.id}`"
            :tenant-id="tenantId"
            :location="selected"
            appearance="settings"
            :intro="
              selected.businessHours.length
                ? 'Вне рабочего графика счётчик ожидания не растёт.'
                : 'Часы ниже — черновик для первой настройки.\nВне рабочего графика счётчик ожидания не растёт.'
            "
            @update:dirty="hoursDirty = $event"
            @busy="hoursBusy = $event"
          />
        </div>
      </section>
      <section
        v-else-if="locations.data.value"
        aria-labelledby="schedule-title"
        class="md:col-span-2 lg:col-span-1 lg:col-start-2 flex min-h-[180px] min-w-0 flex-col gap-3 rounded-[20px] border border-hairline bg-paper p-4 md:p-6 lg:rounded-[18px]"
      >
        <h2
          id="schedule-title"
          class="min-w-0 break-words text-xl leading-7 font-semibold text-ink"
        >
          График появится после добавления точки
        </h2>
        <p class="text-sm leading-5 text-secondary">
          Для каждой точки задаётся своя неделя и местное время.
        </p>
      </section>
      <section
        v-else-if="locations.isError.value"
        aria-labelledby="schedule-title"
        class="min-w-0 rounded-[20px] border border-hairline bg-paper p-4 md:col-span-2 md:p-6 lg:col-span-1 lg:col-start-2 lg:row-start-2 lg:rounded-[18px]"
      >
        <h2
          id="schedule-title"
          class="min-w-0 break-words text-xl leading-7 font-semibold text-ink"
        >
          График недоступен
        </h2>
        <p class="mt-3 text-sm text-secondary">
          Сначала повторите загрузку точек. Сохранённые графики не изменены.
        </p>
      </section>
      <section
        v-else
        aria-labelledby="schedule-title"
        class="md:col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-2 min-h-[660px] min-w-0 rounded-[20px] border border-hairline bg-paper p-4 md:p-6 lg:rounded-[18px]"
      >
        <h2
          id="schedule-title"
          class="min-w-0 break-words text-xl leading-7 font-semibold text-ink"
        >
          График работы
        </h2>
        <div role="status" aria-label="Загрузка графика" class="mt-3 flex flex-col">
          <UiSkeleton class="bg-line! h-3 w-3/4" />
          <UiSkeleton class="bg-line! mt-5 h-3 w-2/3" />
          <UiSkeleton class="bg-line! mt-8 h-3 w-1/4" />
          <ul class="mt-10 flex flex-col">
            <li
              v-for="day in WEEKDAYS"
              :key="day.weekday"
              class="flex h-[54px] items-center justify-between border-t border-transparent pl-[46px]"
            >
              <span class="text-note font-semibold text-ink">{{ day.label }}</span>
              <UiSkeleton class="bg-line! h-3 w-40" />
            </li>
          </ul>
          <div class="mt-4 flex items-center justify-between">
            <UiSkeleton class="bg-line! h-3 w-2/3" />
            <UiSkeleton class="bg-line! h-3 w-40" />
          </div>
        </div>
      </section>
    </div>

    <UiSheetDialog
      v-model:open="leaveOpen"
      title="Сохранить изменения графика?"
      description="У вас есть несохранённые изменения недельного расписания."
      description-in-body
      settings-form
      size="sm"
      footer-fill
    >
      <p
        class="text-base leading-6 font-semibold text-ink lg:text-sm lg:leading-5 lg:font-normal lg:text-ink"
      >
        Вернитесь к редактированию и сохраните всю неделю или продолжите без сохранения. Ранее
        сохранённый график останется без изменений.
      </p>
      <template #footer>
        <UiButton variant="secondary" @click="decideLeave(false)">К редактированию</UiButton>
        <UiButton variant="secondary" @click="decideLeave(true)">
          Продолжить без сохранения
        </UiButton>
      </template>
    </UiSheetDialog>

    <LocationFormDialog
      :key="tenantId"
      v-model:open="dialogOpen"
      :tenant-id="tenantId"
      :location="editing"
      :default-timezone="organization.data.value?.defaultTimezone ?? 'Europe/Moscow'"
    />
  </div>
</template>
