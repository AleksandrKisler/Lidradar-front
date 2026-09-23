<script setup lang="ts">
/**
 * Страница риска: рабочее пространство по идентификатору из адреса.
 * Идентификатор не доверенный — неверный формат сразу даёт «не найдено»
 * без запроса. Ссылка «Radar» возвращает к ленте с прежними фильтрами,
 * если пользователь пришёл оттуда.
 */
import { computed } from 'vue'
import { RouterLink, useRoute, type RouteLocationRaw } from 'vue-router'
import { UiCard, UiEmptyState } from '@/shared/ui'
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
    <nav aria-label="Навигация по разделу">
      <RouterLink :to="backTarget" class="text-sm font-semibold text-brand-dark hover:underline">
        ← Radar
      </RouterLink>
    </nav>
    <RiskWorkspace
      v-if="riskId && session.tenantId"
      :tenant-id="session.tenantId"
      :risk-id="riskId"
    />
    <UiCard v-else :padded="false">
      <UiEmptyState
        title="Риск не найден"
        description="Проверьте ссылку: такого риска нет в этой организации."
      >
        <template #actions>
          <RouterLink
            :to="{ name: 'radar' }"
            class="text-sm font-semibold text-brand-dark hover:underline"
          >
            Вернуться в Radar
          </RouterLink>
        </template>
      </UiEmptyState>
    </UiCard>
  </div>
</template>
