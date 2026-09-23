<script setup lang="ts">
/**
 * Страница входа по макету «Вход». После успеха управление передаётся
 * общему boot-потоку: путь возврата принимается только внутренний.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { sanitizeReturnPath } from '@/shared/lib'
import { UiAlert, UiCard } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { LoginForm } from '@/features/auth-session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const expired = computed(() => session.signOutReason === 'expired')
const logoutUnconfirmed = computed(() => route.query.signout === 'unconfirmed')

function onSuccess(): void {
  void router.replace(sanitizeReturnPath(route.query.redirect) ?? { name: 'radar' })
}
</script>

<template>
  <div>
    <UiCard class="shadow-sm">
      <p class="text-xs font-semibold tracking-wide text-muted uppercase">С возвращением</p>
      <h1 class="mt-2 text-2xl font-bold text-ink">Войдите в своё рабочее пространство</h1>
      <div class="mt-6 flex flex-col gap-4">
        <UiAlert v-if="expired" tone="info" title="Сессия завершена">
          Срок сессии истёк или доступ был отозван. Войдите снова, чтобы продолжить.
        </UiAlert>
        <UiAlert v-if="logoutUnconfirmed" tone="warning" title="Выход выполнен локально">
          Сервер не подтвердил завершение сессии. Если устройство общее, войдите и выйдите ещё раз
          при восстановлении связи.
        </UiAlert>
        <LoginForm @success="onSuccess" />
      </div>
      <p class="mt-6 text-center text-sm text-muted">
        Впервые в LidRadar?
        <RouterLink :to="{ name: 'register' }" class="font-semibold text-brand hover:underline"
          >Создать аккаунт</RouterLink
        >
      </p>
    </UiCard>
    <p class="mt-6 text-center text-xs leading-5 text-muted">
      <span class="font-semibold">Безопасный вход.</span> Данные организаций разделены. После входа
      доступны только ваши рабочие пространства.
    </p>
  </div>
</template>
