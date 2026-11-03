<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { UiButton, UiSkeleton, UiSpinner } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useLocationsQuery } from '@/entities/location'
import { integrationKeys, useConnectionsQuery } from '@/entities/integration'
import { ConnectChannelDialog } from '@/features/connect-channel'
import IntegrationCard from './IntegrationCard.vue'
import IntegrationNotifications from './IntegrationNotifications.vue'
import maxDisabled from './assets/max-disabled.svg?no-inline'
import telegramConnect from './assets/telegram-connect.svg?no-inline'
import refreshIcon from './assets/refresh.svg?no-inline'
import errorIcon from './assets/error.svg?no-inline'
import manualIcon from './assets/refresh-manual.svg?no-inline'

const props = defineProps<{ tenantId: string; timeZone: string | null }>()
const session = useSessionStore()
const permitted = computed(
  () => session.tenantId === props.tenantId && session.can('integration.manage'),
)
const tenant = () => (permitted.value ? props.tenantId : null)
const connections = useConnectionsQuery(tenant)
const locations = useLocationsQuery(tenant)
const queryClient = useQueryClient()
const dialogOpen = ref(false)
const refreshing = ref(false)
const hasData = computed(() => connections.data.value !== undefined)
const items = computed(() =>
  (connections.data.value ?? []).slice().sort((left, right) => {
    const rank = (status: string) => (status === 'DISCONNECTED' ? 1 : 0)
    return rank(left.status) - rank(right.status) || right.updatedAt.localeCompare(left.updatedAt)
  }),
)
const locationName = (id: string | null) =>
  id ? (locations.data.value?.find((location) => location.id === id)?.name ?? 'Точка') : null
