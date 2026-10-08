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
import { toRiskCard, useActiveRisksQuery, type RiskFilters } from '@/entities/risk'
import RiskCard from './RiskCard.vue'

const props = defineProps<{
  tenantId: string
  filters: RiskFilters
  timeZone: string
  /** Известно, что ни один источник сообщений не подключён. */
  sourceMissing?: boolean | undefined
  /** У пользователя есть право подключать источники. */
  canConnectSource?: boolean | undefined
}>()

const query = useActiveRisksQuery(toRef(props, 'tenantId'), toRef(props, 'filters'))

const cards = computed(() =>
  (query.data.value?.pages ?? []).flatMap((page) => page.items.map(toRiskCard)),
)
const loadedAt = computed(() =>
  query.dataUpdatedAt.value
    ? formatTime(new Date(query.dataUpdatedAt.value), props.timeZone)
    : null,
)

/** Опорное «сейчас» для относительного времени; обновляется раз в минуту. */
const now = ref(new Date())
const timer = setInterval(() => {
  now.value = new Date()
}, 60_000)
onScopeDispose(() => clearInterval(timer))
</script>

<template>
  <section aria-labelledby="risk-feed-title" class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 id="risk-feed-title" class="text-lg font-bold text-ink">Активные риски</h2>
      <div class="flex items-center gap-3 text-sm text-muted">
        <span v-if="loadedAt" role="status">Обновлено {{ loadedAt }}</span>
        <UiButton
          variant="secondary"
          size="sm"
          :loading="query.isFetching.value && !query.isFetchingNextPage.value"
          @click="query.refetch()"
        >
          Обновить
        </UiButton>
      </div>
    </div>

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
      class="flex flex-col gap-4"
      role="status"
      aria-label="Загрузка рисков"
    >
      <UiCard v-for="index in 3" :key="index">
        <UiSkeleton class="h-4 w-40" />
        <UiSkeleton class="mt-4 h-6 w-64" />
        <UiSkeleton class="mt-3 h-4 w-full max-w-xl" />
      </UiCard>
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
            ? 'Radar пока не получает переписку, поэтому рисков нет. Подключите Telegram или webhook: первые риски появятся вместе с сообщениями.'
            : 'Radar пока не получает переписку, поэтому рисков нет. Источник подключает владелец организации в разделе «Интеграции».'
        "
      >
        <template #icon>
          <UiIcon name="link-off" class="size-12" />
        </template>
        <template v-if="canConnectSource" #actions>
          <RouterLink
            :to="{ name: 'integrations' }"
            class="inline-flex h-11 items-center justify-center rounded-control bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Подключить источник
          </RouterLink>
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
      <ul class="flex flex-col gap-4" aria-label="Список активных рисков">
        <RiskCard
          v-for="card in cards"
          :key="card.id"
          :card="card"
          :time-zone="timeZone"
          :now="now"
        />
      </ul>
      <div class="flex justify-center py-2">
        <UiButton
          v-if="query.hasNextPage.value"
          variant="secondary"
          :loading="query.isFetchingNextPage.value"
          @click="query.fetchNextPage()"
        >
          Показать ещё
        </UiButton>
        <p v-else class="text-sm text-muted">Это все активные риски по выбранным фильтрам.</p>
      </div>
    </template>
  </section>
</template>
