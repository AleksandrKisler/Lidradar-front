<script setup lang="ts">
/** Подключения всех организаций: состояние и очередь сырых событий. */
import { formatDateTime } from '@/shared/lib'
import { UiBadge, UiCard, UiEmptyState, UiErrorState, UiSkeleton } from '@/shared/ui'
import { adminStatusLabel, adminStatusTone, useAdminConnectionsQuery } from '@/entities/admin'
import { IdCell, SnapshotBar } from '@/widgets/admin-shell'

const connections = useAdminConnectionsQuery()
</script>

<template>
  <div class="flex flex-col gap-6">
    <SnapshotBar
      :updated-at="connections.dataUpdatedAt.value"
      :loading="connections.isFetching.value"
      @refresh="connections.refetch()"
    />
    <UiCard>
      <div v-if="connections.isPending.value" role="status" aria-label="Загрузка подключений">
        <UiSkeleton class="h-24 w-full" />
      </div>
      <UiErrorState
        v-else-if="connections.isError.value"
        :error="connections.error.value"
        title="Не удалось загрузить подключения"
        @retry="connections.refetch()"
      />
      <UiEmptyState v-else-if="connections.data.value?.length === 0" title="Подключений пока нет" />
      <div
        v-else-if="connections.data.value"
        class="relative overflow-x-auto"
        tabindex="0"
        role="region"
        aria-label="Таблица подключений"
      >
        <table class="w-full min-w-[960px] text-left text-sm">
          <caption class="sr-only">
            Подключения
          </caption>
          <thead>
            <tr class="text-xs font-semibold tracking-wide text-muted">
              <th scope="col" class="pb-2">Подключение</th>
              <th scope="col" class="pb-2">Организация</th>
              <th scope="col" class="pb-2">Провайдер</th>
              <th scope="col" class="pb-2">Статус</th>
              <th scope="col" class="pb-2">Последнее событие</th>
              <th scope="col" class="pb-2">Последняя ошибка</th>
              <th scope="col" class="pb-2 text-right">Сырых в очереди</th>
              <th scope="col" class="pb-2 text-right">Сырых с ошибкой</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="item in connections.data.value" :key="item.id">
              <td class="py-2 pr-4">
                <span class="block font-semibold text-ink">{{ item.name }}</span
                ><IdCell :value="item.id" />
              </td>
              <td class="py-2 pr-4">
                <span class="block text-ink">{{ item.tenantName }}</span
                ><IdCell :value="item.tenantId" />
              </td>
              <td class="py-2 pr-4 text-muted">{{ item.provider }}</td>
              <td class="py-2 pr-4">
                <UiBadge :tone="adminStatusTone(item.status)">{{
                  adminStatusLabel(item.status)
                }}</UiBadge>
              </td>
              <td class="py-2 pr-4 text-muted">
                {{ item.lastEventAt ? formatDateTime(item.lastEventAt, 'UTC') : '—' }}
              </td>
              <td class="py-2 pr-4 text-muted">
                <template v-if="item.lastErrorAt"
                  >{{ formatDateTime(item.lastErrorAt, 'UTC') }} ·
                  <code class="text-xs">{{ item.lastErrorCode ?? '—' }}</code></template
                >
                <template v-else>—</template>
              </td>
              <td class="py-2 pr-4 text-right tabular-nums">{{ item.rawEventsPending }}</td>
              <td
                class="py-2 text-right tabular-nums"
                :class="item.rawEventsFailed > 0 ? 'font-semibold text-danger' : ''"
              >
                {{ item.rawEventsFailed }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>
  </div>
</template>
