<script setup lang="ts">
/**
 * Активная лента Radar с курсорной подгрузкой.
 *
 * Порядок карточек — серверный приоритет, страницы не пересортировываются.
 * Ошибка при обновлении не стирает последний успешный снимок: список
 * остаётся, а предупреждение указывает время последней удачной загрузки.
 * Пустое состояние показывается только после успешного пустого ответа.
 * Если известно, что источник сообщений не подключён, пустая лента говорит об
 * этом и ведёт к подключению: фраза «всё под контролем» при отсутствии
 * переписки была бы ложным успокоением.
 */
import { computed, onScopeDispose, ref, toRef } from 'vue'
import { RouterLink } from 'vue-router'
import { formatTime } from '@/shared/lib'
import {
  UiAlert,
  UiButton,
  UiCard,
  UiEmptyState,
  UiErrorState,
  UiIcon,
  UiSkeleton,
} from '@/shared/ui'
import {
  toRiskCard,
  useActiveRisksQuery,
  type RiskFeedStatus,
  type RiskFilters,
} from '@/entities/risk'
import RiskCard from './RiskCard.vue'

const props = defineProps<{
  tenantId: string
  filters: RiskFilters
  /** Вкладка статуса; без неё — все активные риски. */
  status?: RiskFeedStatus | null | undefined
  timeZone: string
  /** Известно, что ни один источник сообщений не подключён. */
  sourceMissing?: boolean | undefined
  /** У пользователя есть право подключать источники. */
  canConnectSource?: boolean | undefined
  /** Число активных рисков по фильтрам из сводки; без него заголовок идёт без счётчика. */
  total?: number | undefined
  /** Имена точек по идентификатору для подписи карточки. */
  locationNames?: Record<string, string> | undefined
}>()

const query = useActiveRisksQuery(
  toRef(props, 'tenantId'),
  toRef(props, 'filters'),
  toRef(props, 'status'),
)

const cards = computed(() =>
  (query.data.value?.pages ?? []).flatMap((page) => page.items.map(toRiskCard)),
)
const loadedAt = computed(() =>
  query.dataUpdatedAt.value
    ? formatTime(new Date(query.dataUpdatedAt.value), props.timeZone)
    : null,
)

/** Представление ленты: плитки или список (Figma 21:1982 / 21:1753). */
const VIEW_KEY = 'lidradar.radar.view'
function readView(): 'tiles' | 'list' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'tiles'
  } catch {
    return 'tiles'
  }
}
const view = ref<'tiles' | 'list'>(readView())
function selectView(value: 'tiles' | 'list'): void {
  view.value = value
  // Выбор — удобство отдельного устройства: недоступное хранилище не мешает работе.
  try {
    localStorage.setItem(VIEW_KEY, value)
  } catch {
    /* хранилище недоступно */
  }
}
/** Строка списка вмещается от планшета; на телефоне список — те же карточки (Figma 630:7726). */
const wide = ref(false)
const wideQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(min-width: 768px)')
    : null
if (wideQuery) {
  wide.value = wideQuery.matches
  const onChange = (event: MediaQueryListEvent) => (wide.value = event.matches)
  wideQuery.addEventListener('change', onChange)
  onScopeDispose(() => wideQuery.removeEventListener('change', onChange))
}
const cardView = computed(() => (view.value === 'list' && wide.value ? 'list' : 'tiles'))
const views = [
  { value: 'list', label: 'Список' },
  { value: 'tiles', label: 'Плитки' },
] as const

/** Ручное обновление ленты: кнопка живёт в заголовке страницы. */
const refreshing = computed(() => query.isFetching.value && !query.isFetchingNextPage.value)
function refresh(): void {
  void query.refetch()
}
defineExpose({ refresh, refreshing, loadedAt })

/** Опорное «сейчас» для относительного времени; обновляется раз в минуту. */
const now = ref(new Date())
const timer = setInterval(() => {
  now.value = new Date()
}, 60_000)
onScopeDispose(() => clearInterval(timer))
</script>