async function refresh() {
  if (!permitted.value || refreshing.value || connections.isFetching.value) return
  refreshing.value = true
  const scope = props.tenantId
  try {
    await Promise.allSettled([
      connections.refetch(),
      queryClient.invalidateQueries({
        queryKey: integrationKeys.list(scope),
        predicate: (query) => query.queryKey.at(-1) === 'health',
      }),
    ])
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <div class="integrations-page">
    <header class="integrations-heading">
      <div>
        <h1>Интеграции</h1>
        <p>Переписка клиентов и личные уведомления — два независимых подключения.</p>
      </div>
      <button
        type="button"
        class="integration-refresh"
        aria-label="Обновить источники"
        title="Обновить источники. Проверка связи запускается вручную"
        :aria-busy="refreshing || connections.isFetching.value || undefined"
        :disabled="!permitted || refreshing || connections.isFetching.value"
        @click="refresh"
      >
        <UiSpinner
          v-if="permitted && (refreshing || connections.isFetching.value)"
          class="size-5"
        /><img v-else :src="refreshIcon" width="20" height="20" alt="" />
        <img :src="manualIcon" width="12" height="12" alt="" class="refresh-manual" />
      </button>
    </header>
    <div
      v-if="permitted && connections.isError.value && hasData"
      class="integration-refresh-error"
      role="alert"
    >
      <div class="refresh-error-row">
        <UiButton variant="secondary" :loading="connections.isFetching.value" @click="refresh"
          >Повторить</UiButton
        >
        <p><img :src="errorIcon" width="20" height="20" alt="" />Не удалось обновить источники</p>
      </div>
      <p class="refresh-error-hint">
        Показаны ранее загруженные данные. Время снимка не изменилось.
      </p>
    </div>
    <div
      v-else-if="permitted && hasData && (refreshing || connections.isFetching.value)"
      class="integration-refreshing"
      role="status"
    >
      <UiSpinner class="size-4 shrink-0 text-brand" />
      <p>Обновляем состояние. Показаны прежние данные.</p>
    </div>
    <section aria-labelledby="integrations-title" class="integrations-section">
      <div class="integrations-toolbar">
        <h2 id="integrations-title">Источники сообщений</h2>
        <UiButton v-if="permitted && (items.length > 0 || !hasData)" @click="dialogOpen = true"
          >Подключить Telegram</UiButton
        >
      </div>
      <div class="integrations-layout">
        <div class="integrations-primary">
          <div v-if="!permitted" class="integration-empty integration-denied">
            <h3>Раздел недоступен</h3>
            <p>Источники сообщений подключает владелец организации.</p>
            <RouterLink :to="{ name: 'radar' }" class="integration-denied-back"
              >Вернуться в Radar</RouterLink
            >
          </div>
          <div
            v-else-if="connections.isPending.value"
            class="integration-skeleton"
            role="status"
            aria-label="Загрузка источников"
          >
            <div class="skeleton-header">
              <UiSkeleton class="sk skeleton-mark" />
              <div class="skeleton-name">
                <UiSkeleton class="sk skeleton-title" /><UiSkeleton class="sk skeleton-type" />
              </div>
              <UiSkeleton class="sk skeleton-badge skeleton-badge--desktop" />
            </div>
            <UiSkeleton class="sk skeleton-badge skeleton-badge--mobile" />
            <div class="skeleton-metadata">
              <div
                v-for="label in ['Последнее событие', 'Успешная операция', 'Последняя ошибка']"
                :key="label"
              >
                <p>{{ label }}</p>
                <UiSkeleton class="sk skeleton-value" />
              </div>
            </div>
            <hr />
            <div class="skeleton-actions">
              <UiSkeleton class="sk skeleton-action-main" /><UiSkeleton
                class="sk skeleton-action-secondary"
              /><UiSkeleton class="sk skeleton-action-tertiary" />
            </div>
            <UiSkeleton class="sk skeleton-read" />
          </div>
          <div
            v-else-if="connections.isError.value && !hasData"
            class="integration-first-error"
            role="alert"
          >
            <div class="flex items-start gap-3">
              <img :src="errorIcon" width="20" height="20" alt="" class="mt-0.5 shrink-0" />
              <div>
                <h3>Не удалось загрузить источники</h3>
                <p>Повторите попытку. Состояние подключений пока неизвестно.</p>
              </div>
            </div>
            <UiButton
              variant="secondary"
              :loading="connections.isFetching.value"
              @click="connections.refetch()"
              >Повторить</UiButton
            >
          </div>
          <template v-else>
            <div v-if="!items.length" class="integration-empty">
              <h3>Подключите первый источник</h3>
              <p>LidRadar будет получать новые сообщения клиентов из Telegram.</p>
              <UiButton @click="dialogOpen = true"
                ><img :src="telegramConnect" width="20" height="20" alt="" />Подключить
                Telegram</UiButton
              >
            </div>
            <ul v-else class="integrations-cards" aria-label="Подключения">
              <IntegrationCard
                v-for="connection in items"
                :key="connection.id"
                :tenant-id="tenantId"
                :connection="connection"
                :location-name="locationName(connection.locationId)"
                :time-zone="timeZone"
              />
            </ul>
          </template>
          <section v-if="permitted" class="integration-max" aria-label="MAX — интеграция в работе">
            <div class="flex items-center gap-3">
              <span class="max-mark"><img :src="maxDisabled" width="22" height="22" alt="" /></span>
              <div class="min-w-0 flex-1">
                <h3>MAX</h3>
                <p class="max-type">Источник переписки</p>
              </div>
              <span class="max-status">В работе</span>
            </div>
            <p>Интеграция с MAX в работе. Подключение переписки станет доступно позже.</p>
          </section>
          <IntegrationNotifications :tenant-id="tenantId" :time-zone="timeZone" />
        </div>
        <aside class="integration-help" aria-label="Справка об источниках">
          <h3>Как поступают сообщения</h3>
          <p>
            Lidradar получает новые сообщения из телеграм-чатов, подчиняясь правилам автоматизации.
          </p>
          <hr />
          <h3>Проверьте на новом сообщении</h3>
          <p>
            Отправьте сообщение в доступный боту чат и обновите экран. В карточке появится время
            последнего события.
          </p>
          <hr />
          <h3>История остаётся</h3>
          <p>Отключение источника не удаляет сохранённые диалоги и риски.</p>
        </aside>
      </div>
    </section>
    <ConnectChannelDialog
      v-if="permitted"
      v-model:open="dialogOpen"
      adaptive-instruction
      :tenant-id="tenantId"
      :locations="locations.data.value ?? []"
      :loading="locations.isPending.value"
    />
  </div>
</template>

<style scoped>
.integrations-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}
.integrations-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.integrations-heading > div {
  flex: 1;
  min-width: 0;
}
.integrations-heading h1 {
  font-size: 38px;
  line-height: 46px;
  font-weight: 600;
}
.integrations-heading p {
  margin-top: 4px;
  font-size: 15px;
  line-height: 22px;
  color: var(--color-secondary);
}
.integration-refresh {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  border: 1px solid var(--color-line);
  border-radius: 50%;
  background: var(--color-paper);
}
.integration-refresh:disabled {
  opacity: 0.55;
}
.integration-refresh:hover:enabled {
  background: var(--color-action-pale);
}
.integrations-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.integrations-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
}
.integrations-toolbar h2 {
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
}
.integrations-toolbar button {
  width: 228px;
  flex-shrink: 0;
}
.integrations-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.integrations-primary,
.integrations-cards {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}
.integration-max,
.integration-help,
.integration-empty,
.integration-first-error,
.integration-skeleton {
  padding: 24px;
  border: 1px solid var(--color-analytics-line);
  border-radius: var(--radius-card);
  min-width: 0;
}
.integration-max {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--color-muted);
}
.integration-max h3 {
  font-size: 17px;
  line-height: 24px;
  font-weight: 600;
}
.integration-max p {
  font-size: 14px;
  line-height: 20px;
}
.integration-max .max-type {
  margin-top: 2px;
  font-size: 13px;
  line-height: 18px;
  font-weight: 500;
}
.max-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-line);
}
.max-status {
  padding: 6px 12px;
  border-radius: 9999px;
  background: var(--color-line);
  font-size: 12px;
  line-height: 16px;
}
.integration-help {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--color-paper);
}
.integration-help h3,
.integration-empty h3,
.integration-first-error h3 {
  font-size: 16px;
  line-height: 22px;
  font-weight: 600;
}
.integration-help p,
.integration-empty p,
.integration-first-error p {
  font-size: 14px;
  line-height: 20px;
  color: var(--color-secondary);
}
.integration-help hr,
.integration-skeleton hr {
  border: 0;
  height: 1px;
  background: var(--color-analytics-line);
}
.integration-empty,
.integration-first-error {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--color-paper);
}
.integration-first-error h3 {
  color: var(--color-danger);
}
.integration-first-error p {
  margin-top: 4px;
}
.integration-empty button {
  width: 268px;
  max-width: 100%;
}
.integration-first-error > button {
  width: 228px;
  max-width: 100%;
}
.integration-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--color-paper);
}
.skeleton-metadata,
.skeleton-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.skeleton-metadata p {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-secondary);
}
:global(body:has(.integrations-page)) {
  background: #eff1f5;
  --color-muted: var(--color-secondary);
}
.refresh-manual {
  position: absolute;
  left: 30px;
  top: 0;
}
:global(#main:has(> .integrations-page)) {
  gap: 24px;
}
@media (min-width: 1280px) {
  .integrations-layout {
    grid-template-columns: minmax(0, 760fr) minmax(0, 336fr);
  }
}
@media (min-width: 768px) and (max-width: 1023px) {
  :global(#main:has(> .integrations-page)) {
    padding-top: 32px;
  }
  .integrations-heading h1 {
    font-size: 32px;
    line-height: 40px;
  }
}
@media (max-width: 767px) {
  .integrations-heading {
    position: relative;
    align-items: flex-start;
  }
  .integrations-heading h1 {
    font-size: 28px;
    line-height: 34px;
    padding-right: 58px;
  }
  .integrations-heading p {
    margin-top: 12px;
  }
  .integration-refresh {
    position: absolute;
    top: 0;
    right: 0;
  }
  .integrations-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .integrations-toolbar button {
    width: 100%;
  }
  .integration-max,
  .integration-empty,
  .integration-first-error,
  .integration-skeleton {
    padding: 16px;
  }
  .integration-help {
    padding: 20px;
  }
  .integration-empty button {
    width: 100%;
    padding-inline: 8px;
  }
  .skeleton-metadata {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
  }
  .skeleton-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .skeleton-actions > :first-child {
    grid-column: 1/-1;
  }
}

