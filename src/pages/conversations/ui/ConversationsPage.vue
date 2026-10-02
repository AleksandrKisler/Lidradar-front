<script setup lang="ts">
/**
 * Диалоги: список и переписка. На широком экране — две панели, на узком —
 * отдельные состояния маршрута: список либо переписка с возвратом к списку.
 * Фильтры живут в query-строке и сохраняются при открытии переписки.
 */
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { UiCard, UiEmptyState, UiPageHeader } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import type { ConversationFilters } from '@/entities/conversation'
import { ConversationList } from '@/widgets/conversation-list'
import { ConversationThread } from '@/widgets/conversation-thread'
import { conversationFiltersToQuery, parseConversationFilters } from '../model/filters-query'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const tenantId = computed(() => session.tenantId)
const filters = computed(() => parseConversationFilters(route.query))
const organization = useOrganizationQuery(tenantId)
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')

/** Идентификатор из адреса: неверный формат — «не найдено» без запроса. */
const rawConversationId = computed(() => {
  const raw = route.params.conversationId
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && value !== '' ? value : null
})
const conversationId = computed(() =>
  rawConversationId.value && UUID_PATTERN.test(rawConversationId.value)
    ? rawConversationId.value
    : null,
)
const detailOpen = computed(() => rawConversationId.value !== null)

function setFilters(next: ConversationFilters): void {
  void router.replace({ query: conversationFiltersToQuery(next) })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiPageHeader
      title="Диалоги"
      subtitle="Переписка и связанные риски: контекст перед ответом клиенту"
    />
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
      <div class="min-w-0" :class="detailOpen ? 'hidden lg:block' : ''">
        <ConversationList
          v-if="tenantId"
          :tenant-id="tenantId"
          :filters="filters"
          :selected-id="conversationId"
          :time-zone="timeZone"
          @update:filters="setFilters"
        />
      </div>
      <div class="min-w-0" :class="detailOpen ? 'flex flex-col gap-3' : 'hidden lg:block'">
        <RouterLink
          v-if="detailOpen"
          :to="{ name: 'conversations', query: route.query }"
          class="text-sm font-semibold text-brand-dark hover:underline lg:hidden"
        >
          ← К списку
        </RouterLink>
        <ConversationThread
          v-if="tenantId && conversationId"
          :key="conversationId"
          :tenant-id="tenantId"
          :conversation-id="conversationId"
          :time-zone="timeZone"
        />
        <UiCard v-else-if="detailOpen" :padded="false">
          <UiEmptyState
            title="Переписка не найдена"
            description="Проверьте ссылку: такой переписки нет в этой организации."
          />
        </UiCard>
        <UiCard v-else :padded="false">
          <UiEmptyState
            title="Выберите диалог"
            description="Откройте переписку, чтобы увидеть историю перед ответом."
          />
        </UiCard>
      </div>
    </div>
  </div>
</template>
