<script setup lang="ts">
/**
 * Повторное письмо подтверждения почты (ADR 0058). Подтверждение мягкое, поэтому кнопка ничего не
 * блокирует: сервер ограничивает письма тремя в час на пользователя, и после предела кнопка
 * показывает обратный отсчёт. Если почта на сервере не настроена, это сообщается спокойно.
 */
import { ref } from 'vue'
import { isApiError } from '@/shared/api'
import { formatWait, useRetryAfter } from '@/shared/lib'
import { UiButton } from '@/shared/ui'
import { resendEmailVerification } from '@/entities/session'

withDefaults(defineProps<{ variant?: 'primary' | 'secondary' | 'ghost'; size?: 'md' | 'sm' }>(), {
  variant: 'secondary',
  size: 'md',
})

const emit = defineEmits<{ sent: [] }>()

const retry = useRetryAfter('lidradar.email-verification.retryUntil')
const pending = ref(false)
const outcome = ref<'idle' | 'sent' | 'unavailable' | 'failed'>('idle')

async function onClick(): Promise<void> {
  if (pending.value || retry.active.value) return
  pending.value = true
  outcome.value = 'idle'
  try {
    await resendEmailVerification()
    outcome.value = 'sent'
    emit('sent')
  } catch (error) {
    if (isApiError(error) && error.isRateLimited) retry.start(error.retryAfterSeconds ?? 60)
    else if (isApiError(error) && error.code === 'MAIL_UNAVAILABLE') outcome.value = 'unavailable'
    else outcome.value = 'failed'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-start gap-1">
    <UiButton
      :variant="variant"
      :size="size"
      :loading="pending"
      :disabled="retry.active.value"
      @click="onClick"
    >
      {{
        retry.active.value
          ? `Повторить через ${formatWait(retry.secondsLeft.value)}`
          : 'Отправить письмо ещё раз'
      }}
    </UiButton>
    <p v-if="outcome === 'sent'" class="text-xs text-muted" role="status">
      Письмо отправлено. Проверьте почту, включая папку «Спам».
    </p>
    <p v-else-if="outcome === 'unavailable'" class="text-xs text-muted" role="status">
      Отправка писем сейчас недоступна. Попробуйте позже.
    </p>
    <p v-else-if="outcome === 'failed'" class="text-xs text-danger" role="alert">
      Не удалось отправить письмо. Повторите позже.
    </p>
    <p v-else-if="retry.active.value" class="text-xs text-muted" role="status">
      Письма ограничены: не больше трёх в час.
    </p>
  </div>
</template>
