<script setup lang="ts">
/**
 * Шаг 2 «Точки и графики» (US-M02-04, Figma 927:13052, 12 состояний × 3 размера). Один экран:
 * на desktop/tablet слева карточки точек, справа график выбранной; на телефоне — селектор точки
 * и график ниже. Плюс открывает «Добавить точку», карандаш — «Изменить точку» (окна настроек).
 *
 * Черновики недель принадлежат ID точки и живут в модели страницы (`useLocationStep`): выбор
 * другой точки ничего не сохраняет и не спрашивает. Новая точка создаётся POST и сразу получает
 * PUT стандартной недели 10:00–19:00; после подтверждённого POST повторяется только PUT.
 * «Сохранить и продолжить» проверяет весь список и сохраняет все нужные недели.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { isUnknownResult } from '@/shared/api'
import {
  UiButton,
  UiErrorState,
  UiGlyph,
  UiPageIntro,
  UiSelect,
  UiSpinner,
  type UiSelectOption,
} from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { timeZoneLabel, useOrganizationQuery } from '@/entities/organization'
import { defaultWeek, useLocationsQuery, type DayDraft, type Location } from '@/entities/location'
import { LocationFormDialog } from '@/features/manage-locations'
import { BusinessHoursFields } from '@/features/edit-business-hours'
import { blockReasonText, draftErrors, isDraftValid, useLocationStep } from '../model/location-step'

const router = useRouter()
const session = useSessionStore()
const tenantId = computed(() => session.tenantId ?? '')
const organization = useOrganizationQuery(() => session.tenantId)
const locations = useLocationsQuery(() => session.tenantId)

const step = useLocationStep({
  tenantId: () => session.tenantId,
  userId: () => session.user?.id ?? null,
})
watch(
  () => locations.data.value,
  (list) => {
    if (list) step.merge(list)
  },
  { immediate: true },
)
// При открытии шага — свежий список: незавершённая инициализация восстанавливается по серверным данным.
onMounted(() => {
  if (locations.data.value) void locations.refetch()
})
let disposed = false
onBeforeUnmount(() => {
  disposed = true
})

const loading = computed(() => locations.isPending.value)
const loadFailed = computed(() => locations.isError.value && !locations.data.value)
const drafts = computed(() => step.drafts.value)
const selected = computed(() => step.selected.value)

/** Окно точки: создание (`location = null`) или изменение выбранной. */
const dialog = ref<{ open: boolean; location: Location | null }>({ open: false, location: null })
const dialogBusy = ref(false)
let knownBeforeCreate = new Set<string>()
/** Метка контекста при открытии окна: поздний ответ другой организации не применяется. */
let dialogToken = -1
const busy = computed(() => step.busy.value !== null || dialogBusy.value)
/** Команда шага идёт: карточки приглушены целиком (Figma 10 — 0.55 слева, 0.60 справа), поля не сереют. */
const saving = computed(() => step.busy.value !== null)
const locked = computed(() => loading.value || busy.value)

function openCreate(): void {
  if (locked.value) return
  knownBeforeCreate = new Set(drafts.value.map((draft) => draft.id))
  dialogToken = step.token()
  dialog.value = { open: true, location: null }
}
// Смена организации или пользователя закрывает окно: его форма относится к прежнему контексту.
watch(
  () => `${session.user?.id ?? ''}|${session.tenantId ?? ''}`,
  () => {
    dialog.value = { open: false, location: null }
  },
)
function openEdit(id: string): void {
  if (locked.value) return
  const location = locations.data.value?.find((item) => item.id === id)
  if (!location) return
  dialogToken = step.token()
  dialog.value = { open: true, location }
}
function onDialogSaved(location: Location): void {
  if (dialog.value.location) step.applyPatched(location, dialogToken)
  else void step.addCreated(location, dialogToken)
}
/** Неизвестный исход POST: сверка списка без повтора; новая точка открывается для повтора PUT. */
async function onDialogFailed(error: unknown): Promise<void> {
  if (dialog.value.location || !isUnknownResult(error)) return
  const created = await step.reconcileCreate(knownBeforeCreate, dialogToken)
  if (created && !disposed) dialog.value = { open: false, location: null }
}

