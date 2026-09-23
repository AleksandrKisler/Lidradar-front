<script setup lang="ts">
/**
 * Выбор рабочего пространства при нескольких членствах. Показывается
 * автоматически, если запомненный выбор недействителен, и по прямому
 * переходу для смены организации.
 */
import { useRoute, useRouter } from 'vue-router'
import { sanitizeReturnPath } from '@/shared/lib'
import { UiCard } from '@/shared/ui'
import { WorkspaceList } from '@/features/select-workspace'

const route = useRoute()
const router = useRouter()

function onSelected(): void {
  void router.replace(sanitizeReturnPath(route.query.redirect) ?? { name: 'radar' })
}
</script>

<template>
  <UiCard>
    <h1 class="text-2xl font-bold text-ink">Выберите рабочее пространство</h1>
    <p class="mt-2 text-sm text-muted">
      У вас несколько организаций. Данные каждой из них разделены: выберите, с какой работать
      сейчас.
    </p>
    <div class="mt-6">
      <WorkspaceList @selected="onSelected" />
    </div>
    <p class="mt-6 text-sm text-muted">
      Нужно новое пространство?
      <RouterLink
        :to="{ name: 'onboarding-company' }"
        class="font-semibold text-brand-dark hover:underline"
      >
        Создать организацию
      </RouterLink>
    </p>
    <p class="mt-2 text-sm text-muted">
      Получили код от владельца?
      <RouterLink
        :to="{ name: 'invitations-accept' }"
        class="font-semibold text-brand-dark hover:underline"
      >
        Принять приглашение
      </RouterLink>
    </p>
  </UiCard>
</template>
