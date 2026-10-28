<script setup lang="ts">
/**
 * Выбор рабочего пространства по макету «Рабочие пространства» (Figma 477:8415 и состояния).
 * Показывается автоматически, если запомненный выбор недействителен, и по прямому
 * переходу для смены организации.
 */
import { isNavigationFailure, NavigationFailureType, useRoute, useRouter } from 'vue-router'
import { sanitizeReturnPath } from '@/shared/lib'
import { UiPageIntro } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { WorkspaceList } from '@/features/select-workspace'

defineProps<{
  /** Первичная загрузка: каркас списка без данных (Figma «Первичная загрузка»). */
  loading?: boolean
}>()

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

async function openTarget(): Promise<void> {
  const failure = await router.replace(
    sanitizeReturnPath(route.query.redirect) ?? { name: 'radar' },
  )
  // Переход, который не состоялся, — неудача открытия; «уже там» (duplicated) неудачей не считается.
  if (
    isNavigationFailure(failure) &&
    !isNavigationFailure(failure, NavigationFailureType.duplicated)
  ) {
    throw new Error('navigation failed')
  }
}
</script>

<template>
  <div>
    <UiPageIntro
      narrow
      title="Выберите рабочее пространство"
      description="Данные организаций разделены. Выберите пространство, с которым хотите работать сейчас."
    />
    <WorkspaceList :loading="loading" :open="openTarget" />
    <div
      class="mt-[26px] flex flex-col items-center gap-2 border-t border-hairline pt-6 text-center text-sm leading-5 text-secondary md:mt-9 md:gap-0 md:pt-[27px]"
    >
      <p v-if="session.canCreateOrganization && !loading" class="mb-2">
        Нужно новое пространство?
        <RouterLink :to="{ name: 'onboarding-company' }" class="text-link hover:underline">
          Создать организацию
        </RouterLink>
      </p>
      <p class="flex flex-col items-center gap-5 md:flex-row md:gap-2.5">
        Получили код от владельца?
        <RouterLink :to="{ name: 'invitations-accept' }" class="text-link hover:underline">
          Принять приглашение
        </RouterLink>
      </p>
    </div>
  </div>
</template>
