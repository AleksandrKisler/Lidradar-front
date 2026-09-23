<script setup lang="ts">
/**
 * «Закрыть риск» — терминальная команда, поэтому запрашивает подтверждение
 * в диалоге. История действий и исходов остаётся доступной для чтения.
 */
import { computed, ref, watch } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiDialog } from '@/shared/ui'
import { resolveRisk } from '@/entities/risk'
import { useRiskCommand } from '../model/use-risk-command'

const props = defineProps<{ riskId: string; disabled?: boolean | undefined }>()
const emit = defineEmits<{ done: [] }>()

const open = ref(false)
const command = useRiskCommand(() => props.riskId, resolveRisk)
const errorView = computed(() => (command.error.value ? describeError(command.error.value) : null))
const traceId = computed(() => (isApiError(command.error.value) ? command.error.value.traceId : ''))

watch(open, (value) => {
  if (value) command.reset()
})

async function confirm(): Promise<void> {
  const result = await command.execute()
  if (result) {
    open.value = false
    emit('done')
  }
}
</script>

<template>
  <div>
    <UiButton variant="secondary" block :disabled="disabled" @click="open = true">
      Закрыть риск
    </UiButton>
    <UiDialog
      v-model:open="open"
      title="Закрыть риск?"
      description="Риск перестанет быть активным и уйдёт из ленты Radar. История действий и исходов сохранится."
    >
      <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
        {{ errorView.description }}
      </UiAlert>
      <template #footer>
        <UiButton variant="secondary" :disabled="command.isPending.value" @click="open = false">
          Отмена
        </UiButton>
        <UiButton :loading="command.isPending.value" @click="confirm">Закрыть риск</UiButton>
      </template>
    </UiDialog>
  </div>
</template>
