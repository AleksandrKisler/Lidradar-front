<script setup lang="ts">
/**
 * Перевод сделки на следующий этап: только разрешённые цели, закрывающие
 * переходы — через подтверждение. Синхронный замок исключает двойную отправку.
 */
import { computed, ref, watch } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiDialog, UiField, UiSelect, type UiSelectOption } from '@/shared/ui'
import {
  allowedNextStages,
  describeClosingStage,
  isClosingStage,
  opportunityStageLabel,
  type OpportunityStage,
} from '@/entities/risk'
import { useChangeStage } from '../model/use-change-stage'

const props = defineProps<{
  riskId: string
  opportunityId: string
  currentStage: OpportunityStage
}>()
const emit = defineEmits<{ changed: [stage: OpportunityStage] }>()

const change = useChangeStage(
  () => props.riskId,
  () => props.opportunityId,
)
const target = ref<OpportunityStage | ''>('')
const confirmOpen = ref(false)

const options = computed<UiSelectOption[]>(() =>
  allowedNextStages(props.currentStage).map((stage) => ({
    value: stage,
    label: opportunityStageLabel(stage),
  })),
)
// Этап изменился (в том числе после конфликта): прежний выбор больше не действителен.
watch(
  () => props.currentStage,
  () => {
    target.value = ''
  },
)

const conflict = computed(
  () => isApiError(change.error.value) && change.error.value.httpStatus === 409,
)
const errorView = computed(() => {
  if (!change.error.value) return null
  if (conflict.value) {
    return {
      title: 'Этап уже изменился',
      description: 'Сделку перевели раньше — список доступных этапов обновлён по данным сервера.',
    }
  }
  return describeError(change.error.value)
})
const traceId = computed(() => (isApiError(change.error.value) ? change.error.value.traceId : ''))

let inFlight = false
async function submit(): Promise<void> {
  const stage = target.value
  if (!stage || inFlight) return
  inFlight = true
  try {
    await change.mutateAsync(stage)
    confirmOpen.value = false
    target.value = ''
    emit('changed', stage)
  } catch {
    confirmOpen.value = false
  } finally {
    inFlight = false
  }
}

function start(): void {
  if (!target.value) return
  change.reset()
  if (isClosingStage(target.value)) confirmOpen.value = true
  else void submit()
}
</script>

<template>
  <div v-if="options.length" class="flex flex-col gap-3">
    <div class="flex flex-wrap items-end gap-3">
      <UiField v-slot="{ id, describedBy, invalid }" label="Перевести на этап" class="w-64">
        <UiSelect
          :id="id"
          v-model="target"
          name="nextStage"
          placeholder="Выберите этап"
          :options="options"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="change.isPending.value"
        />
      </UiField>
      <UiButton :disabled="!target" :loading="change.isPending.value" @click="start">
        Перевести
      </UiButton>
    </div>
    <UiAlert
      v-if="errorView && !confirmOpen"
      :tone="conflict ? 'warning' : 'danger'"
      :title="errorView.title"
      :trace-id="traceId"
    >
      {{ errorView.description }}
    </UiAlert>
    <UiDialog
      v-model:open="confirmOpen"
      :title="target ? `Перевести сделку в «${opportunityStageLabel(target)}»?` : ''"
      :description="target ? describeClosingStage(target) : ''"
      :dismissible="!change.isPending.value"
    >
      <p class="text-sm text-muted">
        Сейчас: {{ opportunityStageLabel(currentStage) }}. Переход записывается в историю этапов как
        ручной.
      </p>
      <template #footer>
        <UiButton
          variant="secondary"
          :disabled="change.isPending.value"
          @click="confirmOpen = false"
        >
          Отмена
        </UiButton>
        <UiButton
          :variant="target === 'LOST' ? 'danger' : 'primary'"
          :loading="change.isPending.value"
          @click="submit"
        >
          Перевести
        </UiButton>
      </template>
    </UiDialog>
  </div>
  <p v-else class="text-sm text-muted">Переходов с этого этапа нет.</p>
</template>
