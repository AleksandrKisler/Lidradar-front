<script setup lang="ts">
/**
 * Список подключений организации с кнопкой подключения нового источника.
 * Пустой список — предметное состояние: без источника Radar не получит
 * переписку и не покажет рисков.
 */
import { computed, onScopeDispose, ref, toRef } from 'vue'
import { UiButton, UiCard, UiEmptyState, UiErrorState, UiSkeleton } from '@/shared/ui'
import { useLocationsQuery } from '@/entities/location'
import { useConnectionsQuery } from '@/entities/integration'
import { ConnectChannelDialog } from '@/features/connect-channel'
import IntegrationCard from './IntegrationCard.vue'

const props = defineProps<{ tenantId: string; timeZone: string }>()

const connections = useConnectionsQuery(toRef(props, 'tenantId'))
const locations = useLocationsQuery(toRef(props, 'tenantId'))
const dialogOpen = ref(false)

const items = computed(() =>
  (connections.data.value ?? []).slice().sort((left, right) => {
    const rank = (status: string) => (status === 'DISCONNECTED' ? 1 : 0)
    return rank(left.status) - rank(right.status) || right.updatedAt.localeCompare(left.updatedAt)
  }),
)
const locationName = (id: string | null) =>
  id ? (locations.data.value?.find((location) => location.id === id)?.name ?? 'Точка') : null

const now = ref(new Date())
const timer = setInterval(() => {
  now.value = new Date()
}, 60_000)
onScopeDispose(() => clearInterval(timer))
</script>

<template>
  <section aria-labelledby="integrations-title" class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 id="integrations-title" class="text-lg font-bold text-ink">Источники сообщений</h2>
      <UiButton @click="dialogOpen = true">Подключить источник</UiButton>
    </div>

    <div v-if="connections.isPending.value" role="status" aria-label="Загрузка подключений">
      <UiCard><UiSkeleton class="h-24 w-full" /></UiCard>
    </div>
    <UiErrorState
      v-else-if="connections.isError.value"
      :error="connections.error.value"
      title="Не удалось загрузить подключения"
      @retry="connections.refetch()"
    />
    <UiCard v-else-if="!items.length" :padded="false">
      <UiEmptyState
        title="Источников пока нет"
        description="Подключите Telegram или webhook: переписка начнёт поступать, и Radar сможет замечать риски."
      >
        <template #actions>
          <UiButton @click="dialogOpen = true">Подключить источник</UiButton>
        </template>
      </UiEmptyState>
    </UiCard>
    <ul v-else class="flex flex-col gap-4" aria-label="Подключения">
      <IntegrationCard
        v-for="connection in items"
        :key="connection.id"
        :tenant-id="tenantId"
        :connection="connection"
        :location-name="locationName(connection.locationId)"
        :time-zone="timeZone"
        :now="now"
      />
    </ul>

    <ConnectChannelDialog
      v-model:open="dialogOpen"
      :tenant-id="tenantId"
      :locations="locations.data.value ?? []"
    />
  </section>
</template>
