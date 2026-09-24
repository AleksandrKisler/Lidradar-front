<script setup lang="ts">
/**
 * Данные и согласие на обучение (блок 12, макета нет). Статус читает любой
 * участник; выдать или отозвать согласие может только владелец. Текст честно
 * описывает границу: согласие касается наборов данных, а не работы сервиса, и
 * отзыв не стирает историю.
 */
import { computed } from 'vue'
import { formatDateTime } from '@/shared/lib'
import { UiBadge, UiCard, UiErrorState, UiPageHeader, UiSkeleton } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import { consentState, useConsentQuery } from '@/entities/consent'
import { useMembersQuery } from '@/entities/team'
import { ConsentControls } from '@/features/manage-consent'
import SettingsTabs from './SettingsTabs.vue'

const session = useSessionStore()
const tenantId = computed(() => session.tenantId ?? '')
const organization = useOrganizationQuery(() => session.tenantId)
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')
const consent = useConsentQuery(() => session.tenantId)
/** Имена авторов доступны владельцу через список участников; остальным — нейтральная подпись. */
const members = useMembersQuery(() => (session.can('member.manage') ? session.tenantId : null))

const canManage = computed(() => session.can('organization.manage'))
const state = computed(() => (consent.data.value ? consentState(consent.data.value) : null))

function personName(userId: string | undefined): string {
  if (!userId) return ''
  if (userId === session.user?.id) return 'вы'
  const member = members.data.value?.find((item) => item.userId === userId)
  return member ? member.displayName : 'участник организации'
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiPageHeader
      title="Данные и согласие на обучение"
      subtitle="Что происходит с перепиской и вердиктами команды"
    />
    <SettingsTabs />

    <UiCard as="section" aria-labelledby="consent-title">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="consent-title" class="text-lg font-bold text-ink">
            Согласие на использование данных в наборах
          </h2>
          <p class="mt-1 text-sm text-muted">
            Область — наборы данных: обучение и оценка моделей на реальных переписках и вердиктах
            команды.
          </p>
        </div>
        <UiSkeleton v-if="consent.isPending.value" class="h-6 w-28" />
        <UiBadge v-else-if="state" :tone="state === 'active' ? 'success' : 'neutral'">
          {{ state === 'active' ? 'Действует' : 'Не дано' }}
        </UiBadge>
      </div>

      <UiErrorState
        v-if="consent.isError.value"
        class="mt-4"
        :error="consent.error.value"
        title="Не удалось прочитать состояние согласия"
        @retry="consent.refetch()"
      />
      <template v-else-if="consent.data.value">
        <dl
          v-if="consent.data.value.consent"
          class="mt-4 grid gap-2 text-sm sm:grid-cols-2"
          data-testid="consent-audit"
        >
          <div>
            <dt class="text-muted">Выдано</dt>
            <dd class="font-semibold text-ink">
              {{ formatDateTime(consent.data.value.consent.grantedAt, timeZone) }} ·
              {{ personName(consent.data.value.consent.grantedBy) }}
            </dd>
          </div>
          <div v-if="consent.data.value.consent.revokedAt">
            <dt class="text-muted">Отозвано</dt>
            <dd class="font-semibold text-ink">
              {{ formatDateTime(consent.data.value.consent.revokedAt, timeZone) }} ·
              {{ personName(consent.data.value.consent.revokedBy) }}
            </dd>
          </div>
        </dl>
        <p v-else class="mt-4 text-sm text-muted">
          Согласие не выдавалось: данные организации используются только для работы сервиса.
        </p>

        <div class="mt-5">
          <ConsentControls v-if="canManage" :tenant-id="tenantId" :status="consent.data.value" />
          <p v-else class="text-sm text-muted" data-testid="consent-readonly">
            Дать или отозвать согласие может владелец организации.
          </p>
        </div>
      </template>
    </UiCard>

    <div class="grid gap-6 md:grid-cols-2">
      <UiCard as="section" aria-labelledby="scope-title">
        <h2 id="scope-title" class="text-lg font-bold text-ink">На что влияет согласие</h2>
        <ul class="mt-3 flex flex-col gap-2 text-sm text-ink">
          <li>Реальные переписки и вердикты по рискам могут включаться в наборы данных.</li>
          <li>Каждый вердикт хранит признак: действовало ли согласие в момент записи.</li>
          <li>Инструменты наборов данных отбирают только записи с этим признаком.</li>
        </ul>
      </UiCard>
      <UiCard as="section" aria-labelledby="unchanged-title">
        <h2 id="unchanged-title" class="text-lg font-bold text-ink">Что не меняется</h2>
        <ul class="mt-3 flex flex-col gap-2 text-sm text-ink">
          <li>Поиск рисков и работа Radar не зависят от согласия.</li>
          <li>Отзыв действует на будущее и не удаляет историю выдач из аудита.</li>
          <li>Уже записанные вердикты сохраняют признак согласия на момент записи.</li>
        </ul>
      </UiCard>
    </div>
  </div>
</template>
