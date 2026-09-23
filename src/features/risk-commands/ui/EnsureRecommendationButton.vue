<script setup lang="ts">
/** Запрашивает шаблонную рекомендацию, если владеющий модуль её ещё не создал. */
import { computed } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton } from '@/shared/ui'
import { ensureRecommendation } from '@/entities/risk'
import { useRiskCommand } from '../model/use-risk-command'

const props = defineProps<{ riskId: string }>()
const emit = defineEmits<{ done: [] }>()

const command = useRiskCommand(() => props.riskId, ensureRecommendation)
const errorView = computed(() => (command.error.value ? describeError(command.error.value) : null))
const traceId = computed(() => (isApiError(command.error.value) ? command.error.value.traceId : ''))

async function onClick(): Promise<void> {
  const result = await command.execute()
  if (result) emit('done')
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <UiButton variant="secondary" size="sm" :loading="command.isPending.value" @click="onClick">
      Получить рекомендацию
    </UiButton>
    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>
  </div>
</template>
