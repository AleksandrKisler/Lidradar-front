<script setup lang="ts">
/**
 * Страница риска: рабочее пространство по идентификатору из адреса.
 * Идентификатор не доверенный — неверный формат сразу даёт «не найдено»
 * без запроса. Ссылка «Radar» (в одной строке с «Обновить» внутри рабочего
 * пространства) возвращает к ленте с прежними фильтрами, если пользователь
 * пришёл оттуда.
 */
import { computed } from 'vue'
import { RouterLink, useRoute, type RouteLocationRaw } from 'vue-router'
import { UiCard, UiEmptyState, UiIcon } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { RiskWorkspace } from '@/widgets/risk-workspace'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const route = useRoute()
const session = useSessionStore()

const riskId = computed(() => {
  const raw = route.params.riskId
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : null
})

const backTarget = computed<RouteLocationRaw>(() => {
  const back: unknown = window.history.state?.back
  return typeof back === 'string' && back.startsWith('/radar') ? back : { name: 'radar' }
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <RiskWorkspace
      v-if="riskId && session.tenantId"
      :tenant-id="session.tenantId"
      :risk-id="riskId"
      :back-to="backTarget"
    />
    <template v-else>
      <nav aria-label="Навигация по разделу">
        <RouterLink
          :to="backTarget"
          class="inline-flex items-center gap-1 text-sm font-medium text-brand-dark hover:underline"
        >
          <UiIcon name="arrow-back" class="size-5" />Radar
        </RouterLink>
      </nav>
      <UiCard :padded="false">
        <UiEmptyState
          title="Риск не найден"
          description="Проверьте ссылку: такого риска нет в этой организации."
        >
          <template #actions>
            <RouterLink
              :to="{ name: 'radar' }"
              class="text-sm font-medium text-brand-dark hover:underline"
            >
              Вернуться в Radar
            </RouterLink>
          </template>
        </UiEmptyState>
      </UiCard>
    </template>
  </div>
</template>
