<script setup lang="ts">
/**
 * Настройки уведомлений: личная привязка Telegram и строки
 * настроек — по одной на тип риска. Раздел доступен владельцу и менеджеру:
 * настройки принадлежат текущему пользователю, а не организации.
 */
import { computed } from 'vue'
import { UiCard, UiErrorState, UiPageHeader, UiSkeleton } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import { RISK_TYPES, riskTypeLabel } from '@/entities/risk'
import {
  deliveryModeLabel,
  severityThresholdLabel,
  usePreferencesQuery,
  useTelegramLinkQuery,
} from '@/entities/notification'
import { TelegramLinkCard } from '@/features/link-telegram'
import { PreferenceEditor } from '@/features/edit-notification-preference'
import SettingsTabs from './SettingsTabs.vue'

const session = useSessionStore()
const tenantId = computed(() => session.tenantId ?? '')
const organization = useOrganizationQuery(() => session.tenantId)
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')
const link = useTelegramLinkQuery(() => session.tenantId)
const preferences = usePreferencesQuery(() => session.tenantId)

/** Строки в порядке типов риска; отсутствующая строка — сбой контракта, показываем что есть. */
const rows = computed(() =>
  RISK_TYPES.map((riskType) =>
    preferences.data.value?.find((item) => item.riskType === riskType),
  ).filter((item): item is NonNullable<typeof item> => item !== undefined),
)

function summary(row: (typeof rows.value)[number]): string {
  const channels = [row.inAppEnabled ? 'LidRadar' : null, row.telegramEnabled ? 'Telegram' : null]
    .filter(Boolean)
    .join(' и ')
  if (row.deliveryMode === 'DISABLED') return 'Не уведомлять'
  return `${deliveryModeLabel(row.deliveryMode)} · ${severityThresholdLabel(row.minimumSeverity).toLowerCase()} · ${channels || 'каналы выключены'}`
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiPageHeader
      title="Уведомления без лишнего шума"
      subtitle="Выберите, какие риски заслуживают вашего внимания"
    />
    <SettingsTabs />

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <UiCard>
        <TelegramLinkCard :tenant-id="tenantId" :time-zone="timeZone" />
      </UiCard>
      <UiCard as="section" aria-labelledby="unchanged-title" class="bg-canvas">
        <h2 id="unchanged-title" class="text-lg font-bold text-ink">Что не меняется</h2>
        <p class="mt-2 text-sm text-ink">
          Отключение уведомлений не останавливает поиск рисков и не удаляет их из Radar.
        </p>
        <p class="mt-2 text-sm text-muted">
          Сбой доставки в Telegram также не меняет состояние риска.
        </p>
      </UiCard>
    </div>

    <UiCard as="section" aria-labelledby="preferences-title">
      <h2 id="preferences-title" class="text-lg font-bold text-ink">По типам рисков</h2>
      <p class="mt-1 text-sm text-muted">
        Настройки личные и действуют в этой организации. Каждый тип сохраняется отдельно.
      </p>
      <div
        v-if="preferences.isPending.value"
        class="mt-4"
        role="status"
        aria-label="Загрузка настроек"
      >
        <UiSkeleton class="h-12 w-full" />
        <UiSkeleton class="mt-2 h-12 w-full" />
      </div>
      <UiErrorState
        v-else-if="preferences.isError.value"
        class="mt-4"
        :error="preferences.error.value"
        title="Не удалось загрузить настройки"
        @retry="preferences.refetch()"
      />
      <ul v-else class="mt-4 divide-y divide-line" aria-label="Настройки по типам рисков">
        <li v-for="row in rows" :key="row.riskType">
          <details class="group py-3">
            <summary
              class="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-field text-left"
            >
              <span class="flex flex-col gap-0.5">
                <span class="text-sm font-semibold text-ink">{{
                  riskTypeLabel(row.riskType)
                }}</span>
                <span class="text-xs text-muted">{{ summary(row) }}</span>
              </span>
              <span class="text-xs font-semibold text-brand-dark group-open:hidden">Изменить</span>
              <span class="hidden text-xs font-semibold text-muted group-open:inline"
                >Свернуть</span
              >
            </summary>
            <div class="mt-4">
              <PreferenceEditor
                :tenant-id="tenantId"
                :preference="row"
                :telegram-linked="link.data.value?.linked ?? false"
                :time-zone="timeZone"
              />
            </div>
          </details>
        </li>
      </ul>
    </UiCard>
  </div>
</template>
