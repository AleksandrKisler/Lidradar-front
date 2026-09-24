<script setup lang="ts">
/**
 * Напоминание на Radar о незавершённой настройке. Источник истины —
 * серверный статус; баннер молчит, пока статус не загружен или настройка
 * завершена, и не блокирует работу.
 */
import { computed, toRef } from 'vue'
import { RouterLink } from 'vue-router'
import { UiAlert } from '@/shared/ui'
import { onboardingStepLabel, useOnboardingQuery } from '@/entities/organization'

const props = defineProps<{ tenantId: string }>()
const status = useOnboardingQuery(toRef(props, 'tenantId'))

const nextStep = computed(() => {
  const data = status.data.value
  if (!data || data.complete || !data.nextStep) return null
  return data.nextStep
})
</script>

<template>
  <UiAlert v-if="nextStep" tone="info" title="Настройка не завершена">
    Следующий шаг — {{ onboardingStepLabel(nextStep).toLowerCase() }}.
    <RouterLink
      :to="{ name: 'onboarding' }"
      class="ml-1 font-semibold text-brand-dark hover:underline"
    >
      Продолжить настройку
    </RouterLink>
  </UiAlert>
</template>