function selectLocation(id: string): void {
  step.select(id)
}
function updateDays(days: DayDraft[]): void {
  if (selected.value) step.updateDays(selected.value.id, days)
}

const locationOptions = computed<UiSelectOption[]>(() =>
  drafts.value.map((draft) => ({ value: draft.id, label: draft.name })),
)
const selectedErrors = computed(() => (selected.value ? draftErrors(selected.value.days) : {}))
const selectedInvalid = computed(() => !!selected.value && !isDraftValid(selected.value))
const placeholderWeek = defaultWeek()

/** Сообщение о неудачной записи выбранной точки или команде шага. */
const notice = computed<{
  tone: 'danger' | 'info'
  title: string
  text: string
  action?: string
  busy?: boolean
} | null>(() => {
  const draft = selected.value
  if (draft && draft.baseline === null && draft.write === 'pending')
    return {
      tone: 'info',
      title: 'Сохраняем график точки…',
      text: 'Точка создана. Сохраняем стандартную неделю 10:00–19:00.',
      busy: true,
    }
  if (draft && draft.baseline === null) {
    if (draft.write === 'idle')
      return {
        tone: 'info',
        title: 'График точки ещё не сохранён',
        text: 'Стандартная неделя предзаполнена. Сохраните её или измените часы.',
        action: 'Сохранить график',
      }
    return {
      tone: 'danger',
      title: 'Не удалось сохранить график точки',
      text:
        draft.write === 'unknown'
          ? 'Не удалось проверить, сохранился ли график. Точка создана, часы остаются на экране.'
          : 'Точка создана, часы остаются на экране. Повторите сохранение графика.',
      action: 'Повторить сохранение',
    }
  }
  const failure = step.failure.value
  if (failure?.kind === 'diverged') {
    const name = drafts.value.find((item) => item.id === failure.locationId)?.name
    return {
      tone: 'danger',
      title: 'График на сервере отличается от сохранённого',
      text: `После сохранения у точки «${name ?? ''}» на сервере оказались другие часы. Ваши часы остаются на экране — проверьте их и сохраните снова.`,
    }
  }
  if (draft && ['rejected', 'unknown', 'diverged'].includes(draft.write))
    return {
      tone: 'danger',
      title: 'Не удалось сохранить графики',
      text: 'Введённые часы остаются на экране. Попробуйте ещё раз.',
    }
  if (failure?.kind === 'read')
    return {
      tone: 'danger',
      title: 'Не удалось проверить сохранение графиков',
      text: 'Введённые часы остаются на экране. Попробуйте ещё раз.',
    }
  if (failure?.kind === 'incomplete')
    return {
      tone: 'danger',
      title: 'Сохранение графиков не подтвердилось',
      text: 'Проверьте часы точек и повторите сохранение.',
    }
  return null
})
const retryVisible = computed(
  () =>
    step.failure.value?.kind === 'read' ||
    step.failure.value?.kind === 'incomplete' ||
    step.failure.value?.kind === 'diverged' ||
    drafts.value.some(
      (draft) =>
        draft.baseline !== null && ['rejected', 'unknown', 'diverged'].includes(draft.write),
    ),
)

/** Подсказка над кнопкой шага: телефон и desktop/планшет могут называть причину по-разному. */
const hint = computed<{ desktop: string; phone?: string }>(() => {
  if (loading.value) return { desktop: 'Загружаем точки и графики…' }
  if (step.busy.value === 'init') return { desktop: 'Сохраняем график точки…' }
  const reason = step.blockReason.value
  if (!reason) return { desktop: 'Далее: Услуги и цены' }
  const desktop = blockReasonText(reason, 'desktop')
  const phone = blockReasonText(reason, 'phone')
  return phone === desktop ? { desktop } : { desktop, phone }
})
/** Шаг готов к сохранению, если не считать открытого окна точки. */
const readyBesidesDialog = computed(
  () =>
    !loading.value &&
    !busy.value &&
    session.tenantId !== null &&
    drafts.value.length > 0 &&
    step.blockReason.value === null,
)
const canContinue = computed(() => readyBesidesDialog.value && !dialog.value.open)
/**
 * Серый вид недоступной кнопки — по причине самого шага. Открытое окно его не меняет:
 * без точек кнопка под окном серая, у готового шага — обычная (Figma 02/06/07).
 */
