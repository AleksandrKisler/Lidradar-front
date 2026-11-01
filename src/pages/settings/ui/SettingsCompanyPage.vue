<script setup lang="ts">
/**
 * «Настройки → Компания и график» (Figma 1189:10892, 1246:10274, 1277:11798 и состояния). Организация и точки
 * загружаются независимо: ошибка одного блока не скрывает другой. Смена
 * выбранной точки при несохранённом графике и уход со страницы требуют
 * подтверждения. Ошибка повторного чтения не стирает показанное: строка над карточками
 * предлагает «Повторить обновление».
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import {
  UiAlert,
  UiButton,
  UiErrorState,
  UiGlyph,
  UiSheetDialog,
  UiSkeleton,
  UiSpinner,
} from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { timeZoneLabel, useOrganizationQuery } from '@/entities/organization'
import { WEEKDAYS, useLocationsQuery, type Location } from '@/entities/location'
import { OrganizationForm } from '@/features/edit-organization'
import { LocationFormDialog } from '@/features/manage-locations'
import { BusinessHoursEditor } from '@/features/edit-business-hours'
import { useWorkspaceSwitchGuard } from '@/features/select-workspace'
import SettingsPageHead from './SettingsPageHead.vue'
import SettingsPointCard from './SettingsPointCard.vue'
import SettingsSaveStatus from './SettingsSaveStatus.vue'

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
// Keep first-configuration guidance stable through saving; switch/reload starts a new context.
const scheduleIntro = ref('')
watch(
  () => `${tenantId.value}:${selected.value?.id ?? ''}`,
  () => {
    scheduleIntro.value = selected.value?.businessHours.length
      ? 'Указано местное время точки.\nВне рабочего графика счётчик ожидания не растёт.'
      : 'Часы ниже — черновик для первой настройки.\nВне рабочего графика счётчик ожидания не растёт.'
  },
  { immediate: true },
)
type Status = 'saving' | 'saved' | 'error' | 'dirty' | 'idle'
const companyStatus = ref<Status>('idle')
const scheduleStatus = ref<Status>('idle')
function updateScheduleStatus(status: Status) {
  scheduleStatus.value = status
  if (status === 'saving')
    scheduleIntro.value =
      'Указано местное время точки.\nВне рабочего графика счётчик ожидания не растёт.'
}

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

async function selectLocation(id: string | undefined, trigger?: HTMLElement): Promise<void> {
  if (!id || id === selectedId.value || hoursBusy.value) return
  const origin =
    trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
  origin?.focus()
  if (hoursDirty.value && !(await askToLeave())) {
    await nextTick()
    if (origin?.isConnected) origin.focus()
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
const dialogTrigger = ref<HTMLElement | null>(null)
function returnDialogFocus(): HTMLElement | null {
  return dialogTrigger.value?.isConnected
    ? dialogTrigger.value
    : ([...document.querySelectorAll<HTMLElement>('[data-settings-add]')].find(
        (element) => element.getClientRects().length,
      ) ?? null)
}
const editing = ref<Location | null>(null)
function openCreate(event?: Event): void {
  dialogTrigger.value = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null
  dialogTrigger.value?.focus()
  editing.value = null
  dialogOpen.value = true
}
function openEdit(location: Location, trigger?: HTMLElement): void {
  dialogTrigger.value = trigger ?? null
  dialogTrigger.value?.focus()
  editing.value = location
  dialogOpen.value = true
}
</script>

<template>
  <div class="flex min-w-0 flex-col pb-2 md:max-lg:-mx-2">
    <SettingsPageHead
      title="Компания и график"
      subtitle="Параметры компании, точки и рабочее время для проверки рисков."
      scrolling-tabs
    />
    <div class="my-5 flex min-h-[66px] items-center md:my-6 md:min-h-[46px]">
      <div v-if="refreshFailed" class="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <UiButton variant="secondary" class="md:shrink-0" @click="retryRefresh"
          >Повторить обновление</UiButton
        >
        <UiAlert tone="danger" title="Параметры компании не обновлены">
          Показаны последние загруженные данные. Несохранённый график сохранён в форме.
        </UiAlert>
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
      <UiAlert v-else tone="warning" class="w-full"
        >Изменения сохраняются отдельно в каждом блоке.<template #icon
          ><UiGlyph name="circle-alert" class="size-5" /></template
      ></UiAlert>
    </div>

    <section
      aria-labelledby="company-title"
      class="min-w-0 rounded-[18px] border border-line bg-paper p-4 md:p-6"
    >
      <div class="flex min-h-7 items-center justify-between gap-3">
        <h2 id="company-title" class="text-xl leading-7 font-semibold text-ink">Компания</h2>
        <SettingsSaveStatus data-testid="settings-company-status" :status="companyStatus" />
      </div>
      <div class="mt-4">
        <div
          v-if="organization.isPending.value"
          role="status"
          aria-label="Загрузка компании"
          class="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          <UiSkeleton v-for="field in 3" :key="field" class="h-[74px]" />
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
          @status="companyStatus = $event"
        />
      </div>
    </section>

    <div
      data-testid="settings-points-schedule"
      class="mt-5 grid min-w-0 max-lg:rounded-[18px] max-lg:bg-paper max-lg:ring-1 max-lg:ring-inset max-lg:ring-line md:mt-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6"
    >
      <section
        aria-labelledby="locations-title"
        class="min-w-0 p-4 md:p-6 lg:rounded-[18px] lg:bg-paper lg:ring-1 lg:ring-inset lg:ring-line"
      >
        <div class="flex min-h-7 items-center justify-between gap-3">
          <h2 id="locations-title" class="text-xl leading-7 font-semibold text-ink">
            <span class="lg:hidden">Точки и график</span
            ><span class="hidden lg:inline">{{
              locations.data.value && !allLocations.length ? 'Точек пока нет' : 'Точки'
            }}</span>
          </h2>
          <button
            v-if="allLocations.length"
            type="button"
            class="hidden size-7 items-center justify-center rounded-field text-brand hover:bg-brand/10 disabled:opacity-50 lg:flex"
            aria-label="Добавить точку"
            :disabled="hoursBusy"
            data-settings-add
            @click="openCreate"
          >
            <UiGlyph name="plus" class="size-5" />
          </button>
        </div>
        <div
          v-if="locations.isPending.value"
          role="status"
          aria-label="Загрузка точек"
          class="mt-4 flex flex-col gap-4"
        >
          <UiSkeleton v-for="card in 3" :key="card" class="h-[54px]" />
        </div>
        <UiErrorState
          v-else-if="!locations.data.value"
          class="mt-4"
          :error="locations.error.value"
          title="Не удалось загрузить точки"
          @retry="locations.refetch()"
        />
        <template v-else-if="!allLocations.length">
          <h3 class="mt-4 text-base font-medium lg:hidden">Точек пока нет</h3>
          <p class="mt-3 text-sm leading-5 text-secondary">
            Добавьте точку, чтобы задать её часовой пояс и пороги ожидания.
          </p>
          <UiButton variant="secondary" class="mt-4 w-full" data-settings-add @click="openCreate"
            >Добавить точку</UiButton
          >
        </template>
        <ul
          v-else
          aria-label="Список точек"
          class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-1"
        >
          <li v-for="location in allLocations" :key="location.id" class="min-w-0">
            <SettingsPointCard
              :location="location"
              :selected="selectedId === location.id"
              :disabled="hoursBusy"
              @select="selectLocation(location.id, $event)"
              @edit="openEdit(location, $event)"
            />
          </li>
          <li class="lg:hidden">
            <button
              type="button"
              class="flex h-[54px] w-full items-center justify-between rounded-[12px] border border-[#b6cff2] pl-3 pr-4 text-base leading-[22px] font-medium text-link hover:border-brand disabled:opacity-50"
              :disabled="hoursBusy"
              data-settings-add
              @click="openCreate"
            >
              Добавить точку<UiGlyph name="plus" class="size-5" />
            </button>
          </li>
        </ul>
      </section>
      <section
        v-if="selected"
        aria-labelledby="schedule-title"
        class="min-w-0 border-line p-4 max-lg:border-t md:p-6 lg:rounded-[18px] lg:border lg:bg-paper"
      >
        <div class="flex items-start justify-between gap-3">
          <h2
            id="schedule-title"
            class="min-w-0 break-words text-xl leading-7 font-semibold text-ink"
          >
            <span class="md:hidden">График работы</span
            ><span class="hidden md:inline">График · {{ selected.name }}</span>
          </h2>
          <SettingsSaveStatus
            data-testid="settings-schedule-status"
            :status="scheduleStatus"
            schedule
          />
        </div>
        <p class="mt-2 text-sm leading-5 text-muted">
          <span class="mb-1 block text-base leading-6 font-medium text-ink md:hidden">{{
            selected.name
          }}</span
          >{{ timeZoneLabel(selected.timezone) }}
        </p>
        <div class="mt-4">
          <BusinessHoursEditor
            :key="`${tenantId}:${selected.id}`"
            :tenant-id="tenantId"
            :location="selected"
            appearance="settings"
            :intro="scheduleIntro"
            @update:dirty="hoursDirty = $event"
            @busy="hoursBusy = $event"
            @status="updateScheduleStatus"
          />
        </div>
      </section>
      <section
        v-else
        aria-labelledby="schedule-title"
        class="min-w-0 border-line p-4 max-lg:border-t md:p-6 lg:rounded-[18px] lg:border lg:bg-paper"
      >
        <h2 id="schedule-title" class="text-xl leading-7 font-semibold text-ink">
          {{
            locations.data.value
              ? 'График появится после добавления точки'
              : locations.isError.value
                ? 'График недоступен'
                : 'График работы'
          }}
        </h2>
        <p v-if="locations.data.value" class="mt-3 text-sm leading-5 text-secondary">
          Для каждой точки задаётся своя неделя и местное время.
        </p>
        <p v-else-if="locations.isError.value" class="mt-3 text-sm text-secondary">
          Сначала повторите загрузку точек. Сохранённые графики не изменены.
        </p>
        <div v-else role="status" aria-label="Загрузка графика" class="mt-4 flex flex-col gap-4">
          <UiSkeleton v-for="day in WEEKDAYS" :key="day.weekday" class="h-[54px]" />
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
      <p class="text-base leading-6 font-semibold text-ink lg:text-sm lg:leading-5 lg:font-normal">
        Вернитесь к редактированию и сохраните всю неделю или продолжите без сохранения. Ранее
        сохранённый график останется без изменений.
      </p>
      <template #footer>
        <UiButton variant="secondary" @click="decideLeave(false)">К редактированию</UiButton>
        <UiButton variant="secondary" @click="decideLeave(true)"
          >Продолжить без сохранения</UiButton
        >
      </template>
    </UiSheetDialog>
    <LocationFormDialog
      :key="tenantId"
      v-model:open="dialogOpen"
      :return-focus="returnDialogFocus"
      :tenant-id="tenantId"
      :location="editing"
      :default-timezone="organization.data.value?.defaultTimezone ?? 'Europe/Moscow'"
    />
  </div>
</template>
