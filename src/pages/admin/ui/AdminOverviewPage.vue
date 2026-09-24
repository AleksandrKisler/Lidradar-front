<script setup lang="ts">
/** Обзор: состояние очередей одним снимком с временем проверки сервера. */
import { computed } from 'vue'
import { formatDateTime } from '@/shared/lib'
import { UiCard, UiErrorState, UiSkeleton } from '@/shared/ui'
import { useQueueStatsQuery, type AdminLifecycleCounts } from '@/entities/admin'
import { SnapshotBar } from '@/widgets/admin-shell'

const queue = useQueueStatsQuery()

const lifecycle = (title: string, counts: AdminLifecycleCounts) => ({
  title,
  rows: [
    ['Ожидают', counts.pending],
    ['Выполняются', counts.processing],
    ['Повтор', counts.retry],
    ['Мёртвые', counts.dead],
    ['Просроченные аренды', counts.expiredLeases],
  ] as [string, number][],
})

const groups = computed(() => {
  const data = queue.data.value
  if (!data) return []
  return [
    lifecycle('Задания', data.jobs),
    lifecycle('Outbox', data.outbox),
    {
      title: 'AI-задания',
      rows: [
        ['Ожидают', data.aiJobs.pending],
        ['Выданы узлам', data.aiJobs.leased],
        ['Выполняются', data.aiJobs.running],
        ['Повтор', data.aiJobs.retry],
        ['Мёртвые', data.aiJobs.dead],
        ['Узлов готово', data.aiJobs.nodesReady],
      ] as [string, number][],
    },
    {
      title: 'Доставки уведомлений',
      rows: [
        ['Ожидают', data.deliveries.pending],
        ['Выполняются', data.deliveries.processing],
        ['Повтор', data.deliveries.retry],
        ['Мёртвые', data.deliveries.dead],
      ] as [string, number][],
    },
  ]
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <SnapshotBar
      :updated-at="queue.dataUpdatedAt.value"
      :loading="queue.isFetching.value"
      @refresh="queue.refetch()"
    />
    <div v-if="queue.isPending.value" role="status" aria-label="Загрузка очередей">
      <UiSkeleton class="h-32 w-full" />
    </div>
    <UiErrorState
      v-else-if="queue.isError.value"
      :error="queue.error.value"
      title="Не удалось загрузить очереди"
      @retry="queue.refetch()"
    />
    <template v-else-if="queue.data.value">
      <div class="grid gap-4 sm:grid-cols-2">
        <UiCard class="border-danger/40">
          <p class="text-sm text-muted">Мёртвых без обработки</p>
          <p class="mt-2 text-3xl font-bold text-danger tabular-nums" data-testid="dead-unhandled">
            {{ queue.data.value.deadUnhandled }}
          </p>
          <p class="mt-2 text-xs text-muted">Во всех очередях, ещё не отложены</p>
        </UiCard>
        <UiCard>
          <p class="text-sm text-muted">Просроченных по расписанию</p>
          <p class="mt-2 text-3xl font-bold text-ink tabular-nums">
            {{ queue.data.value.scheduledOverdue }}
          </p>
          <p class="mt-2 text-xs text-muted">
            Проверено сервером {{ formatDateTime(queue.data.value.checkedAt, 'UTC') }} UTC
          </p>
        </UiCard>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <UiCard v-for="group in groups" :key="group.title" as="section" :aria-label="group.title">
          <h2 class="text-sm font-semibold text-ink">{{ group.title }}</h2>
          <dl class="mt-3 flex flex-col gap-2 text-sm">
            <div
              v-for="[label, value] in group.rows"
              :key="label"
              class="flex justify-between gap-3"
            >
              <dt class="text-muted">{{ label }}</dt>
              <dd class="font-semibold text-ink tabular-nums">{{ value }}</dd>
            </div>
          </dl>
        </UiCard>
      </div>
    </template>
  </div>
</template>
