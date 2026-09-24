<script setup lang="ts">
/**
 * Отзыв права администратора с подтверждением: строка сохраняется, повтор
 * идемпотентен. Отзыв собственного права закрывает раздел после перечитывания
 * `/admin/me` — об этом предупреждаем заранее.
 */
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiDialog } from '@/shared/ui'
import { adminKeys, revokePlatformAdmin, type PlatformAdmin } from '@/entities/admin'

const props = defineProps<{ admin: PlatformAdmin; currentUserId: string }>()
const emit = defineEmits<{ revoked: [admin: PlatformAdmin] }>()

const queryClient = useQueryClient()
const open = ref(false)
const self = computed(() => props.admin.userId === props.currentUserId)
const identity = computed(() => props.admin.email ?? props.admin.displayName ?? props.admin.userId)

const revoke = useMutation({
  mutationFn: () => revokePlatformAdmin(props.admin.userId),
  onSettled: async () => {
    await queryClient.invalidateQueries({ queryKey: adminKeys.admins() })
    if (self.value) await queryClient.invalidateQueries({ queryKey: adminKeys.me() })
  },
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
  emit('revoked', props.admin)
}
</script>

<template>
  <UiButton variant="secondary" size="sm" @click="start">Отозвать</UiButton>
  <UiDialog
    v-model:open="open"
    title="Отозвать право администратора?"
    :description="`${identity} потеряет доступ к разделу администрирования. Запись о выдаче и отзыве останется в аудите.`"
    :dismissible="!revoke.isPending.value"
  >
    <p v-if="self" class="text-sm font-semibold text-danger">
      Вы отзываете собственное право: раздел закроется сразу после подтверждения.
    </p>
    <p class="text-xs text-muted break-all">Пользователь {{ admin.userId }}</p>
    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>
    <template #footer>
      <UiButton variant="secondary" :disabled="revoke.isPending.value" @click="open = false">
        Отмена
      </UiButton>
      <UiButton variant="danger" :loading="revoke.isPending.value" @click="confirm"
        >Отозвать</UiButton
      >
    </template>
  </UiDialog>
</template>
