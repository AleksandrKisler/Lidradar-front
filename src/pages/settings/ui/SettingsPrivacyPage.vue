<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { isApiError } from '@/shared/api'
import { parseInstant, useMediaQuery } from '@/shared/lib'
import { UiAlert, UiButton, UiCard, UiSkeleton } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import { consentState, useConsentQuery } from '@/entities/consent'
import { useMembersQuery } from '@/entities/team'
import { ConsentControls, ExportOrganizationCard } from '@/features/manage-consent'
import SettingsTabs from './SettingsTabs.vue'
import SettingsPageHead from './SettingsPageHead.vue'

const session = useSessionStore()
const wide = useMediaQuery('(min-width: 768px)')
const tablet = useMediaQuery('(768px <= width < 1024px)')
const placeholderColor = '#f5f7fb'
const tenantId = computed(() => session.tenantId ?? '')
const organization = useOrganizationQuery(() => session.tenantId)
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')
const consent = useConsentQuery(() => session.tenantId)
const members = useMembersQuery(() => (session.can('member.manage') ? session.tenantId : null))
const canManage = computed(() => session.can('organization.manage'))
const state = computed(() => (consent.data.value ? consentState(consent.data.value) : null))
const notice = ref<'grant' | 'revoke' | null>(null)
const alreadyActive = ref(false)
const consentTitle = ref<HTMLElement>()
const recoverConsentFocus = () =>
  document.querySelector<HTMLButtonElement>('#consent-refresh:not(:disabled)') ??
  consentTitle.value ??
  null
function showNotice(kind: 'grant' | 'revoke' | null, existing = false) {
  notice.value = kind
  alreadyActive.value = existing
}
watch(
  () => [session.tenantId, session.user?.id, canManage.value],
  () => {
    notice.value = null
  },
  { flush: 'sync' },
)
watch(consent.error, (error) => {
  if (isApiError(error) && error.isForbidden) void session.refresh().catch(() => {})
})
function personName(userId: string | undefined): string {
  if (!userId) return 'участник организации'
  if (userId === session.user?.id) return 'Вы'
  return (
    members.data.value?.find((item) => item.userId === userId)?.displayName ??
    'участник организации'
  )
}
function decisionTime(value: string) {
  const date = parseInstant(value)
  if (!date) return '—'
  const format = (zone: string) =>
    new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: zone,
    })
      .format(date)
      .replace(' г.', '')
      .replace(' в ', ', ')
  try {
    return format(timeZone.value)
  } catch {
    return format('UTC')
  }
}
const documents = [
  ['terms', 'Пользовательское соглашение'],
  ['dpa', 'Поручение на обработку персональных данных'],
  ['privacy', 'Политика обработки персональных данных'],
  ['ai-data', 'Использование данных для улучшения AI'],
]
</script>

