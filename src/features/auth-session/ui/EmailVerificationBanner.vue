<script setup lang="ts">
/**
 * Напоминание о неподтверждённой почте (ADR 0058). Подтверждение мягкое: напоминание ничего не
 * блокирует, его можно скрыть на время сессии браузера. Баннер показывается только по явному
 * признаку «не подтверждена» (`emailVerifiedAt: null`): отсутствие поля не считается неподтверждением.
 */
import { computed, ref } from 'vue'
import { useSessionStore } from '@/entities/session'
import { dismissReminder, isReminderDismissed } from '../model/verification-reminder'
import ResendVerificationButton from './ResendVerificationButton.vue'

const session = useSessionStore()
const userId = computed(() => session.user?.id ?? '')
const dismissed = ref(isReminderDismissed(userId.value))
const visible = computed(() => session.emailUnverified && !dismissed.value)

function dismiss(): void {
  dismissed.value = true
  dismissReminder(userId.value)
}
</script>

<template>
  <div
    v-if="visible"
    class="border-b border-warning/30 bg-warning-pale px-5 py-3 text-sm text-ink md:px-12"
    role="region"
    aria-label="Подтверждение почты"
    data-testid="email-verification-banner"
  >
    <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <p class="min-w-0">
        Подтвердите адрес почты <strong class="break-all">{{ session.user?.email }}</strong
        >: мы отправили письмо со ссылкой. Пока можно работать как обычно.
      </p>
      <div class="flex shrink-0 flex-wrap items-center gap-3">
        <ResendVerificationButton size="sm" />
        <button
          type="button"
          class="rounded-field px-2 py-1 text-sm font-semibold text-muted hover:text-ink"
          @click="dismiss"
        >
          Скрыть
        </button>
      </div>
    </div>
  </div>
</template>
