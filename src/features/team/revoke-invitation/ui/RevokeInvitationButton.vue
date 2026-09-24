<script setup lang="ts">
/**
 * Отзыв ожидающего приглашения с подтверждением. Принятое приглашение
 * отозвать нельзя (`409 INVITATION_USED`) — список перечитывается после
 * любого ответа, чтобы показать действительное состояние.
 */
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiDialog } from '@/shared/ui'
import { roleLabel } from '@/entities/session'
import { revokeInvitation, teamKeys, type Invitation } from '@/entities/team'

const props = defineProps<{ tenantId: string; invitation: Invitation }>()
const emit = defineEmits<{ revoked: [invitation: Invitation] }>()

const queryClient = useQueryClient()
const open = ref(false)
const revoke = useMutation({
  mutationFn: () => revokeInvitation(props.tenantId, props.invitation.id),
  onSettled: () =>
    queryClient.invalidateQueries({ queryKey: teamKeys.invitations(props.tenantId) }),
})
const errorView = computed(() => (revoke.error.value ? describeError(revoke.error.value) : null))
const traceId = computed(() => (isApiError(revoke.error.value) ? revoke.error.value.traceId : ''))

function start(): void {
  revoke.reset()
  open.value = true
}

async function confirm(): Promise<void> {
  const ok = await revoke
    .mutateAsync()
    .then(() => true)
    .catch(() => false)
  if (!ok) return
  open.value = false
  emit('revoked', props.invitation)
}
</script>

<template>
  <UiButton variant="secondary" size="sm" @click="start">Отозвать</UiButton>
  <UiDialog
    v-model:open="open"
    title="Отозвать приглашение?"
    :description="`Код для роли «${roleLabel(invitation.role)}» перестанет действовать. Тот, кому вы его передали, не сможет присоединиться.`"
    :dismissible="!revoke.isPending.value"
  >
    <p v-if="invitation.note" class="text-sm text-muted">Заметка: {{ invitation.note }}</p>
    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>
    <template #footer>
      <UiButton variant="secondary" :disabled="revoke.isPending.value" @click="open = false">
        Отмена
      </UiButton>
      <UiButton variant="danger" :loading="revoke.isPending.value" @click="confirm">
        Отозвать
      </UiButton>
    </template>
  </UiDialog>
</template>
