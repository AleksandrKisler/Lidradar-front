<script setup lang="ts">
/**
 * Панель вердикта в рабочем пространстве.
 *
 * «Риск подтвердился» записывается сразу. «Ложное срабатывание» требует
 * причину и предупреждает о последствиях: активный риск закроется и уйдёт из
 * Radar, а причина «это не клиент» дополнительно закроет сделку как потерянную,
 * поэтому для активного риска запись идёт через подтверждение. Каскады
 * выполняет сервер; после ответа карточка перечитывается. Результат показывает,
 * попадёт ли запись в набор для обучения — по согласию организации на момент
 * записи.
 */
import { RouterLink } from 'vue-router'
import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import {
  UiAlert,
  UiButton,
  UiDialog,
  UiField,
  UiSelect,
  UiTextarea,
  type UiSelectOption,
} from '@/shared/ui'
import {
  FEEDBACK_REASONS,
  RISK_VERDICTS,
  feedbackReasonLabel,
  verdictLabel,
  type RiskFeedback,
  type RiskFeedbackReason,
  type RiskFeedbackRequest,
  type RiskVerdict,
} from '@/entities/risk'
import { FEEDBACK_NOTE_MAX_LENGTH, riskFeedbackSchema } from '../model/schema'
import { useRiskFeedback } from '../model/use-risk-feedback'

const props = defineProps<{ riskId: string; isActive: boolean }>()
const emit = defineEmits<{ recorded: [feedback: RiskFeedback] }>()

const feedback = useRiskFeedback(() => props.riskId)
const confirmOpen = ref(false)

const verdictHints: Record<RiskVerdict, string> = {
  TRUE_POSITIVE: 'Radar верно заметил ситуацию, даже если её уже решили.',
  FALSE_POSITIVE: 'Риска на самом деле не было: сигнал сработал зря.',
}
const reasonOptions: UiSelectOption[] = FEEDBACK_REASONS.map((value) => ({
  value,
  label: feedbackReasonLabel(value),
}))

const { defineField, handleSubmit, errors, resetForm, values } = useForm({
  validationSchema: toTypedSchema(riskFeedbackSchema),
  initialValues: { verdict: '', reason: '', note: '' },
})
const [verdict] = defineField('verdict')
const [reason] = defineField('reason')
const [note] = defineField('note')

const falsePositive = computed(() => values.verdict === 'FALSE_POSITIVE')
const closesRisk = computed(() => falsePositive.value && props.isActive)
const losesOpportunity = computed(() => falsePositive.value && values.reason === 'NOT_A_LEAD')

const submitLabel = computed(() =>
  closesRisk.value ? 'Записать и закрыть риск' : 'Записать оценку',
)

const errorView = computed(() =>
  feedback.error.value ? describeError(feedback.error.value) : null,
)
const traceId = computed(() =>
  isApiError(feedback.error.value) ? feedback.error.value.traceId : '',
)

/** Последняя записанная оценка; до перезагрузки страницы форма скрыта. */
const recorded = computed(() => feedback.result.value ?? null)

function bodyFrom(formValues: {
  verdict: string
  reason: string
  note: string
}): RiskFeedbackRequest {
  const body: RiskFeedbackRequest = { verdict: formValues.verdict as RiskVerdict }
  if (body.verdict === 'FALSE_POSITIVE') body.reason = formValues.reason as RiskFeedbackReason
  if (formValues.note) body.note = formValues.note
  return body
}

async function send(body: RiskFeedbackRequest): Promise<void> {
  const result = await feedback.submit(body)
  if (result) {
    confirmOpen.value = false
    emit('recorded', result)
  }
}

const onSubmit = handleSubmit(async (formValues) => {
  // Закрытие активного риска необратимо: сначала подтверждение.
  if (closesRisk.value) {
    confirmOpen.value = true
    return
  }
  await send(bodyFrom(formValues))
})

async function confirmClose(): Promise<void> {
  await send(
    bodyFrom({
      verdict: values.verdict ?? '',
      reason: values.reason ?? '',
      note: values.note ?? '',
    }),
  )
}

function editAgain(): void {
  feedback.reset()
  resetForm({ values: { verdict: '', reason: '', note: '' } })
}
</script>

