<script setup lang="ts">
/**
 * Layout начала работы (Figma «Начало работы»): шапка, ряд шагов над страницей шага. Выполненность шагов
 * берётся из серверного статуса, текущий шаг — из маршрута. Право маршрута проверяется здесь же:
 * менеджер без `location.manage` увидит «Раздел недоступен», а не форму. `loading` — каркас первой
 * загрузки: сессия неизвестна, ряд шагов показывает только первый шаг текущим. Шаг «Точки и графики»
 * (US-M02-04) занимает широкую рабочую область 1120 px: точки слева, график справа; ряд шагов
 * остаётся 840 px. Ритм по Figma у всех шагов: «Шаг n из 4» 13/16 на 28 px ниже шапки, ряд шагов 60 px,
 * ряд шагов → заголовок 28 px (телефон 16 px).
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

const wide = computed(() => route.name === 'onboarding-location')
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
      :class="[
        'mx-auto w-full px-4 pt-2 md:px-8 md:pt-7',
        // На телефоне шага 2 нижняя панель закреплена и в конце прокрутки должна лежать на краю окна.
        wide ? 'pb-0 md:pb-8' : 'pb-10',
        wide ? 'max-w-[1184px] xl:max-w-[1120px] xl:px-0' : 'max-w-[840px] lg:px-0',
      ]"
    >
      <div class="mx-auto w-full max-w-[840px]">
        <OnboardingProgress
          :status="status.data.value ?? null"
          :current="loading ? 'ORGANIZATION' : (route.meta.onboardingStep ?? null)"
        />
      </div>
      <div :class="['mx-auto mt-4 min-w-0 md:mt-7', wide ? 'max-w-[1120px]' : 'max-w-[760px]']">
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
