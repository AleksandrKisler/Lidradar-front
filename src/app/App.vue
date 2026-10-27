<script setup lang="ts">
/**
 * Корень приложения. До завершения первичной загрузки сессии показывается
 * нейтральный экран: ни вход, ни данные прошлой организации не мелькают.
 * Ошибка сети или сервера на старте не считается выходом из системы —
 * предлагается повтор, после которого выполняется исходный переход.
 */
import { defineAsyncComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import { UiErrorState, UiSpinner } from '@/shared/ui'
// Каркас входа нужен только при первой загрузке на /login: остаётся отдельными чанками.
const LoginPage = defineAsyncComponent(() => import('@/pages/login').then((m) => m.LoginPage))
const AuthLayout = defineAsyncComponent(() => import('./layouts/AuthLayout.vue'))
import { useSessionStore } from '@/entities/session'

const session = useSessionStore()
const router = useRouter()

/** Адрес, который пользователь открыл до ошибки загрузки. */
const initialTarget = `${window.location.pathname}${window.location.search}${window.location.hash}`
const retrying = ref(false)
/** Первая загрузка на адресе входа показывает его каркас, а не нейтральный экран. */
const loginSkeleton = window.location.pathname === '/login'

async function retry(): Promise<void> {
  retrying.value = true
  try {
    await session.bootstrap()
    if (session.status !== 'error') await router.replace(initialTarget)
  } finally {
    retrying.value = false
  }
}
</script>

<template>
  <AuthLayout v-if="!session.booted && loginSkeleton">
    <LoginPage loading />
  </AuthLayout>
  <div v-else-if="!session.booted" class="flex min-h-dvh items-center justify-center" role="status">
    <UiSpinner class="size-8 text-brand" label="Загрузка приложения" />
  </div>
  <div
    v-else-if="session.status === 'error'"
    class="flex min-h-dvh items-center justify-center p-6"
  >
    <div class="w-full max-w-lg">
      <UiErrorState
        :error="session.bootError"
        title="Не удалось загрузить приложение"
        :retry-label="retrying ? 'Повторяем…' : 'Повторить'"
        @retry="retry"
      />
    </div>
  </div>
  <RouterView v-else />
</template>
