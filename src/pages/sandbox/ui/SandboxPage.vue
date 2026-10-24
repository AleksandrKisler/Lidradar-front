<script setup lang="ts">
/**
 * Песочница переписки закрытого стейджа (ADR 0066). Раздел доступен только при признаке `sandbox` из
 * `/auth/me`; прямой переход без него показывает пояснение, а не пустой экран.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UiBadge, UiCard, UiEmptyState, UiPageHeader } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import { useSandboxOverviewQuery } from '@/entities/sandbox'
import { SandboxWorkspace } from '@/widgets/sandbox-workspace'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const tenantId = computed(() => (session.sandbox ? session.tenantId : null))
const organization = useOrganizationQuery(tenantId)
const overview = useSandboxOverviewQuery(tenantId)
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')

const conversationId = computed(() => {
  const raw = route.params.conversationId
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : null
})
const usage = computed(() => {
  const data = overview.data.value
  if (!data) return ''
  return `За сутки: ${data.usage.conversations} из ${data.limits.conversationsPerDay} переписок, ${data.usage.messages} из ${data.limits.messagesPerDay} сообщений`
})

function select(id: string | null): void {
  void router.push(
    id ? { name: 'sandbox-conversation', params: { conversationId: id } } : { name: 'sandbox' },
  )
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiPageHeader
      title="Песочница"
      subtitle="Соберите переписку от имени клиента и бизнеса, отправьте её в систему и сверьте риск, который найдёт Radar. Сообщения ненастоящие и видны только в вашей организации."
    >
      <template #actions>
        <UiBadge tone="warning">Только стейдж</UiBadge>
      </template>
    </UiPageHeader>
    <p v-if="usage" class="-mt-3 text-xs text-muted">{{ usage }}</p>
    <SandboxWorkspace
      v-if="tenantId"
      :tenant-id="tenantId"
      :time-zone="timeZone"
      :conversation-id="conversationId"
      @select="select"
    />
    <UiCard v-else :padded="false">
      <UiEmptyState
        title="Песочница недоступна"
        description="Песочница работает только на закрытом стейдже. В рабочей системе её нет."
      />
    </UiCard>
  </div>
</template>
