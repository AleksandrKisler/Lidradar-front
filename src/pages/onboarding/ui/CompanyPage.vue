<script setup lang="ts">
/**
 * Шаг 1 начала работы по макету «Настройка компании»: создание организации.
 * После создания сессия перечитана, новая организация выбрана — дальше точка
 * и график. Сервер сам определит, что уже выполнено (`/organization/onboarding`).
 */
import { RouterLink, useRouter } from 'vue-router'
import { UiCard } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { CreateOrganizationForm } from '@/features/create-organization'

const router = useRouter()
const session = useSessionStore()

function onCreated(): void {
  void router.replace({ name: 'onboarding-location' })
}
</script>

<template>
  <UiCard>
    <p class="text-xs font-semibold tracking-wide text-brand-dark uppercase">Шаг 1 из 4</p>
    <h1 class="mt-2 text-2xl font-bold text-ink">Расскажите о компании</h1>
    <p class="mt-2 text-sm leading-6 text-muted">
      Это поможет показывать риски в нужном контексте и считать показатели в одной валюте. Первую
      точку и график настроим следующим шагом.
    </p>
    <div class="mt-6">
      <CreateOrganizationForm @created="onCreated" />
    </div>
    <p v-if="session.memberships.length" class="mt-6 text-sm text-muted">
      <RouterLink
        :to="{ name: 'workspaces' }"
        class="font-semibold text-brand-dark hover:underline"
      >
        Вернуться к рабочим пространствам
      </RouterLink>
    </p>
    <p class="mt-3 text-sm text-muted">
      Вас пригласили в существующую компанию?
      <RouterLink
        :to="{ name: 'invitations-accept' }"
        class="font-semibold text-brand-dark hover:underline"
      >
        Принять приглашение
      </RouterLink>
    </p>
  </UiCard>
</template>
