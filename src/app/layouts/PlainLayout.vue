<script setup lang="ts">
/**
 * Layout для авторизованного пользователя без выбранной организации:
 * выбор пространства, приглашение и создание организации. Бокового меню нет —
 * данных организации ещё нет. Шапка — `AccountHeader`; `loading` — каркас первой
 * загрузки, когда сессия ещё неизвестна.
 */
import { AccountDeletionBanner } from '@/features/auth-session'
import { AccountHeader } from '@/widgets/account-header'

defineProps<{ loading?: boolean }>()
</script>

<template>
  <div class="min-h-dvh">
    <AccountHeader :loading="loading" />
    <AccountDeletionBanner v-if="!loading" />
    <main id="main" class="mx-auto w-full max-w-[760px] px-4 pt-10 pb-10 md:px-0 md:pt-[129px]">
      <slot><RouterView /></slot>
    </main>
  </div>
</template>
