<script setup lang="ts">
/**
 * Корень приложения. До завершения первичной загрузки сессии показывается
 * нейтральный экран: ни вход, ни данные прошлой организации не мелькают.
 * Ошибка сети или сервера на старте не считается выходом из системы —
 * предлагается повтор, после которого выполняется исходный переход.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { UiErrorState, UiSpinner } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'

const session = useSessionStore()
const router = useRouter()

/** Адрес, который пользователь открыл до ошибки загрузки. */
const initialTarget = `${window.location.pathname}${window.location.search}${window.location.hash}`
const retrying = ref(false)

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
  <div v-if="!session.booted" class="flex min-h-dvh items-center justify-center" role="status">
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
