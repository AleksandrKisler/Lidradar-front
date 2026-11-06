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

const props = defineProps<{
  /** Первичная загрузка сессии: статичные подписи на месте, динамика скрыта (Figma 464:9319). */
  loading?: boolean
}>()

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const expired = computed(() => session.signOutReason === 'expired')
const logoutUnconfirmed = computed(() => route.query.signout === 'unconfirmed')
// После сброса пароля (ADR 0058) сервер завершил все сессии: вход выполняется новым паролем.
const passwordReset = computed(() => route.query.reset === 'done')
// Пароль изменён, но состояние сессии в этом браузере узнать не удалось: сессия завершена локально.
const passwordResetLocal = computed(() => route.query.reset === 'local')

function onSuccess(): void {
  void router.replace(sanitizeReturnPath(route.query.redirect) ?? { name: 'radar' })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiCard :padded="false" class="flex flex-col gap-6 p-[23px] md:p-[31px]">
      <div class="flex flex-col gap-2">
        <p class="text-meta font-medium text-secondary">С возвращением</p>
        <h1 class="text-metric font-semibold text-ink md:text-4xl md:leading-10">
          Вход в LidRadar
        </h1>
      </div>
      <UiAlert v-if="expired" tone="info" title="Сессия завершена">
        Срок сессии истёк или доступ был отозван. Войдите снова, чтобы продолжить.
      </UiAlert>
      <UiAlert v-if="passwordReset" tone="success" title="Пароль изменён">
        Войдите с новым паролем. На всех устройствах вы вышли из аккаунта.
      </UiAlert>
      <UiAlert v-if="passwordResetLocal" tone="success" title="Пароль изменён">
        Войдите с новым паролем. Не удалось проверить состояние сессии в этом браузере, поэтому мы
        завершили её здесь локально.
      </UiAlert>
      <UiAlert v-if="logoutUnconfirmed" tone="warning" title="Выход выполнен локально">
        Сервер не подтвердил завершение сессии. Если устройство общее, войдите и выйдите ещё раз при
        восстановлении связи.
      </UiAlert>
      <div v-if="props.loading" class="flex flex-col gap-4" role="status" aria-label="Загрузка">
        <div class="flex flex-col gap-2">
          <p class="text-base leading-5 font-medium text-ink">Электронная почта</p>
          <div class="h-[46px] rounded-field bg-line motion-safe:animate-pulse" />
        </div>
        <div class="flex flex-col gap-2">
          <p class="text-base leading-5 font-medium text-ink">Пароль</p>
          <div class="h-[46px] rounded-field bg-line motion-safe:animate-pulse" />
          <p class="flex h-[46px] items-center justify-end text-sm text-link">Забыли пароль?</p>
        </div>
        <div
          class="flex h-[46px] items-center justify-center rounded-button bg-line text-field leading-5 font-medium text-muted"
        >
          Войти
        </div>
      </div>
      <LoginForm v-else @success="onSuccess" />
      <!-- Figma 773:6361: две точки входа в регистрацию — общая (A/C по режиму сервера) и по приглашению (B2). -->
      <div class="flex flex-col items-center gap-2 text-center text-sm">
        <p class="text-secondary">Впервые в LidRadar?</p>
        <nav class="flex flex-wrap justify-center gap-x-10" aria-label="Регистрация">
          <RouterLink
            :to="{ name: 'register' }"
            class="flex h-[46px] items-center text-link hover:underline"
            >Создать аккаунт</RouterLink
          >
          <RouterLink
            :to="{ name: 'register', query: { flow: 'invite' } }"
            class="flex h-[46px] items-center text-link hover:underline"
            >У меня есть приглашение</RouterLink
          >
        </nav>
      </div>
    </UiCard>
    <p class="text-center text-xs leading-[18px] text-secondary">
      <span class="font-medium">Безопасный вход.</span> Данные организаций разделены. После входа
      доступны только ваши рабочие пространства.
    </p>
  </div>
</template>