<template>
  <div class="flex min-w-0 flex-col gap-6 break-words">
    <SettingsPageHead
      title="Данные и конфиденциальность"
      compact-mobile-title
      scrolling-tabs
      hide-tabs
      :subtitle="`${session.membership?.organizationName ?? ''} · Данные организации`"
    />
    <SettingsTabs
      desktop-privacy
      :scrolling="!wide || tablet"
      :style="wide ? undefined : { '--privacy-tabs': '1000px' }"
    />
    <UiAlert
      v-if="notice === 'grant'"
      tone="success"
      compact
      privacy-page
      :title="alreadyActive ? '✓ Согласие уже действовало' : '✓ Согласие выдано'"
    >
      {{
        alreadyActive
          ? 'Повторная выдача ничего не изменила.'
          : 'Новые переписки и вердикты могут включаться в наборы данных.'
      }}
    </UiAlert>
    <UiAlert
      v-else-if="notice === 'revoke'"
      tone="success"
      compact
      privacy-page
      title="✓ Согласие отозвано."
    />
    <UiCard
      as="section"
      :padded="false"
      aria-labelledby="consent-title"
      class="flex flex-col gap-4 p-4 md:p-6"
    >
      <div class="flex items-start justify-between gap-4">
        <h2
          id="consent-title"
          ref="consentTitle"
          tabindex="-1"
          class="min-w-0 flex-1 text-xl leading-7 font-semibold text-ink"
        >
          Обучение моделей
        </h2>
        <span
          class="inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs leading-[18px]"
          :class="state === 'active' ? 'bg-success-pale text-success' : 'bg-canvas text-muted'"
          :style="state === 'active' ? undefined : { backgroundColor: placeholderColor }"
          data-testid="consent-status"
          >{{
            consent.isPending.value
              ? 'Загружаем…'
              : !state
                ? 'Статус неизвестен'
                : state === 'active'
                  ? '✓ Действует'
                  : 'Не дано'
          }}</span
        >
      </div>
      <p class="text-sm leading-5 text-muted">
        Переписки и вердикты команды могут использоваться для обучения и оценки моделей LidRadar —
        только с согласия владельца.
      </p>
      <p v-if="consent.isPending.value" role="status" class="text-sm text-muted">
        Получаем состояние согласия…
      </p>
      <template v-else-if="consent.data.value">
        <div
          v-if="consent.data.value.consent"
          class="flex flex-col gap-4 text-xs leading-[18px] text-muted"
          data-testid="consent-audit"
        >
          <p>
            Выдано {{ decisionTime(consent.data.value.consent.grantedAt) }} ·
            {{ personName(consent.data.value.consent.grantedBy) }}
          </p>
          <p v-if="consent.data.value.consent.revokedAt">
            Отозвано {{ decisionTime(consent.data.value.consent.revokedAt) }} ·
            {{ personName(consent.data.value.consent.revokedBy) }}
          </p>
        </div>
        <p v-else class="text-sm leading-5 text-ink">Согласие ещё не выдавалось.</p>
      </template>
      <div
        v-if="consent.isPending.value"
        class="flex flex-col gap-2"
        :style="tablet ? { width: 'calc(100% + 49px)', overflow: 'hidden' } : undefined"
        aria-hidden="true"
      >
        <UiSkeleton
          v-for="width in tablet ? ['857.6px', '643.2px'] : ['80%', '60%']"
          :key="width"
          class="h-3"
          :style="{ width, borderRadius: '6px', backgroundColor: placeholderColor }"
        />
      </div>
      <UiAlert
        v-if="consent.isError.value"
        :tone="consent.data.value ? 'warning' : 'danger'"
        compact
        privacy-page
        :title="consent.data.value ? '! Статус не обновлён' : '! Не удалось загрузить статус'"
        :trace-id="isApiError(consent.error.value) ? consent.error.value.traceId : ''"
      >
        {{
          consent.data.value
            ? 'Показаны последние загруженные данные. Перед изменением обновите статус.'
            : 'Решение о согласии неизвестно. Повторите загрузку.'
        }}
      </UiAlert>
      <UiButton
        v-if="consent.isError.value"
        id="consent-refresh"
        variant="secondary"
        class="self-start"
        :style="{
          minWidth: consent.data.value ? '200px' : '210px',
          width: wide ? (consent.data.value ? '200px' : '210px') : '100%',
        }"
        :loading="consent.isFetching.value"
        @click="consent.refetch()"
        >{{ consent.data.value ? 'Обновить статус' : 'Повторить загрузку' }}</UiButton
      >
      <ConsentControls
        v-if="canManage && consent.data.value"
        v-show="!consent.isError.value"
        :tenant-id="tenantId"
        :desktop="wide"
        :status="consent.data.value"
        :blocked="consent.isError.value || consent.isFetching.value"
        :inline-notice="false"
        :fallback-focus="recoverConsentFocus"
        @notice="showNotice"
      />
      <p
        v-else-if="!canManage && consent.data.value"
        class="text-sm text-muted"
        data-testid="consent-readonly"
      >
        Изменить согласие может владелец организации.
      </p>
      <p class="text-xs leading-[18px] text-muted">
        Работа Radar не зависит от согласия. Отзыв прекращает новые включения в наборы данных и
        сохраняет историю решений.
      </p>
    </UiCard>
    <ExportOrganizationCard
      v-if="session.can('organization.export')"
      :desktop="wide"
      :tenant-id="tenantId"
    />
    <UiCard
      as="section"
      :padded="false"
      aria-labelledby="legal-title"
      class="flex flex-col gap-4 p-4 md:p-6"
    >
      <h2 id="legal-title" class="text-xl leading-7 font-semibold text-ink">Документы</h2>
      <p class="text-sm leading-5 text-muted">Условия обработки и использования данных.</p>
      <ul
        class="grid gap-4 text-sm leading-5 lg:grid-cols-2"
        :style="
          wide
            ? {
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                columnGap: '24px',
                rowGap: '16px',
              }
            : undefined
        "
      >
        <li v-for="[path, label] in documents" :key="path" class="min-w-0">
          <a
            :href="`/legal/${path}.html`"
            target="_blank"
            rel="noopener"
            class="flex min-h-11 items-center justify-between gap-3 font-medium text-brand hover:underline"
            ><span class="min-w-0 flex-1">{{ label }}</span
            ><span class="size-5 shrink-0 font-normal" aria-hidden="true">↗</span></a
          >
        </li>
      </ul>
    </UiCard>
    <div class="flex flex-col gap-1 text-xs leading-[18px] text-muted">
      <p>
        {{
          session.can('organization.export')
            ? 'Ваши личные данные и удаление аккаунта — в отдельном разделе «Аккаунт».'
            : 'Архив компании доступен владельцу. Ваши личные данные находятся в «Аккаунте».'
        }}
      </p>
      <RouterLink
        :to="{ name: 'settings-account' }"
        :style="{ width: wide ? '220px' : '100%' }"
        class="flex h-input max-w-full items-center justify-center rounded-button text-sm font-medium text-link hover:underline"
        >Открыть аккаунт →</RouterLink
      >
    </div>
  </div>
</template>
