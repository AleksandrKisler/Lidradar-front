<script setup lang="ts">
/** Организации платформы: счётчики без содержимого переписок. */
import { formatDateTime } from '@/shared/lib'
import { UiBadge, UiCard, UiEmptyState, UiErrorState, UiSkeleton } from '@/shared/ui'
import { adminStatusLabel, adminStatusTone, useAdminOrganizationsQuery } from '@/entities/admin'
import { IdCell, SnapshotBar } from '@/widgets/admin-shell'

const organizations = useAdminOrganizationsQuery()
</script>

<template>
  <div class="flex flex-col gap-6">
    <SnapshotBar
      :updated-at="organizations.dataUpdatedAt.value"
      :loading="organizations.isFetching.value"
      @refresh="organizations.refetch()"
    />
    <UiCard>
      <div v-if="organizations.isPending.value" role="status" aria-label="Загрузка организаций">
        <UiSkeleton class="h-24 w-full" />
      </div>
      <UiErrorState
        v-else-if="organizations.isError.value"
        :error="organizations.error.value"
        title="Не удалось загрузить организации"
        @retry="organizations.refetch()"
      />
      <UiEmptyState
        v-else-if="organizations.data.value?.length === 0"
        title="Организаций пока нет"
      />
      <div
        v-else-if="organizations.data.value"
        class="relative overflow-x-auto"
        tabindex="0"
        role="region"
        aria-label="Таблица организаций"
      >
        <table class="w-full min-w-[880px] text-left text-sm">
          <caption class="sr-only">
            Организации
          </caption>
          <thead>
            <tr class="text-xs font-semibold tracking-wide text-muted uppercase">
              <th scope="col" class="pb-2">Организация</th>
              <th scope="col" class="pb-2">Статус</th>
              <th scope="col" class="pb-2">Пояс · валюта</th>
              <th scope="col" class="pb-2 text-right">Участники</th>
              <th scope="col" class="pb-2 text-right">Точки</th>
              <th scope="col" class="pb-2 text-right">Подключения</th>
              <th scope="col" class="pb-2 text-right">Открытых рисков</th>
              <th scope="col" class="pb-2 text-right">Сообщений за 24 ч</th>
              <th scope="col" class="pb-2">Создана</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="item in organizations.data.value" :key="item.id">
              <td class="py-2 pr-4">
                <span class="block font-semibold break-words text-ink">{{ item.name }}</span>
                <IdCell :value="item.id" />
              </td>
              <td class="py-2 pr-4">
                <UiBadge :tone="adminStatusTone(item.status)">{{
                  adminStatusLabel(item.status)
                }}</UiBadge>
              </td>
              <td class="py-2 pr-4 text-muted">{{ item.timezone }} · {{ item.currency }}</td>
              <td class="py-2 pr-4 text-right tabular-nums">{{ item.members }}</td>
              <td class="py-2 pr-4 text-right tabular-nums">{{ item.locations }}</td>
              <td class="py-2 pr-4 text-right tabular-nums">{{ item.connections }}</td>
              <td class="py-2 pr-4 text-right tabular-nums">{{ item.openRisks }}</td>
              <td class="py-2 pr-4 text-right tabular-nums">{{ item.messagesLast24h }}</td>
              <td class="py-2 text-muted">{{ formatDateTime(item.createdAt, 'UTC') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>
  </div>
</template>
