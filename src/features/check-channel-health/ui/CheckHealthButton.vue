<script setup lang="ts">
/**
 * «Проверить связь»: живой опрос провайдера. Результат различает `REMOTE`
 * (провайдер опрошен, состояние сохранено) и `LOCAL` (удалённой регистрации
 * нет — показано сохранённое состояние); после проверки перечитываются
 * список и здоровье подключения.
 */
import { computed } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { describeError, isApiError } from '@/shared/api'
import { formatDateTime } from '@/shared/lib'
import { UiAlert, UiButton } from '@/shared/ui'
import {
  checkConnectionHealth,
  connectionErrorLabel,
  connectionStatusView,
  type ConnectorProvider,
  integrationKeys,
  verificationLabel,
} from '@/entities/integration'

const props = defineProps<{
  tenantId: string
  connectionId: string
  provider: ConnectorProvider
  timeZone: string
}>()

const queryClient = useQueryClient()
const mutation = useMutation({
  mutationFn: () => checkConnectionHealth(props.tenantId, props.connectionId),
  onSuccess: async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: integrationKeys.list(props.tenantId) }),
      queryClient.invalidateQueries({
        queryKey: integrationKeys.health(props.tenantId, props.connectionId),
      }),
    ])
  },
})

const result = computed(() => mutation.data.value ?? null)
const errorView = computed(() =>
  mutation.error.value ? describeError(mutation.error.value) : null,
)
const traceId = computed(() =>
  isApiError(mutation.error.value) ? mutation.error.value.traceId : '',
)
</script>

<template>
  <div class="flex flex-col items-end gap-2">
    <UiButton
      variant="secondary"
      size="sm"
      :loading="mutation.isPending.value"
      @click="mutation.mutate()"
    >
      {{ provider === 'GENERIC_WEBHOOK' ? 'Обновить статус' : 'Проверить связь' }}
    </UiButton>
    <p v-if="result" class="max-w-sm text-right text-xs text-muted" role="status">
      {{ connectionStatusView(provider, result.health).label }} ·
      {{ verificationLabel(result.verification) }} ·
      {{ formatDateTime(result.health.checkedAt, timeZone) }}
      <template v-if="result.health.lastErrorCode">
        · {{ connectionErrorLabel(result.health.lastErrorCode) }}
      </template>
    </p>
    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>
  </div>
</template>