const continueGrey = computed(() => !readyBesidesDialog.value && step.busy.value === null)
/** Готовый шаг под открытым окном: кнопка недоступна, но не бледнеет (Figma 06). */
const continueBehindDialog = computed(() => readyBesidesDialog.value && dialog.value.open)

async function continueToServices(): Promise<void> {
  if (!canContinue.value) return
  const saved = await step.saveAll()
  if (saved && !disposed) await router.push({ name: 'onboarding-services' })
}

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
</script>

<template>
  <div class="flex flex-col">
    <UiPageIntro
      wide
      title="Точки и графики работы"
      title-mobile="Точки и графики"
      :description="'Добавьте точки и настройте часы работы для каждой.\nВне рабочего графика счётчик ожидания ответа не растёт.'"
      description-mobile="Добавьте точки и укажите рабочие часы каждой."
    />

    <UiErrorState
      v-if="loadFailed"
      :error="locations.error.value"
      title="Не удалось загрузить точки"
      @retry="locations.refetch()"
    />
    <div v-else class="flex flex-col gap-4 md:flex-row md:items-stretch lg:gap-6">
      <section
        aria-labelledby="points-title"
        :class="[
          'flex flex-col gap-2 md:w-[296px] md:shrink-0 md:gap-4 md:rounded-card md:border md:border-hairline md:bg-paper md:p-[23px] lg:w-[320px]',
          saving ? 'md:opacity-55' : '',
        ]"
      >
        <div class="flex h-[46px] items-center justify-between gap-3 md:gap-4">
          <h2 id="points-title" class="text-xl font-semibold text-ink">Точки</h2>
          <button
            type="button"
            :class="[
              'flex size-[46px] shrink-0 items-center justify-center rounded-button bg-brand text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-line disabled:text-muted',
              focusRing,
            ]"
            aria-label="Добавить точку"
            title="Добавить точку"
            data-testid="add-location"
            :disabled="locked"
            @click="openCreate"
          >
            <UiGlyph name="plus" class="size-5" />
          </button>
        </div>

        <div
          v-if="loading"
          class="flex flex-col items-center justify-center gap-2 text-center md:flex-1"
          role="status"
          aria-label="Загрузка точек"
        >
          <p
            class="text-sm leading-5 text-secondary md:text-base md:leading-[22px] md:font-medium md:text-ink"
          >
            Загружаем точки…
          </p>
          <p class="text-sm leading-5 text-secondary max-md:hidden">Пожалуйста, подождите.</p>
        </div>
        <div
          v-else-if="drafts.length === 0"
          class="flex flex-col items-center justify-center gap-2 text-center md:flex-1"
        >
          <p
            class="text-sm leading-5 text-secondary md:text-base md:leading-[22px] md:font-medium md:text-ink"
          >
            Точек пока нет
          </p>
          <p class="max-w-[232px] text-sm leading-5 text-secondary max-md:hidden">
            Добавьте первую точку, чтобы настроить её график работы.
          </p>
        </div>
        <template v-else>
          <ul class="flex flex-col gap-4 max-md:hidden" aria-label="Точки">
            <li v-for="draft in drafts" :key="draft.id" class="relative">
              <button
                type="button"
                :class="[
                  'flex min-h-[76px] w-full flex-col gap-2 rounded-control border p-3 text-left disabled:cursor-not-allowed',
                  draft.id === selected?.id
                    ? 'border-[#b6cff2] bg-[#eaf3ff]'
                    : 'border-line bg-paper enabled:hover:bg-canvas',
                  busy && !saving ? 'opacity-60' : '',
                  focusRing,
                ]"
                :aria-pressed="draft.id === selected?.id"
                :aria-describedby="`location-status-${draft.id}`"
                :disabled="busy"
                data-testid="location-card"
                @click="selectLocation(draft.id)"
              >
                <span class="pr-[52px] text-base leading-[22px] font-medium break-words text-ink">{{
                  draft.name
                }}</span>
                <span
                  :id="`location-status-${draft.id}`"
                  :class="[
                    'text-sm leading-5 whitespace-nowrap',
                    isDraftValid(draft) ? 'text-secondary' : 'text-danger-ink',
                  ]"
                  >{{ isDraftValid(draft) ? 'График заполнен' : 'График заполнен неверно' }}</span
                >
              </button>
              <button
                type="button"
                :class="[
                  'absolute top-px right-3 flex size-11 items-center justify-center rounded-button text-link hover:bg-black/5 disabled:cursor-not-allowed',
                  saving ? '' : 'disabled:opacity-50',
                  focusRing,
                ]"
                :aria-label="`Изменить точку «${draft.name}»`"
                :title="`Изменить точку «${draft.name}»`"
                :disabled="locked"
                @click="openEdit(draft.id)"
              >
                <UiGlyph name="pencil" class="size-[18px]" />
              </button>
            </li>
          </ul>

          <div class="flex flex-col gap-2 md:hidden">
            <div class="flex items-center gap-4">
              <label class="min-w-0 flex-1">
                <span class="sr-only">Точка</span>
                <UiSelect
                  :model-value="selected?.id ?? ''"
                  name="location"
                  :options="locationOptions"
                  :described-by="selectedInvalid ? 'location-select-status' : undefined"
                  :disabled="busy"
                  @update:model-value="selectLocation(String($event))"
                />
              </label>
              <button
                type="button"
                :class="[
                  'flex size-11 shrink-0 items-center justify-center rounded-button text-link disabled:opacity-50',
                  focusRing,
                ]"
                :aria-label="`Изменить точку «${selected?.name ?? ''}»`"
                :disabled="locked || !selected"
                @click="selected && openEdit(selected.id)"
              >
                <UiGlyph name="pencil" class="size-[18px]" />
              </button>
            </div>
            <!-- Состояние выбранной точки под селектором (Figma phone-08), как статус карточки. -->
            <p
              v-if="selectedInvalid"
              id="location-select-status"
              class="text-sm leading-5 text-danger-ink"
            >
              График заполнен неверно
            </p>
            <button
              v-if="step.otherInvalid.value"
              type="button"
              :class="[
                'flex min-h-11 flex-col items-start p-0.5 text-left text-sm leading-5 font-medium text-danger-ink disabled:opacity-60',
                focusRing,
              ]"
              :disabled="busy"
              @click="selectLocation(step.otherInvalid.value.id)"
            >
              <span>График заполнен неверно:</span>
              <span class="break-words">{{ step.otherInvalid.value.name }}</span>
            </button>
          </div>
        </template>
      </section>

      <section
        aria-labelledby="hours-title"
        :aria-busy="loading || step.busy.value !== null || undefined"
        :class="[
          'min-w-0 flex-1 rounded-card border border-line bg-paper px-[19px] pb-2 md:border-hairline md:px-[23px] md:pb-1.5',
          saving ? 'opacity-60' : '',
        ]"
      >
        <div class="flex flex-col gap-2 pt-4 md:gap-1.5 md:pt-[18px]">
          <div class="flex flex-col md:flex-row md:items-baseline md:justify-between md:gap-4">
            <h2 id="hours-title" class="text-field leading-6 font-semibold break-words text-ink">
              {{ selected ? `График · ${selected.name}` : 'График работы' }}
            </h2>
            <p class="shrink-0 text-sm leading-5 text-secondary">
              {{ selected ? timeZoneLabel(selected.timezone) : 'Часовой пояс точки' }}
            </p>
          </div>
          <p v-if="loading" class="text-sm leading-5 text-secondary">Загружаем точки и графики…</p>
          <div
            v-else-if="!selected"
            class="rounded-control border border-[#b6cff2] bg-[#eaf3ff] p-3"
            role="status"
          >
            <p class="text-base leading-[22px] font-medium text-ink">Сначала добавьте точку</p>
            <p class="mt-1 text-sm leading-5 text-secondary">
              После создания точки график станет доступен.
            </p>
          </div>
          <div
            v-else-if="notice"
            :class="[
              'rounded-control border p-3',
              notice.tone === 'danger'
                ? 'border-danger-ink bg-danger-pale'
                : 'border-[#b6cff2] bg-[#eaf3ff]',
            ]"
            :role="notice.tone === 'danger' ? 'alert' : 'status'"
          >
            <p
              :class="[
                'flex items-center gap-2 text-base leading-[22px] font-medium',
                notice.tone === 'danger' ? 'text-danger-ink' : 'text-ink',
              ]"
            >
              <UiSpinner v-if="notice.busy" class="size-4 text-brand" />
              {{ notice.title }}
            </p>
            <p class="mt-1 text-sm leading-5 text-secondary">{{ notice.text }}</p>
            <UiButton
              v-if="notice.action"
              variant="secondary"
              size="sm"
              class="mt-3"
              :disabled="busy || !isDraftValid(selected)"
              @click="step.initialize(selected.id)"
            >
              {{ notice.action }}
            </UiButton>
          </div>
          <p v-else class="text-sm leading-5 text-secondary">
            Рабочие часы учитываются при проверке ожидания ответа.
          </p>
        </div>
        <BusinessHoursFields
          v-if="selected"
          :key="selected.id"
          class="mt-2 md:mt-1.5"
          :days="selected.days"
          :errors="selectedErrors"
          :disabled="busy"
          :id-prefix="`location-${selected.id}`"
          @update:days="updateDays"
        />
        <BusinessHoursFields
          v-else
          class="mt-2 md:mt-1.5"
          :days="placeholderWeek"
          :errors="{}"
          placeholder
          :blank="loading"
          id-prefix="location-none"
        />
      </section>
    </div>

    <div
      class="mt-4 flex flex-col gap-2 max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-4 max-md:border-t max-md:border-line max-md:bg-paper max-md:p-4 max-md:pb-[22px] md:gap-6"
    >
      <p id="location-step-hint" class="text-sm leading-5 text-secondary" aria-live="polite">
        <template v-if="hint.phone">
          <span class="md:hidden" data-hint="phone">{{ hint.phone }}</span>
          <span class="max-md:hidden" data-hint="desktop">{{ hint.desktop }}</span>
        </template>
        <template v-else>{{ hint.desktop }}</template>
      </p>
      <div class="flex items-center justify-between gap-3 md:gap-4">
        <UiButton
          variant="secondary"
          class="w-[82px] shrink-0 md:w-[100px]"
          :disabled="busy"
          @click="router.push({ name: 'onboarding-company' })"
        >
          Назад
        </UiButton>
        <UiButton
          class="min-w-0 flex-1 max-[360px]:whitespace-normal md:w-[290px] md:flex-none"
          :class="
            continueGrey
              ? 'bg-line! text-muted! opacity-100!'
              : continueBehindDialog
                ? 'opacity-100!'
                : ''
          "
          :disabled="!canContinue"
          :loading="step.busy.value !== null"
          aria-describedby="location-step-hint"
          data-testid="location-continue"
          @click="continueToServices"
        >
          <template v-if="step.busy.value !== null">
            <span aria-hidden="true">Сохраняем…</span
            ><span class="sr-only">Сохранить и продолжить</span>
          </template>
          <template v-else-if="retryVisible">Повторить сохранение</template>
          <template v-else>Сохранить и продолжить</template>
        </UiButton>
      </div>
    </div>

    <LocationFormDialog
      v-model:open="dialog.open"
      context="onboarding"
      :tenant-id="tenantId"
      :location="dialog.location"
      :default-timezone="organization.data.value?.defaultTimezone ?? 'Europe/Moscow'"
      @saved="onDialogSaved"
      @failed="onDialogFailed"
      @busy="dialogBusy = $event"
    />
  </div>
</template>
