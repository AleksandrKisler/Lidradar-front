<script setup lang="ts">
/**
 * Точка возобновления начала работы. Без членств — создание компании, без
 * выбранной организации — выбор пространства, иначе шаг берётся из
 * серверного статуса. Локальное состояние не участвует.
 */
import { watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { UiErrorState, UiSpinner } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOnboardingQuery } from '@/entities/organization'
import { routeForStep } from '../model/steps'

const router = useRouter()
const session = useSessionStore()
const status = useOnboardingQuery(() => session.tenantId)

watchEffect(() => {
  if (session.memberships.length === 0) {
    void router.replace({ name: 'onboarding-company' })
    return
  }
  if (!session.tenantId) {
    void router.replace({ name: 'workspaces', query: { redirect: '/onboarding' } })
    return
  }
  const data = status.data.value
  if (data) void router.replace({ name: routeForStep(data.complete ? null : data.nextStep) })
})
</script>

<template>
  <UiErrorState
    v-if="status.isError.value"
    :error="status.error.value"
    title="Не удалось определить шаг настройки"
    @retry="status.refetch()"
  />
  <div v-else class="flex justify-center py-16" role="status">
    <UiSpinner class="size-8 text-brand" label="Определяем шаг настройки" />
  </div>
</template>
