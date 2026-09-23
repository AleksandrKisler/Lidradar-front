<script setup lang="ts">
/** «Взять в работу»: OPEN → ACKNOWLEDGED. Повтор команды идемпотентен на сервере. */
import { computed } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton } from '@/shared/ui'
import { acknowledgeRisk } from '@/entities/risk'
import { useRiskCommand } from '../model/use-risk-command'

const props = defineProps<{ riskId: string; disabled?: boolean | undefined }>()
const emit = defineEmits<{ done: [] }>()

const command = useRiskCommand(() => props.riskId, acknowledgeRisk)
const errorView = computed(() => (command.error.value ? describeError(command.error.value) : null))
const traceId = computed(() => (isApiError(command.error.value) ? command.error.value.traceId : ''))

async function onClick(): Promise<void> {
  const result = await command.execute()
  if (result) emit('done')
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <UiButton block :disabled="disabled" :loading="command.isPending.value" @click="onClick">
      Взять в работу
    </UiButton>
    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>
  </div>
</template>
