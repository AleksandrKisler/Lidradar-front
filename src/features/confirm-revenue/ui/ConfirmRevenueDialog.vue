<script setup lang="ts">
/**
 * Диалог «Подтвердить оплату» (макет 13).
 *
 * Создаёт одно неизменяемое событие выручки и одну атрибуцию. Сумма и
 * валюта вводятся явно, связь с риском выбирается из трёх вариантов; для
 * «возвращённой выручки» подставляется цепочка риск → действие → исход из
 * снимка карточки. Ключ идемпотентности создаётся до первого запроса, при
 * неизвестном результате повтор идёт тем же ключом, а пока запрос выполняется,
 * диалог нельзя закрыть. `409 RECOVERED_ALREADY_ATTRIBUTED` предлагает
 * подтвердить оплату как обычную, но не меняет выбор без явного решения.
 */
import { computed, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { formatDateTime, formatMoney, parseAmount } from '@/shared/lib'
import {
  UiAlert,
  UiButton,
  UiDialog,
  UiField,
  UiInput,
  UiSelect,
  type UiSelectOption,
} from '@/shared/ui'
import { CURRENCY_OPTIONS } from '@/entities/organization'
import {
  ATTRIBUTION_TYPES,
  attributionDescription,
  attributionLabel,
  type AttributionType,
  type ConfirmRevenueRequest,
  type RevenueConfirmation,
} from '@/entities/revenue'
import { hasRecoveredEvidence, type RevenueEvidence } from '../model/evidence'
import { confirmRevenueSchema } from '../model/schema'
import { useConfirmRevenue } from '../model/use-confirm-revenue'

const props = defineProps<{ evidence: RevenueEvidence }>()
const emit = defineEmits<{ confirmed: [confirmation: RevenueConfirmation] }>()
const open = defineModel<boolean>('open', { default: false })

const record = useConfirmRevenue(
  () => props.evidence.riskId,
  () => props.evidence.opportunityId,
)

const evidenceComplete = computed(() => hasRecoveredEvidence(props.evidence))

function defaults() {
  return {
    amount: props.evidence.suggestedAmount ?? '',
    currency: props.evidence.currency,
    attributionType: evidenceComplete.value ? 'RECOVERED' : '',
    actionId: props.evidence.actions[0]?.id ?? '',
    confirmed: false,
  }
}

const { defineField, handleSubmit, errors, resetForm, setFieldValue, values } = useForm({
  validationSchema: toTypedSchema(confirmRevenueSchema),
  initialValues: defaults(),
})
const [amount] = defineField('amount')
const [currency] = defineField('currency')
const [attributionType] = defineField('attributionType')
const [actionId] = defineField('actionId')
const [confirmed] = defineField('confirmed')

const currencyOptions = computed<UiSelectOption[]>(() =>
  CURRENCY_OPTIONS.some((option) => option.value === props.evidence.currency)
    ? CURRENCY_OPTIONS
    : [{ value: props.evidence.currency, label: props.evidence.currency }, ...CURRENCY_OPTIONS],
)
const actionOptions = computed<UiSelectOption[]>(() =>
  props.evidence.actions.map((action) => ({
    value: action.id,
    label: `${action.label} · ${formatDateTime(action.createdAt, props.evidence.timeZone)}`,
  })),
)
const selectedAction = computed(
  () => props.evidence.actions.find((action) => action.id === values.actionId) ?? null,
)

const parsedAmount = computed(() => parseAmount(values.amount ?? ''))
const submitLabel = computed(() => {
  const formatted = parsedAmount.value
    ? formatMoney(parsedAmount.value, values.currency ?? '')
    : null
  return formatted ? `Подтвердить ${formatted}` : 'Подтвердить оплату'
})

const alreadyAttributed = computed(
  () =>
    record.status.value === 'error' &&
    isApiError(record.error.value) &&
    record.error.value.code === 'RECOVERED_ALREADY_ATTRIBUTED',
)
const errorView = computed(() => {
  if (record.status.value !== 'error' || !record.error.value || alreadyAttributed.value) return null
  if (isApiError(record.error.value) && record.error.value.code === 'INVALID_ARGUMENT') {
    return {
      title: 'Подтверждение не принято',
      description:
        'Проверьте сумму и связь с риском: действие и исход должны относиться к этой сделке и быть не старше 30 дней.',
    }
  }
  return describeError(record.error.value)
})
const traceId = computed(() => (isApiError(record.error.value) ? record.error.value.traceId : ''))

const success = computed(() => {
  if (record.status.value !== 'success' || !record.result.value) return null
  const { confirmation, replayed } = record.result.value
  return {
    replayed,
    amount: formatMoney(confirmation.revenue.amount, confirmation.revenue.currency) ?? '',
    attribution: attributionLabel(confirmation.attribution.type),
  }
})

/** Тело запроса из проверенных значений: идентификаторы цепочки — только для RECOVERED. */
function bodyFrom(formValues: {
  amount: string
  currency: string
  attributionType: string
  actionId: string
}): ConfirmRevenueRequest {
  const body: ConfirmRevenueRequest = {
    amount: parseAmount(formValues.amount) ?? formValues.amount,
    currency: formValues.currency.toUpperCase(),
    attributionType: formValues.attributionType as AttributionType,
  }
  if (body.attributionType === 'RECOVERED' && props.evidence.outcome) {
    body.riskId = props.evidence.riskId
    body.actionId = formValues.actionId
    body.outcomeId = props.evidence.outcome.id
  }
  return body
}

const onSubmit = handleSubmit(async (formValues) => {
  const result = await record.submit(bodyFrom(formValues))
  if (result) emit('confirmed', result.confirmation)
})

async function retry(): Promise<void> {
  const result = await record.retry()
  if (result) emit('confirmed', result.confirmation)
}

/** Явное решение пользователя после 409: та же оплата как обычная, новым ключом. */
async function confirmAsOrganic(): Promise<void> {
  setFieldValue('attributionType', 'ORGANIC')
  await onSubmit()
}

function finish(): void {
  open.value = false
}

// Закрытие сбрасывает форму и результат, кроме неизвестного исхода: его
// черновик с ключом хранится до повторной попытки или явной отмены.
watch(open, (isOpen) => {
  if (isOpen) {
    if (record.status.value !== 'unknown') {
      record.reset()
      resetForm({ values: defaults() })
    }
    return
  }
  if (record.status.value !== 'unknown') {
    record.reset()
    resetForm({ values: defaults() })
  }
})

// Снимок карточки обновился (записано действие или исход): подсказки формы
// следуют за ним, пока диалог закрыт.
watch(
  () => props.evidence,
  () => {
    if (!open.value && record.status.value !== 'unknown') resetForm({ values: defaults() })
  },
  { deep: true },
)
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Подтвердить оплату"
    description="Укажите деньги, которые действительно получены. Запись сохранится в истории подтверждений."
    size="lg"
    :dismissible="!record.isPending.value"
  >
    <div v-if="success" class="flex flex-col gap-4">
      <UiAlert tone="success" title="Оплата подтверждена">
        {{ success.amount }} · {{ success.attribution }}.
        <template v-if="success.replayed"> Это подтверждение уже было сохранено ранее.</template>
      </UiAlert>
      <div class="flex justify-end">
        <UiButton @click="finish">Готово</UiButton>
      </div>
    </div>

    <form v-else class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
      <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <UiField v-slot="{ id, describedBy, invalid }" label="Сумма оплаты" :error="errors.amount">
          <UiInput
            :id="id"
            v-model="amount"
            name="amount"
            inputmode="decimal"
            placeholder="0,00"
            :described-by="describedBy"
            :invalid="invalid"
            :disabled="record.isPending.value"
          />
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="Валюта" :error="errors.currency">
          <UiSelect
            :id="id"
            v-model="currency"
            name="currency"
            :options="currencyOptions"
            :described-by="describedBy"
            :invalid="invalid"
            :disabled="record.isPending.value"
          />
        </UiField>
      </div>

      <fieldset class="flex flex-col gap-2">
        <legend class="mb-2 text-sm font-semibold text-ink">Связь с работой над риском</legend>
        <label
          v-for="type in ATTRIBUTION_TYPES"
          :key="type"
          :class="[
            'flex cursor-pointer gap-3 rounded-control border px-4 py-3',
            // Выбранная карточка остаётся на белом фоне: серый текст пояснений
            // на бледно-фиолетовом не дотягивает до контраста 4.5:1.
            values.attributionType === type ? 'border-brand ring-1 ring-brand' : 'border-line',
            type === 'RECOVERED' && !evidenceComplete ? 'cursor-not-allowed opacity-70' : '',
          ]"
        >
          <input
            v-model="attributionType"
            type="radio"
            name="attributionType"
            :value="type"
            class="mt-1 size-4 shrink-0 accent-brand"
            :disabled="record.isPending.value || (type === 'RECOVERED' && !evidenceComplete)"
          />
          <span class="flex flex-col gap-1 text-sm">
            <span class="font-semibold text-ink">{{ attributionLabel(type) }}</span>
            <span class="text-muted">{{ attributionDescription(type) }}</span>
            <span
              v-if="type === 'RECOVERED' && evidenceComplete && selectedAction"
              class="text-muted"
            >
              Связь: риск → {{ selectedAction.label.toLowerCase() }} → исход «{{
                evidence.outcome?.label
              }}».
            </span>
            <span v-else-if="type === 'RECOVERED' && !evidenceComplete" class="text-muted">
              Сначала запишите действие и исход по этому риску.
            </span>
          </span>
        </label>
        <p v-if="errors.attributionType" class="text-xs text-danger" aria-live="polite">
          {{ errors.attributionType }}
        </p>
      </fieldset>

      <UiField
        v-if="values.attributionType === 'RECOVERED' && evidence.actions.length > 1"
        v-slot="{ id, describedBy, invalid }"
        label="После какого действия клиент оплатил"
        :error="errors.actionId"
      >
        <UiSelect
          :id="id"
          v-model="actionId"
          name="actionId"
          :options="actionOptions"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="record.isPending.value"
        />
      </UiField>

      <div class="flex flex-col gap-1">
        <label class="flex items-center gap-2 text-sm text-ink">
          <input
            v-model="confirmed"
            type="checkbox"
            name="confirmed"
            class="size-4 accent-brand"
            :disabled="record.isPending.value"
          />
          Я подтверждаю, что оплата получена
        </label>
        <p class="text-xs text-muted">Подтверждение будет сохранено один раз.</p>
        <p v-if="errors.confirmed" class="text-xs text-danger" aria-live="polite">
          {{ errors.confirmed }}
        </p>
      </div>

      <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
        {{ errorView.description }}
      </UiAlert>
      <UiAlert v-if="alreadyAttributed" tone="warning" title="Возвращённая выручка уже учтена">
        У этой сделки уже есть подтверждение с типом «возвращённая». Эту оплату можно сохранить как
        обычную — без связи с риском.
        <div class="mt-3">
          <UiButton size="sm" :loading="record.isPending.value" @click="confirmAsOrganic">
            Подтвердить как обычную оплату
          </UiButton>
        </div>
      </UiAlert>
      <UiAlert v-if="record.canRetry.value" tone="warning" title="Результат неизвестен">
        Ответ сервера не получен. Повторите отправку — подтверждение не задвоится.
        <div class="mt-3 flex flex-wrap gap-2">
          <UiButton size="sm" :loading="record.isPending.value" @click="retry">
            Повторить отправку
          </UiButton>
          <UiButton size="sm" variant="ghost" @click="record.reset()">Отменить</UiButton>
        </div>
      </UiAlert>

      <div class="flex flex-wrap justify-end gap-3">
        <UiButton variant="secondary" :disabled="record.isPending.value" @click="finish">
          Отмена
        </UiButton>
        <UiButton type="submit" :disabled="record.canRetry.value" :loading="record.isPending.value">
          {{ submitLabel }}
        </UiButton>
      </div>
    </form>
  </UiDialog>
</template>