.integration-refresh-error {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.refresh-error-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.refresh-error-row > button {
  width: 228px;
  flex-shrink: 0;
}
.refresh-error-row > p {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-danger);
  font-size: 14px;
  line-height: 20px;
}
.refresh-error-row img {
  flex-shrink: 0;
}
.refresh-error-hint {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-secondary);
}
.integration-refreshing {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 18px;
  color: var(--color-secondary);
}
.integration-denied-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  max-width: 228px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-button);
  font-size: 17px;
  line-height: 20px;
  padding: 0 12px;
}
.skeleton-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.sk {
  background: var(--color-analytics-line);
  border-radius: 6px;
  flex-shrink: 0;
}
.skeleton-mark {
  width: 40px;
  height: 40px;
}
.skeleton-name {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.skeleton-title {
  width: 100%;
  height: 24px;
}
.skeleton-type {
  width: 220px;
  max-width: 100%;
  height: 18px;
}
.skeleton-badge {
  width: 88px;
  height: 20px;
}
.skeleton-value {
  margin-top: 4px;
  width: 100%;
  height: 22px;
}
.skeleton-actions {
  display: flex;
  gap: 8px;
}
.skeleton-action-main {
  width: 228px;
  height: 46px;
  max-width: 100%;
}
.skeleton-action-secondary {
  width: 148px;
  height: 46px;
  max-width: 100%;
}
.skeleton-read {
  width: 340px;
  max-width: 100%;
  height: 18px;
}
@media (max-width: 1023px) {
  .integrations-heading {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 46px;
    gap: 24px 12px;
    align-items: center;
  }
  .integrations-heading > div {
    display: contents;
  }
  .integrations-heading h1 {
    grid-column: 1;
    grid-row: 1;
    padding: 0;
  }
  .integrations-heading p {
    grid-column: 1/-1;
    grid-row: 2;
    margin: 0;
  }
  .integration-refresh {
    grid-column: 2;
    grid-row: 1;
    position: relative;
    top: auto;
    right: auto;
  }
}
@media (max-width: 767px) {
  .integration-first-error > button {
    width: 100%;
  }
  .integration-help {
    padding: 16px;
  }
  .refresh-error-row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .refresh-error-row > button {
    width: 100%;
  }
  .skeleton-header {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr);
    gap: 8px 12px;
  }
  .skeleton-badge {
    grid-column: 2;
  }
  .skeleton-metadata {
    gap: 12px;
  }
  .skeleton-value {
    margin-top: 12px;
  }
  .skeleton-actions {
    flex-wrap: wrap;
  }
  .skeleton-action-main {
    width: 100%;
  }
  .skeleton-action-secondary {
    width: 158px;
  }
}

.skeleton-badge--mobile,
.skeleton-action-tertiary {
  display: none;
}
@media (max-width: 767px) {
  .skeleton-header {
    display: flex;
    gap: 12px;
  }
  .skeleton-name {
    gap: 8px;
  }
  .skeleton-type {
    width: 180px;
  }
  .skeleton-badge--desktop {
    display: none;
  }
  .skeleton-badge--mobile {
    display: block;
  }
  .skeleton-value {
    margin-top: 4px;
  }
  .skeleton-action-secondary,
  .skeleton-action-tertiary {
    display: block;
    width: calc((100% - 8px) / 2);
    height: 46px;
  }
  .skeleton-read {
    width: 100%;
    height: 36px;
  }
}
</style>