<template>
  <div v-if="recorded" class="flex flex-col gap-3" role="status">
    <UiAlert tone="success" title="Оценка записана">
      {{ verdictLabel(recorded.verdict)
      }}<template v-if="recorded.reason"> · {{ feedbackReasonLabel(recorded.reason) }}</template
      >.
      <span class="mt-1 block text-xs">
        <template v-if="recorded.datasetEligible">
          Запись войдёт в набор для обучения: согласие организации действует.
        </template>
        <template v-else>
          Запись не войдёт в набор для обучения: согласие организации не дано.
          <RouterLink
            :to="{ name: 'settings-privacy' }"
            class="font-semibold text-brand-dark hover:underline"
          >
            О согласии
          </RouterLink>
        </template>
      </span>
    </UiAlert>
    <UiButton variant="ghost" size="sm" @click="editAgain">Оценить ещё раз</UiButton>
  </div>

  <form v-else class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
    <fieldset class="flex flex-col gap-2">
      <legend class="mb-2 text-sm font-semibold text-ink">Что было на самом деле</legend>
      <label
        v-for="value in RISK_VERDICTS"
        :key="value"
        :class="[
          'flex cursor-pointer gap-3 rounded-control border px-4 py-3',
          values.verdict === value ? 'border-brand ring-1 ring-brand' : 'border-line',
        ]"
      >
        <input
          v-model="verdict"
          type="radio"
          name="verdict"
          :value="value"
          class="mt-1 size-4 shrink-0 accent-brand"
          :disabled="feedback.isPending.value"
        />
        <span class="flex flex-col gap-1 text-sm">
          <span class="font-semibold text-ink">{{ verdictLabel(value) }}</span>
          <span class="text-muted">{{ verdictHints[value] }}</span>
        </span>
      </label>
      <p v-if="errors.verdict" class="text-xs text-danger" aria-live="polite">
        {{ errors.verdict }}
      </p>
    </fieldset>

    <UiField
      v-if="falsePositive"
      v-slot="{ id, describedBy, invalid }"
      label="Почему сигнал ложный"
      :error="errors.reason"
    >
      <UiSelect
        :id="id"
        v-model="reason"
        name="feedbackReason"
        :options="reasonOptions"
        placeholder="Выберите причину"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="feedback.isPending.value"
      />
    </UiField>

    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Комментарий"
      description="Необязательно: что поможет точнее настроить правило."
      :error="errors.note"
    >
      <UiTextarea
        :id="id"
        v-model="note"
        name="feedbackNote"
        :rows="2"
        :maxlength="FEEDBACK_NOTE_MAX_LENGTH"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="feedback.isPending.value"
      />
    </UiField>

    <UiAlert v-if="closesRisk" tone="warning" title="Риск закроется">
      Активный риск получит статус «ложное срабатывание» и уйдёт из ленты Radar. История сохранится.
      <template v-if="losesOpportunity">
        Сделка по этому обращению будет закрыта как потерянная: клиент не был лидом.
      </template>
    </UiAlert>
    <UiAlert v-else-if="losesOpportunity" tone="warning" title="Сделка закроется">
      Причина «это не клиент» закроет сделку по этому обращению как потерянную.
    </UiAlert>

    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>

    <!-- Вариант кнопки не меняется от выбора: смена цвета в переходе мешает
         проверкам контраста, а о последствиях предупреждают текст и диалог. -->
    <UiButton type="submit" block :loading="feedback.isPending.value">
      {{ submitLabel }}
    </UiButton>

    <UiDialog
      v-model:open="confirmOpen"
      title="Закрыть риск как ложное срабатывание?"
      :description="
        losesOpportunity
          ? 'Риск уйдёт из Radar, а сделка будет закрыта как потерянная. Запись нельзя отменить.'
          : 'Риск уйдёт из Radar. Запись нельзя отменить.'
      "
      :dismissible="!feedback.isPending.value"
    >
      <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
        {{ errorView.description }}
      </UiAlert>
      <template #footer>
        <UiButton
          variant="secondary"
          :disabled="feedback.isPending.value"
          @click="confirmOpen = false"
        >
          Отмена
        </UiButton>
        <UiButton variant="danger" :loading="feedback.isPending.value" @click="confirmClose">
          Закрыть риск
        </UiButton>
      </template>
    </UiDialog>
  </form>
</template>
