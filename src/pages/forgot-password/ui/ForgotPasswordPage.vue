<script setup lang="ts">
/**
 * Восстановление пароля (ADR 0058) по макету Access «Восстановление пароля» (Figma 462:5677 и состояния).
 * Письмо со ссылкой действует 60 минут; ответ страницы не зависит от того, есть ли такой адрес.
 */
import { UiCard } from '@/shared/ui'
import { AuthCardHeader, ForgotPasswordForm } from '@/features/auth-session'

defineProps<{
  /** Первичная загрузка сессии: каркас формы без динамики (Figma «Первичная загрузка»). */
  loading?: boolean
}>()
</script>

<template>
  <UiCard :padded="false" class="flex flex-col gap-6 p-[23px] md:p-[31px]">
    <AuthCardHeader
      eyebrow="Восстановление доступа"
      title="Восстановить пароль"
      description="Укажите почту. Если адрес зарегистрирован, мы отправим ссылку для нового пароля."
    />
    <ForgotPasswordForm :loading="loading" />
    <p class="flex h-[46px] items-center justify-center text-center text-sm text-secondary">
      <span
        >Вспомнили пароль?
        <RouterLink :to="{ name: 'login' }" class="font-medium text-link hover:underline"
          >Войти</RouterLink
        ></span
      >
    </p>
  </UiCard>
</template>