<template>
  <section aria-labelledby="risk-feed-title" class="@container flex flex-col gap-5">
    <div class="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-4">
      <h2 id="risk-feed-title" class="text-xl leading-7 font-semibold text-ink">
        Требуют внимания<template v-if="total !== undefined"
          ><span class="max-lg:hidden"> · {{ total }}</span></template
        >
      </h2>
      <slot name="filters-button" />
      <div class="flex w-full items-center justify-between gap-4 lg:w-auto">
        <p class="text-sm leading-5 text-muted">Сначала важные ↓</p>
        <div
          class="flex gap-1 rounded-field bg-segment max-lg:h-11 lg:mr-7 lg:h-8"
          role="group"
          aria-label="Представление"
        >
          <button
            v-for="item in views"
            :key="item.value"
            type="button"
            :aria-pressed="view === item.value"
            :class="[
              'rounded-field text-sm leading-5 font-medium max-lg:h-11 max-lg:w-[85px] max-lg:text-base lg:h-8 lg:w-[94px]',
              view === item.value
                ? 'border border-line bg-paper text-brand'
                : 'text-secondary hover:text-ink',
            ]"
            @click="selectView(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </div>

    <slot name="filters" />

    <UiAlert
      v-if="query.isError.value && cards.length"
      tone="warning"
      title="Не удалось обновить данные"
    >
      Показан последний успешный снимок<template v-if="loadedAt"> ({{ loadedAt }})</template>.
      Прежние значения не заменены нулями.
    </UiAlert>

    <div
      v-if="query.isPending.value"
      :class="
        view === 'tiles'
          ? 'grid gap-x-4 gap-y-5 @[560px]:grid-cols-2 @[900px]:grid-cols-3'
          : 'flex flex-col gap-4'
      "
      role="status"
      aria-label="Загрузка рисков"
    >
      <div
        v-for="index in 3"
        :key="index"
        class="rounded-[14px] border border-hairline bg-paper p-5"
      >
        <UiSkeleton class="h-7 w-28" />
        <UiSkeleton class="mt-4 h-6 w-48" />
        <UiSkeleton class="mt-3 h-4 w-full max-w-xl" />
        <UiSkeleton class="mt-8 h-16 w-full" />
      </div>
    </div>

    <UiErrorState
      v-else-if="query.isError.value && !cards.length"
      :error="query.error.value"
      title="Не удалось загрузить риски"
      @retry="query.refetch()"
    />

    <UiCard v-else-if="!cards.length && sourceMissing" :padded="false">
      <UiEmptyState
        title="Источник сообщений не подключён"
        :description="
          canConnectSource
            ? 'Radar пока не получает переписку, поэтому рисков нет. Подключите Telegram: первые риски появятся вместе с сообщениями.'
            : 'Radar пока не получает переписку, поэтому рисков нет. Источник подключает владелец организации в разделе «Интеграции».'
        "
      >
        <template #icon>
          <UiIcon name="link-off" class="size-12" />
        </template>
        <template v-if="canConnectSource" #actions>
          <RouterLink
            :to="{ name: 'integrations' }"
            class="inline-flex h-input items-center justify-center rounded-button bg-brand px-6 text-field leading-5 font-medium text-white hover:bg-brand-dark"
          >
            Подключить Telegram
          </RouterLink>
        </template>
      </UiEmptyState>
    </UiCard>

    <UiCard v-else-if="!cards.length && status" :padded="false">
      <UiEmptyState
        :title="status === 'OPEN' ? 'Новых рисков нет' : 'Нет рисков в работе'"
        description="В этой вкладке сейчас пусто. Откройте «Все риски», чтобы увидеть остальные активные ситуации."
      >
        <template #icon>
          <UiIcon name="check-circle" class="size-12" />
        </template>
      </UiEmptyState>
    </UiCard>

    <UiCard v-else-if="!cards.length" :padded="false">
      <UiEmptyState
        title="Сейчас всё под контролем"
        description="Активных рисков нет. Новые ситуации появятся здесь автоматически: мы продолжаем проверять переписку."
      >
        <template #icon>
          <UiIcon name="check-circle" class="size-12" />
        </template>
      </UiEmptyState>
    </UiCard>

    <template v-else>
      <ul
        :class="
          cardView === 'tiles'
            ? 'grid gap-x-4 gap-y-5 @[560px]:grid-cols-2 @[900px]:grid-cols-3'
            : 'flex flex-col gap-4'
        "
        aria-label="Список активных рисков"
      >
        <RiskCard
          v-for="card in cards"
          :key="card.id"
          :card="card"
          :time-zone="timeZone"
          :now="now"
          :view="cardView"
          :location-names="locationNames"
        />
      </ul>
      <div class="flex flex-col items-center gap-2 pt-1 pb-2 text-center text-muted">
        <UiButton
          v-if="query.hasNextPage.value"
          variant="secondary"
          :loading="query.isFetchingNextPage.value"
          @click="query.fetchNextPage()"
        >
          Показать ещё
        </UiButton>
        <p v-else class="text-sm leading-5">
          {{
            status
              ? 'Это все риски этой вкладки по выбранным фильтрам.'
              : 'Это все активные риски по выбранным фильтрам.'
          }}
        </p>
        <p class="text-xs leading-[18px]">
          LidRadar помогает выбрать следующий шаг. Решение и ответ клиенту — за вами.
        </p>
      </div>
    </template>
  </section>
</template>
