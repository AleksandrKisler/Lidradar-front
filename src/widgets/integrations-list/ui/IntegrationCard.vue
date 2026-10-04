<script setup lang="ts">
/**
 * Карточка подключения: провайдер, название, точка, статус, последние
 * события с безопасным кодом ошибки и возможности. Здоровье читается
 * отдельным запросом и подписывается временем чтения снимка.
 */
import { computed, toRef } from 'vue'
import { formatDateTime, formatRelative } from '@/shared/lib'
import { UiBadge, UiCard } from '@/shared/ui'
import {
  capabilityLabel,
  connectionErrorLabel,
  connectionStatusView,
  WebhookInstructions,
  providerLabel,
  useConnectionHealthQuery,
  type ChannelConnection,
} from '@/entities/integration'
import { CheckHealthButton } from '@/features/check-channel-health'
import { DisconnectChannelButton } from '@/features/disconnect-channel'

const props = defineProps<{
  tenantId: string
  connection: ChannelConnection
  locationName: string | null
  timeZone: string
  now: Date
}>()

const health = useConnectionHealthQuery(toRef(props, 'tenantId'), () => props.connection.id)

/** Снимок здоровья: свежий из отдельного запроса либо из строки списка. */
const snapshot = computed(() => health.data.value ?? props.connection)
const statusView = computed(() => connectionStatusView(props.connection.provider, snapshot.value))
const readAt = computed(() =>
  health.data.value ? formatDateTime(health.data.value.checkedAt, props.timeZone) : null,
)

function when(value: string | null): string {
  return value
    ? `${formatRelative(value, props.now)} · ${formatDateTime(value, props.timeZone)}`
    : 'ещё не было'
}
</script>

<template>
  <UiCard as="li" class="flex min-w-0 flex-col gap-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-lg font-bold break-words text-ink">{{ connection.name }}</h3>
        <p class="text-sm text-muted">
          {{ providerLabel(connection.provider) }} · {{ locationName ?? 'вся организация' }}
        </p>
      </div>
      <UiBadge :tone="statusView.tone">
        {{ statusView.label }}
      </UiBadge>
    </div>

    <dl class="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
      <div class="flex flex-col">
        <dt class="text-xs font-semibold tracking-wide text-muted uppercase">Последнее событие</dt>
        <dd class="text-ink">{{ when(snapshot.lastEventAt) }}</dd>
      </div>
      <div class="flex flex-col">
        <dt class="text-xs font-semibold tracking-wide text-muted uppercase">Последний успех</dt>
        <dd class="text-ink">{{ when(snapshot.lastSuccessAt) }}</dd>
      </div>
      <div class="flex flex-col">
        <dt class="text-xs font-semibold tracking-wide text-muted uppercase">Последняя ошибка</dt>
        <dd class="text-ink">
          {{ when(snapshot.lastErrorAt) }}
          <span v-if="snapshot.lastErrorCode" class="block text-xs text-danger">
            {{ connectionErrorLabel(snapshot.lastErrorCode) }}
          </span>
        </dd>
      </div>
    </dl>

    <ul
      v-if="connection.capabilities.length"
      class="flex flex-wrap gap-1.5"
      aria-label="Возможности"
    >
      <li
        v-for="capability in connection.capabilities"
        :key="capability"
        class="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted"
      >
        {{ capabilityLabel(capability) }}
      </li>
    </ul>

    <details
      v-if="connection.provider === 'GENERIC_WEBHOOK'"
      class="min-w-0 rounded-control border border-line p-4"
    >
      <summary class="cursor-pointer font-semibold text-brand-dark">Инструкция webhook</summary>
      <WebhookInstructions
        class="mt-4"
        :tenant-id="tenantId"
        :connection-id="connection.id"
        :disconnected="snapshot.status === 'DISCONNECTED'"
      />
    </details>

    <div class="flex flex-wrap items-start justify-between gap-3 border-t border-line pt-4">
      <p class="text-xs text-muted">
        <template v-if="readAt">Состояние прочитано {{ readAt }}.</template>
        <template v-else>Состояние из списка подключений.</template>
        Новые сообщения сохраняются до начала анализа.
      </p>
      <div v-if="connection.status !== 'DISCONNECTED'" class="flex flex-wrap items-start gap-3">
        <CheckHealthButton
          :tenant-id="tenantId"
          :connection-id="connection.id"
          :provider="connection.provider"
          :time-zone="timeZone"
        />
        <DisconnectChannelButton :tenant-id="tenantId" :connection="connection" />
      </div>
    </div>
  </UiCard>
</template>
