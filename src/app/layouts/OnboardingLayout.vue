<script setup lang="ts">
/**
 * Layout начала работы (Figma «Начало работы»): шапка, ряд шагов над страницей шага. Выполненность шагов
 * берётся из серверного статуса, текущий шаг — из маршрута. Право маршрута проверяется здесь же:
 * менеджер без `location.manage` увидит «Раздел недоступен», а не форму. `loading` — каркас первой
 * загрузки: сессия неизвестна, ряд шагов показывает только первый шаг текущим.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UiAccessDenied } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOnboardingQuery } from '@/entities/organization'
import { AccountDeletionBanner } from '@/features/auth-session'
import { AccountHeader } from '@/widgets/account-header'
import { OnboardingProgress } from '@/widgets/onboarding-progress'

const props = defineProps<{ loading?: boolean }>()

const session = useSessionStore()
const route = useRoute()
const router = useRouter()
const status = useOnboardingQuery(() => (props.loading ? null : session.tenantId))

const denied = computed(
  () => route.meta.permission !== undefined && !session.can(route.meta.permission),
)
</script>

<template>
  <div class="min-h-dvh">
    <AccountHeader :loading="loading" />
    <AccountDeletionBanner v-if="!loading" />
    <main
      id="main"
      class="mx-auto w-full max-w-[840px] px-4 pt-2 pb-10 md:px-8 md:pt-[27px] lg:px-0"
    >
      <OnboardingProgress
        :status="status.data.value ?? null"
        :current="loading ? 'ORGANIZATION' : (route.meta.onboardingStep ?? null)"
      />
      <div class="mx-auto mt-4 min-w-0 max-w-[760px] md:mt-8">
        <slot>
          <UiAccessDenied
            v-if="denied"
            back-label="Вернуться в Radar"
            @back="router.push({ name: 'radar' })"
          />
          <RouterView v-else />
        </slot>
      </div>
    </main>
  </div>
</template>
