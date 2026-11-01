<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { UiAlert, UiButton, UiSkeleton } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import { RISK_TYPES, riskTypeLabel } from '@/entities/risk'
import {
  severityThresholdLabel,
  notificationTimeZoneLabel,
  usePreferencesQuery,
  useTelegramLinkQuery,
  type NotificationPreference,
} from '@/entities/notification'
import { TelegramSettingsCard } from '@/features/link-telegram'
import { PreferenceDialog } from '@/features/edit-notification-preference'
import SettingsPageHead from './SettingsPageHead.vue'
const session = useSessionStore()
const tenantId = computed(() => session.tenantId ?? '')
const scope = computed(() => `${tenantId.value}/${session.user?.id ?? ''}`)
const organization = useOrganizationQuery(() => session.tenantId)
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? '')
const zoneLabel = computed(() => notificationTimeZoneLabel(timeZone.value))
const link = useTelegramLinkQuery(() => session.tenantId)
const preferences = usePreferencesQuery(() => session.tenantId)
const rows = computed(() =>
  RISK_TYPES.flatMap(
    (riskType) => preferences.data.value?.find((row) => row.riskType === riskType) ?? [],
  ),
)
const telegramSelected = computed(() =>
  rows.value.some((row) => row.telegramEnabled && row.deliveryMode !== 'DISABLED'),
)
const selected = ref<NotificationPreference | null>(null),
  open = ref(false)
const origin = (row: NotificationPreference) => (row.isDefault ? 'По умолчанию' : 'Настроено вами')
function lines(row: NotificationPreference) {
  if (row.deliveryMode === 'DISABLED') return ['Не уведомлять', 'Риски остаются в Radar']
  const mode = row.deliveryMode === 'DIGEST' ? `Сводка в ${row.digestTime}` : 'Сразу'
  const channels =
    row.inAppEnabled && row.telegramEnabled
      ? 'LidRadar и Telegram'
      : row.inAppEnabled
        ? 'Внутри LidRadar'
        : row.telegramEnabled
          ? 'Личный Telegram'
          : 'Каналы выключены'
  return [
    `${mode} · ${severityThresholdLabel(row.minimumSeverity)}`,
    channels +
      (row.quietHoursEnabled ? ` · Тихие часы ${row.quietHoursStart}–${row.quietHoursEnd}` : ''),
  ]
}
function edit(row: NotificationPreference, event: MouseEvent) {
  ;(event.currentTarget as HTMLElement).focus()
  selected.value = row
  open.value = true
}
watch(
  scope,
  () => {
    open.value = false
    selected.value = null
  },
  { flush: 'sync' },
)
</script>
<template>
  <div class="flex min-w-0 flex-col gap-6 pb-7 md:max-lg:-mx-2 lg:pb-5">
    <SettingsPageHead
      title="Уведомления"
      compact-mobile-title
      :mobile-tab-offset="350"
      :subtitle="`Личные настройки · ${organization.data.value?.name ?? 'Рабочее пространство'}`"
      scrolling-tabs
    />
    <TelegramSettingsCard
      v-if="tenantId"
      :key="scope"
      :tenant-id="tenantId"
      :time-zone="timeZone || 'UTC'"
      :telegram-selected="telegramSelected"
    />
    <section
      class="flex min-w-0 flex-col gap-4 rounded-[18px] border border-line bg-paper p-4 md:p-6"
      aria-labelledby="preferences-title"
    >
      <h2 id="preferences-title" class="text-xl leading-7 font-semibold text-ink">
        {{
          preferences.isPending.value
            ? 'Загружаем правила...'
            : !preferences.data.value
              ? 'Не удалось загрузить правила'
              : 'О каких рисках уведомлять'
        }}
      </h2>
      <p class="text-sm leading-5 text-muted">
        <template v-if="preferences.isPending.value">Подождите, получаем ваши настройки.</template>
        <template v-else-if="!preferences.data.value"
          >Проверьте соединение и повторите попытку.</template
        >
        <template v-else>Каждый тип сохраняется отдельно. Время — {{ zoneLabel }}.</template>
      </p>
      <div v-if="preferences.isPending.value" role="status" aria-label="Загрузка настроек">
        <div
          v-for="n in 6"
          :key="n"
          class="flex flex-col gap-2 px-4 py-4"
          :style="{ height: n === 6 ? '70px' : '86px' }"
        >
          <UiSkeleton
            class="rounded-md bg-line"
            style="height: 18px; width: 56.6%; background-color: var(--color-line)"
          />
          <UiSkeleton
            class="h-3 rounded-md bg-line"
            style="width: 77.2%; background-color: var(--color-line)"
          />
        </div>
      </div>
      <UiButton
        v-else-if="!preferences.data.value"
        variant="secondary"
        class="w-full"
        @click="preferences.refetch()"
        >Повторить загрузку</UiButton
      >
      <template v-else>
        <template v-if="preferences.isError.value">
          <UiAlert compact tone="danger" title="Правила не обновлены"
            >Показаны последние загруженные настройки. Повторите обновление.</UiAlert
          >
          <UiButton
            variant="secondary"
            class="w-full md:w-auto md:self-start"
            @click="preferences.refetch()"
            >Повторить обновление</UiButton
          >
        </template>
        <UiAlert
          v-if="rows.length !== RISK_TYPES.length"
          tone="warning"
          title="Получены не все правила"
          >Обновите список, чтобы прочитать недостающие настройки.<UiButton
            variant="ghost"
            @click="preferences.refetch()"
            >Обновить список</UiButton
          ></UiAlert
        >
        <ul class="divide-y divide-line" aria-label="Настройки по типам рисков">
          <li
            v-for="row in rows"
            :key="row.riskType"
            style="grid-template-columns: minmax(0, 1fr) 96px"
            class="grid items-center gap-x-3 gap-y-2 py-4 md:flex md:gap-6"
          >
            <div class="min-w-0 md:flex-1">
              <h3 class="text-base leading-[22px] font-semibold break-words text-ink">
                {{ riskTypeLabel(row.riskType) }}
              </h3>
              <p class="mt-1 hidden text-xs leading-[18px] text-muted md:block">
                {{ origin(row) }}
              </p>
            </div>
            <button
              type="button"
              class="h-[46px] px-3 text-field leading-5 font-medium text-muted md:order-3 md:w-[110px] md:shrink-0"
              :aria-label="`Изменить: ${riskTypeLabel(row.riskType)}`"
              @click="edit(row, $event)"
            >
              Изменить
            </button>
            <p class="col-span-2 text-sm leading-5 text-ink md:order-2 md:w-[300px] md:shrink-0">
              <span v-for="(line, i) in lines(row)" :key="i" class="block">{{ line }}</span>
            </p>
            <p class="col-span-2 text-xs leading-[18px] text-muted md:hidden">{{ origin(row) }}</p>
          </li>
        </ul>
      </template>
    </section>
    <p class="text-sm leading-5 text-muted">
      Отключение уведомлений не останавливает поиск рисков. Личный бот не меняет источник переписки
      компании.
    </p>
    <PreferenceDialog
      v-if="selected"
      :key="`${scope}/${selected.riskType}`"
      v-model:open="open"
      :tenant-id="tenantId"
      :preference="selected"
      :telegram-linked="link.data.value?.linked ?? false"
      :time-zone="timeZone || 'UTC'"
      @saved="selected = $event"
    />
  </div>
</template>
