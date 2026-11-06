<script setup lang="ts">
import { computed } from 'vue'
import { UiButton } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import { IntegrationsList } from '@/widgets/integrations-list'

const session = useSessionStore()
const allowed = computed(() => session.can('integration.manage'))
const organization = useOrganizationQuery(() => (allowed.value ? session.tenantId : null))
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? null)
const identity = computed(() => `${session.user?.id}:${session.tenantId}:${session.role}`)
</script>

<template>
  <div
    v-if="allowed && organization.isError.value && !timeZone"
    class="integration-timezone-error"
    role="status"
  >
    <p>Часовой пояс не загружен. Данные источников доступны, время событий пока не показано.</p>
    <UiButton
      variant="secondary"
      :loading="organization.isFetching.value"
      @click="organization.refetch()"
      >Загрузить часовой пояс</UiButton
    >
  </div>
  <IntegrationsList
    v-if="session.tenantId"
    :key="identity"
    :tenant-id="session.tenantId"
    :time-zone="timeZone"
  />
</template>

<style scoped>
.integration-timezone-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  line-height: 20px;
  color: var(--color-secondary);
}
</style>
