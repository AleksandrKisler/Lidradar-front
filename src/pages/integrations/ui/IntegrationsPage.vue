<script setup lang="ts">
/**
 * Интеграции (макет 08): источники сообщений организации и, отдельно,
 * личная привязка Telegram текущего пользователя — это разные сущности.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { UiAlert, UiCard, UiPageHeader } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import { TelegramLinkCard } from '@/features/link-telegram'
import { IntegrationsList } from '@/widgets/integrations-list'

const session = useSessionStore()
const tenantId = computed(() => session.tenantId)
const organization = useOrganizationQuery(tenantId)
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiPageHeader
      title="Интеграции"
      subtitle="Переписка поступает — риски не теряются. Источник сообщений и личные уведомления проверяются отдельно."
    />
    <IntegrationsList v-if="tenantId" :tenant-id="tenantId" :time-zone="timeZone" />
    <UiCard v-if="tenantId">
      <TelegramLinkCard :tenant-id="tenantId" :time-zone="timeZone" />
      <p class="mt-4 text-sm text-muted">
        Что и когда присылать —
        <RouterLink
          :to="{ name: 'settings-notifications' }"
          class="font-semibold text-brand-dark hover:underline"
          >в настройках уведомлений</RouterLink
        >.
      </p>
    </UiCard>
    <UiAlert tone="info" title="При разрыве связи история остаётся">
      Переподключение не удаляет сохранённые диалоги и риски. Время последнего полученного события
      показывается на карточке, чтобы задержка была заметна.
    </UiAlert>
  </div>
</template>
