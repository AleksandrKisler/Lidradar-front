<script setup lang="ts">
/**
 * Напоминание о назначенном закрытии аккаунта (ADR 0059). Закрытие не ограничивает работу, но необратимо
 * после срока, поэтому напоминание нельзя скрыть: оно исчезает, только когда запрос отменён. Кнопка
 * отмены есть сразу в баннере.
 */
import { computed, ref } from 'vue'
import { describeError } from '@/shared/api'
import { UiButton } from '@/shared/ui'
import { cancelAccountDeletion, useSessionStore } from '@/entities/session'
import { formatDueDate } from '../model/deletion-copy'

const session = useSessionStore()
const cancelling = ref(false)
const failure = ref<unknown>(null)
const dueText = computed(() => formatDueDate(session.deletionDueAt))

async function cancel(): Promise<void> {
  cancelling.value = true
  failure.value = null
  try {
    await cancelAccountDeletion()
    await session.refresh()
  } catch (error) {
    failure.value = error
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <div
    v-if="session.deletionDueAt"
    class="border-b border-danger/30 bg-danger-pale px-5 py-3 text-sm text-ink md:px-12"
    role="region"
    aria-label="Удаление аккаунта"
    data-testid="account-deletion-banner"
  >
    <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <p class="min-w-0">
        Аккаунт будет удалён <strong>{{ dueText }}</strong
        >. До этого времени всё работает как обычно.
      </p>
      <UiButton
        variant="secondary"
        size="sm"
        :loading="cancelling"
        data-testid="account-deletion-banner-cancel"
        @click="cancel"
      >
        Отменить удаление
      </UiButton>
    </div>
    <p
      v-if="failure"
      class="mt-2 text-danger"
      role="alert"
      data-testid="account-deletion-banner-error"
    >
      {{ describeError(failure).title }}. {{ describeError(failure).description }}
    </p>
  </div>
</template>
