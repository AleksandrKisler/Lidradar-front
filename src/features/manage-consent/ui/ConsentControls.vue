<script setup lang="ts">
/**
 * Выдача и отзыв ML-согласия владельцем с явным подтверждением. Текст не
 * обещает удаление истории или уже сформированных наборов: отзыв действует на
 * будущее, история выдач хранится в аудите. После любого ответа состояние
 * перечитывается; `403` означает потерю права — сессия перечитывается тоже.
 */
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiDialog } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { consentKeys, grantConsent, revokeConsent, type MLConsentStatus } from '@/entities/consent'

const props = defineProps<{ tenantId: string; status: MLConsentStatus }>()
const emit = defineEmits<{ changed: [status: MLConsentStatus | null] }>()

const session = useSessionStore()
const queryClient = useQueryClient()
const dialog = ref<'grant' | 'revoke' | null>(null)
const notice = ref<string | null>(null)

async function settle(error: unknown): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: consentKeys.status(props.tenantId) })
  // Право могли отозвать параллельно: интерфейс должен перестать предлагать команду.
  if (isApiError(error) && error.httpStatus === 403) await session.refresh()
}

const grant = useMutation({
  mutationFn: () => grantConsent(props.tenantId),
  onSettled: (_data, error) => settle(error),
})
const revoke = useMutation({
  mutationFn: () => revokeConsent(props.tenantId),
  onSettled: (_data, error) => settle(error),
})

const pending = computed(() => grant.isPending.value || revoke.isPending.value)
const error = computed(() => grant.error.value ?? revoke.error.value)
const errorView = computed(() => (error.value ? describeError(error.value) : null))
const traceId = computed(() => (isApiError(error.value) ? error.value.traceId : ''))

function open(kind: 'grant' | 'revoke'): void {
  grant.reset()
  revoke.reset()
  notice.value = null
  dialog.value = kind
}

async function confirmGrant(): Promise<void> {
  const result = await grant.mutateAsync().catch(() => null)
  if (!result) return
  dialog.value = null
  notice.value = result.alreadyActive
    ? 'Согласие уже действовало: повторная выдача ничего не изменила.'
    : 'Согласие выдано. Новые переписки и вердикты могут включаться в наборы данных.'
  emit('changed', result.status)
}

async function confirmRevoke(): Promise<void> {
  const ok = await revoke
    .mutateAsync()
    .then(() => true)
    .catch(() => false)
  if (!ok) return
  dialog.value = null
  notice.value =
    'Согласие отозвано. Новые данные в наборы не включаются; история выдач сохранена в аудите.'
  emit('changed', null)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap gap-3">
      <UiButton v-if="!status.active" :disabled="pending" @click="open('grant')">
        Дать согласие
      </UiButton>
      <UiButton v-else variant="secondary" :disabled="pending" @click="open('revoke')">
        Отозвать согласие
      </UiButton>
    </div>
    <UiAlert v-if="notice" tone="success">{{ notice }}</UiAlert>
    <UiAlert
      v-if="errorView && dialog === null"
      tone="danger"
      :title="errorView.title"
      :trace-id="traceId"
    >
      {{ errorView.description }}
    </UiAlert>

    <UiDialog
      :open="dialog === 'grant'"
      title="Дать согласие на использование данных?"
      description="Реальные переписки организации и вердикты команды по рискам смогут включаться в наборы данных для обучения и оценки моделей. Согласие добровольное, его можно отозвать в любой момент."
      :dismissible="!pending"
      @update:open="(value) => (dialog = value ? 'grant' : null)"
    >
      <p class="text-sm text-muted">
        Выдача записывается в аудит с вашим именем и временем. Работа сервиса от согласия не
        зависит: без него данные используются только для поиска рисков.
      </p>
      <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
        {{ errorView.description }}
      </UiAlert>
      <template #footer>
        <UiButton variant="secondary" :disabled="pending" @click="dialog = null">Отмена</UiButton>
        <UiButton :loading="grant.isPending.value" @click="confirmGrant">Дать согласие</UiButton>
      </template>
    </UiDialog>

    <UiDialog
      :open="dialog === 'revoke'"
      title="Отозвать согласие?"
      description="Новые переписки и вердикты перестанут включаться в наборы данных. Отзыв действует на будущее: история выдач остаётся в аудите, а у уже записанных вердиктов сохраняется признак согласия на момент записи."
      :dismissible="!pending"
      @update:open="(value) => (dialog = value ? 'revoke' : null)"
    >
      <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
        {{ errorView.description }}
      </UiAlert>
      <template #footer>
        <UiButton variant="secondary" :disabled="pending" @click="dialog = null">Отмена</UiButton>
        <UiButton variant="danger" :loading="revoke.isPending.value" @click="confirmRevoke">
          Отозвать
        </UiButton>
      </template>
    </UiDialog>
  </div>
</template>
