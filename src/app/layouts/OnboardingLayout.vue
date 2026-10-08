<script setup lang="ts">
/**
 * Layout начала работы: шаги слева, содержимое шага справа. Выполненность
 * шагов берётся из серверного статуса, текущий шаг — из маршрута. Право
 * маршрута проверяется здесь же: менеджер без `location.manage` увидит
 * «Раздел недоступен», а не форму.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UiAccessDenied, UiIcon } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOnboardingQuery } from '@/entities/organization'
import { LogoutButton } from '@/features/auth-session'
import { OnboardingProgress } from '@/widgets/onboarding-progress'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()
const status = useOnboardingQuery(() => session.tenantId)

const denied = computed(
  () => route.meta.permission !== undefined && !session.can(route.meta.permission),
)

function onLoggedOut({ confirmed }: { confirmed: boolean }): void {
  void router.replace({ name: 'login', query: confirmed ? {} : { signout: 'unconfirmed' } })
}
</script>

<template>
  <div class="min-h-dvh">
    <header
      class="flex items-center justify-between gap-4 border-b border-line bg-paper px-5 py-3 md:px-12"
    >
      <p class="flex items-center gap-2 text-lg font-bold tracking-tight text-ink">
        <UiIcon name="radar" class="size-7" />LidRadar
      </p>
      <div class="flex items-center gap-3">
        <p class="hidden text-sm text-muted sm:block">{{ session.user?.displayName }}</p>
        <LogoutButton variant="secondary" @logged-out="onLoggedOut" />
      </div>
    </header>
    <main
      id="main"
      class="mx-auto grid w-full max-w-5xl gap-10 px-5 py-10 md:grid-cols-[240px_minmax(0,1fr)] md:px-12"
    >
      <aside class="hidden md:block">
        <p class="mb-5 text-xs font-semibold tracking-wide text-muted">Начало работы</p>
        <OnboardingProgress
          :status="status.data.value ?? null"
          :current="route.meta.onboardingStep ?? null"
        />
        <div class="mt-10 rounded-card bg-nav p-5 text-sm text-white">
          <p class="font-semibold">Вы управляете действиями.</p>
          <p class="mt-1 text-nav-text">
            LidRadar помогает заметить риск и выбрать следующий шаг. Самостоятельно клиентам не
            пишет.
          </p>
        </div>
      </aside>
      <div class="min-w-0">
        <UiAccessDenied
          v-if="denied"
          back-label="Вернуться в Radar"
          @back="router.push({ name: 'radar' })"
        />
        <RouterView v-else />
      </div>
    </main>
  </div>
</template>
