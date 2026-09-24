<script setup lang="ts">
/**
 * Отключение источника с подтверждением. Список перечитывается после любого
 * ответа: при `503` локальное состояние уже `DISCONNECTED`, но удаление
 * вебхука у провайдера не подтверждено — об этом предупреждаем, а не
 * возвращаем подключение в активные.
 */
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiDialog } from '@/shared/ui'
import { organizationKeys } from '@/entities/organization'
import {
  disconnectChannel,
  integrationKeys,
  providerLabel,
  type ChannelConnection,
} from '@/entities/integration'

const props = defineProps<{ tenantId: string; connection: ChannelConnection }>()
const emit = defineEmits<{ done: [unverified: boolean] }>()

const queryClient = useQueryClient()
const confirmOpen = ref(false)
const unverified = ref(false)

async function refresh(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: integrationKeys.list(props.tenantId) }),
    queryClient.invalidateQueries({ queryKey: organizationKeys.onboarding(props.tenantId) }),
  ])
}

const mutation = useMutation({
  mutationFn: () => disconnectChannel(props.tenantId, props.connection.id),
})

const errorView = computed(() => {
  const error = mutation.error.value
  if (!error || (isApiError(error) && error.httpStatus === 503)) return null
  return describeError(error)
})
const traceId = computed(() =>
  isApiError(mutation.error.value) ? mutation.error.value.traceId : '',
)

async function disconnect(): Promise<void> {
  unverified.value = false
  try {
    await mutation.mutateAsync()
    confirmOpen.value = false
    await refresh()
    emit('done', false)
  } catch (error) {
    if (isApiError(error) && error.httpStatus === 503) {
      unverified.value = true
      confirmOpen.value = false
      await refresh()
      emit('done', true)
    }
  }
}
</script>

<template>
  <div class="flex flex-col items-end gap-2">
    <UiButton
      variant="secondary"
      size="sm"
      :disabled="mutation.isPending.value"
      @click="confirmOpen = true"
    >
      Отключить
    </UiButton>
    <UiAlert v-if="unverified" tone="warning" title="Отключено локально">
      Удаление вебхука у провайдера не подтверждено. Проверьте связь позже: сообщения в LidRadar уже
      не поступают.
    </UiAlert>
    <UiDialog
      v-model:open="confirmOpen"
      title="Отключить источник?"
      :description="`${connection.name} · ${providerLabel(connection.provider)}. Сохранённые диалоги и риски останутся, новые сообщения перестанут поступать.`"
      :dismissible="!mutation.isPending.value"
    >
      <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
        {{ errorView.description }}
      </UiAlert>
      <template #footer>
        <UiButton
          variant="secondary"
          :disabled="mutation.isPending.value"
          @click="confirmOpen = false"
        >
          Отмена
        </UiButton>
        <UiButton variant="danger" :loading="mutation.isPending.value" @click="disconnect">
          Отключить
        </UiButton>
      </template>
    </UiDialog>
  </div>
</template>
