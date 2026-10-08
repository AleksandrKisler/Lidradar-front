<script setup lang="ts">
/**
 * Регистрация. Утверждённого макета нет (GAP-DESIGN-014): страница собрана
 * из тех же примитивов, что и вход. После успеха — общий boot-поток, который
 * для нового пользователя приведёт к созданию организации.
 */
import { useRouter } from 'vue-router'
import { UiCard } from '@/shared/ui'
import { RegisterForm } from '@/features/auth-session'

const router = useRouter()

function onSuccess(): void {
  void router.replace({ name: 'radar' })
}
</script>

<template>
  <div>
    <UiCard class="shadow-sm">
      <p class="text-xs font-semibold tracking-wide text-muted">Новый аккаунт</p>
      <h1 class="mt-2 text-2xl font-bold text-ink">Создайте аккаунт</h1>
      <p class="mt-2 text-sm text-muted">
        Первую организацию вы создадите сразу после регистрации.
      </p>
      <div class="mt-6">
        <RegisterForm @success="onSuccess" />
      </div>
      <p class="mt-6 text-center text-sm text-muted">
        Уже есть аккаунт?
        <RouterLink :to="{ name: 'login' }" class="font-semibold text-brand hover:underline"
          >Войти</RouterLink
        >
      </p>
    </UiCard>
  </div>
</template>
