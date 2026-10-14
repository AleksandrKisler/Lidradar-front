<script setup lang="ts">
/**
 * Закрытие аккаунта (ADR 0059). Запрос подтверждается паролем и назначает обезличивание через 30 суток;
 * до срока вход и работа не ограничены, запрос можно отменить. Единственного владельца организации и
 * администратора платформы сервер не закрывает: причины показываются в окне вместо общей ошибки.
 */
import { computed, ref } from 'vue'
import { describeError } from '@/shared/api'
import { UiAlert, UiButton, UiCard } from '@/shared/ui'
import {
  cancelAccountDeletion,
  deletionBlockers,
  requestAccountDeletion,
  useSessionStore,
} from '@/entities/session'
import { DELETION_GRACE_DAYS, blockerLines, formatDueDate } from '../model/deletion-copy'
import type { FailureView } from '../model/failure-view'
import PasswordConfirmDialog from './PasswordConfirmDialog.vue'

const session = useSessionStore()
const open = ref(false)
const cancelling = ref(false)
const cancelError = ref<unknown>(null)
const dueText = computed(() => formatDueDate(session.deletionDueAt))

async function request(password: string): Promise<void> {
  await requestAccountDeletion({ password })
  await session.refresh()
}

/** Причины блокировки вместо общей ошибки: пользователю нужно знать, что именно сделать. */
function explain(error: unknown): FailureView | null {
  const blockers = deletionBlockers(error)
  if (blockers.length === 0) return null
  return {
    tone: 'warning',
    title: 'Аккаунт пока нельзя удалить',
    text: 'Сначала снимите причины, перечисленные ниже, и запросите удаление снова.',
    lines: blockerLines(blockers).map((line) => line.text),
  }
}

async function cancel(): Promise<void> {
  cancelling.value = true
  cancelError.value = null
  try {
    await cancelAccountDeletion()
    await session.refresh()
  } catch (error) {
    cancelError.value = error
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <UiCard as="section" aria-labelledby="delete-account-title">
    <h2 id="delete-account-title" class="text-lg font-bold text-ink">Удаление аккаунта</h2>

    <template v-if="session.deletionDueAt">
      <UiAlert
        class="mt-4"
        tone="warning"
        title="Удаление назначено"
        data-testid="deletion-scheduled"
      >
        Аккаунт будет обезличен {{ dueText }}. До этого времени всё работает как обычно. Если
        передумаете, отмените удаление.
      </UiAlert>
      <UiAlert
        v-if="cancelError"
        class="mt-4"
        tone="danger"
        :title="describeError(cancelError).title"
        data-testid="deletion-cancel-error"
      >
        {{ describeError(cancelError).description }}
      </UiAlert>
      <div class="mt-5">
        <UiButton
          variant="secondary"
          :loading="cancelling"
          data-testid="deletion-cancel"
          @click="cancel"
        >
          Отменить удаление
        </UiButton>
      </div>
    </template>

    <template v-else>
      <p class="mt-1 text-sm text-muted">
        Через {{ DELETION_GRACE_DAYS }} суток после запроса мы обезличим аккаунт.
      </p>
      <ul class="mt-4 flex flex-col gap-2 text-sm text-ink">
        <li>
          Адрес почты и имя будут заменены, пароль перестанет подходить, сессии, настройки
          уведомлений и привязка Telegram удалятся.
        </li>
        <li>
          Записи, которые вы вносили в организациях, останутся там без привязки к вашему имени.
        </li>
        <li>До срока вход и работа не ограничены, запрос можно отменить.</li>
        <li>
          Единственный владелец организации сначала передаёт владение другому участнику, иначе
          аккаунт удалить нельзя.
        </li>
      </ul>
      <div class="mt-5">
        <UiButton variant="danger" data-testid="deletion-open" @click="open = true">
          Удалить аккаунт…
        </UiButton>
      </div>
    </template>

    <PasswordConfirmDialog
      v-model:open="open"
      title="Удалить аккаунт?"
      description="Введите пароль, чтобы запросить удаление. Мы отправим письмо с датой и напоминанием, как отменить."
      confirm-label="Запросить удаление"
      tone="danger"
      retry-key="lidradar.account-deletion.retryUntil"
      :action="request"
      :explain="explain"
    />
  </UiCard>
</template>
