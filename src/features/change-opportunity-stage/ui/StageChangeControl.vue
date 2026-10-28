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
/** Почему выбор сброшен без действий пользователя: сделку перевели, список переходов обновлён. */
const resetNotice = ref<string | null>(null)
/** Синхронный замок отправки: исключает двойной клик и отличает собственный перевод от чужого. */
let inFlight = false
/** Номер сделки в этом экземпляре: ответ по прежней сделке не должен менять состояние новой. */
let generation = 0

const options = computed<UiSelectOption[]>(() =>
  allowedNextStages(props.currentStage).map((stage) => ({
    value: stage,
    label: opportunityStageLabel(stage),
  })),
)
// Этап изменился (в том числе после конфликта): прежний выбор больше не действителен.
// Фоновое перечитывание при том же этапе значение не трогает: сброс только по смене этапа.
// Пока идёт собственная отправка, приход нового этапа — её результат, а не чужое изменение.
watch(
  () => props.currentStage,
  (stage, previous) => {
    if (stage === previous) return
    const hadChoice = Boolean(target.value) || confirmOpen.value
    target.value = ''
    confirmOpen.value = false
    if (inFlight) return
    if (hadChoice || resetNotice.value) {
      resetNotice.value = `Сделку перевели на этап «${opportunityStageLabel(stage)}»: ваш выбор сброшен, доступные переходы обновлены.`
    }
  },
)
// Другая сделка в том же компоненте: выбор, ошибка и пояснение относились к прежней.
watch(
  () => [props.riskId, props.opportunityId],
  () => {
    generation += 1
    inFlight = false
    target.value = ''
    confirmOpen.value = false
    resetNotice.value = null
    change.reset()
  },
)
watch(target, (value) => {
  if (value) resetNotice.value = null
})

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

async function submit(): Promise<void> {
  const stage = target.value
  if (!stage || inFlight) return
  // Недопустимый для текущего этапа переход не отправляется.
  if (!options.value.some((option) => option.value === stage)) {
    target.value = ''
    resetNotice.value = 'Этот переход сейчас недоступен: выберите этап из обновлённого списка.'
    return
  }
  inFlight = true
  const mine = generation
  try {
    await change.mutateAsync(stage)
    if (mine !== generation) return
    confirmOpen.value = false
    target.value = ''
    emit('changed', stage)
  } catch {
    if (mine === generation) confirmOpen.value = false
  } finally {
    if (mine === generation) inFlight = false
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
  <div v-if="options.length" class="flex flex-col gap-4">
    <UiField v-slot="{ id, describedBy, invalid }" label="Новый этап" label-style="compact">
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
    <UiButton
      block
      :variant="target ? 'primary' : 'secondary'"
      :disabled="!target"
      :loading="change.isPending.value"
      @click="start"
    >
      Изменить этап
    </UiButton>
    <UiAlert v-if="resetNotice && !errorView" tone="info">{{ resetNotice }}</UiAlert>
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
          Изменить этап
        </UiButton>
      </template>
    </UiDialog>
  </div>
  <p v-else class="text-sm text-muted">Переходов с этого этапа нет.</p>
</template>
