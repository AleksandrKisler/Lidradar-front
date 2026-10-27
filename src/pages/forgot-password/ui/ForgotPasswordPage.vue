<script setup lang="ts">
/**
 * Восстановление пароля (ADR 0058). Утверждённого макета нет: страница собрана из примитивов входа.
 * Письмо со ссылкой действует 60 минут; ответ страницы не зависит от того, есть ли такой адрес.
 */
import { UiCard } from '@/shared/ui'
import { ForgotPasswordForm } from '@/features/auth-session'
</script>

<template>
  <div>
    <UiCard :padded="false" class="p-[23px] md:p-[31px]">
      <p class="text-xs font-semibold tracking-wide text-muted">Восстановление доступа</p>
      <h1 class="mt-2 text-2xl font-bold text-ink">Забыли пароль?</h1>
      <p class="mt-2 text-sm text-muted">
        Укажите электронную почту, с которой вы регистрировались: мы отправим ссылку для нового
        пароля.
      </p>
      <div class="mt-6">
        <ForgotPasswordForm />
      </div>
      <p class="mt-6 text-center text-sm text-muted">
        Вспомнили пароль?
        <RouterLink :to="{ name: 'login' }" class="font-semibold text-brand hover:underline"
          >Войти</RouterLink
        >
      </p>
    </UiCard>
  </div>
</template>
