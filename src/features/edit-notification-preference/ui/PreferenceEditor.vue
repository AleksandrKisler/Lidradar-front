<script setup lang="ts">
import { computed, nextTick, ref, watch, type CSSProperties } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiField, UiInput, UiSelect, UiSheetDialog } from '@/shared/ui'
import { formatDateTime } from '@/shared/lib'
import { riskTypeLabel } from '@/entities/risk'
import {
  DELIVERY_MODES,
  SEVERITY_THRESHOLDS,
  deliveryModeLabel,
  severityThresholdLabel,
  describeQuietHours,
  notificationTimeZoneLabel,
  type NotificationPreference,
} from '@/entities/notification'
import { usePreferenceEditor } from '../model/use-preference-editor'
import checkedBusy from './assets/checked-base.svg'
import uncheckedBusy from './assets/unchecked-base.svg'
const props = defineProps<{
  tenantId: string
  preference: NotificationPreference
  telegramLinked: boolean
  timeZone: string
  formId?: string
  dialog?: boolean
}>()
const emit = defineEmits<{
  saved: [preference: NotificationPreference]
  reset: []
  state: [value: { dirty: boolean; busy: boolean; failed: boolean; blocked: boolean }]
}>()
const model = usePreferenceEditor(props, {
  saved: (value) => emit('saved', value),
  reset: () => emit('reset'),
})
const {
  baseline,
  draft,
  errors,
  dirty,
  busy,
  saved,
  error,
  readError,
  resetOpen,
  resetAcknowledged,
} = model
watch(
  [dirty, busy, error, resetAcknowledged],
  () =>
    emit('state', {
      dirty: dirty.value,
      busy: busy.value,
      failed: !!error.value,
      blocked: resetAcknowledged.value,
    }),
  { immediate: true },
)
const modes = DELIVERY_MODES.map((value) => ({ value, label: deliveryModeLabel(value) }))
const thresholds = SEVERITY_THRESHOLDS.map((value) => ({
  value,
  label: severityThresholdLabel(value),
}))
const description = computed(
  () =>
    ({
      IMMEDIATE: 'Новый риск — отдельным уведомлением, кроме тихих часов.',
      DIGEST: 'Одно сообщение в выбранное время. В сводке — активные риски.',
      DISABLED: 'Риски остаются в Radar. Уведомлений об этом типе не будет.',
    })[draft.value.deliveryMode],
)
const quietHint = computed(() =>
  draft.value.quietHoursEnabled && !errors.value.quietHoursStart && !errors.value.quietHoursEnd
    ? `${describeQuietHours(draft.value.quietHoursStart, draft.value.quietHoursEnd)}. Уведомления придут сводкой после тихих часов.`
    : null,
)
const failure = computed(() => (error.value ? describeError(error.value) : null))
const validationElement = ref<HTMLElement | null>(null)
const validationSummary = computed(() => {
  if (!props.dialog || !Object.keys(errors.value).length) return null
  if (errors.value.quietHoursStart || errors.value.quietHoursEnd) {
    return {
      title: 'Проверьте тихие часы',
      description:
        errors.value.quietHoursEnd === 'Границы тихих часов должны различаться'
          ? 'Начало и конец должны различаться.'
          : 'Укажите начало и конец в формате ЧЧ:ММ.',
    }
  }
  return {
    title: 'Проверьте настройки',
    description: 'Исправьте выделенные поля и повторите сохранение.',
  }
})
async function submitPreference() {
  await model.submit()
  if (!validationSummary.value) return
  await nextTick()
  validationElement.value?.scrollIntoView?.({ block: 'nearest' })
}
const busyControlStyle = computed(() =>
  props.dialog && busy.value ? { opacity: 0.45 } : undefined,
)
function busyCheckboxStyle(checked: boolean): CSSProperties | undefined {
  if (!props.dialog || !busy.value) return undefined
  return {
    appearance: 'none',
    border: 0,
    backgroundImage: `url("${checked ? checkedBusy : uncheckedBusy}")`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '16px 16px',
  }
}
const checks = [
  { key: 'inAppEnabled', name: 'inapp', label: 'Внутри LidRadar' },
  { key: 'telegramEnabled', name: 'telegram', label: 'Личные уведомления в Telegram' },
  { key: 'quietHoursEnabled', name: 'quiet', label: 'Не беспокоить в тихие часы' },
] as const
</script>
<template>
  <form
    :id="formId"
    class="flex min-w-0 flex-col gap-4"
    novalidate
    @submit.prevent="submitPreference"
  >
    <p v-if="dialog" class="text-base leading-[22px] font-semibold text-ink">
      {{ riskTypeLabel(preference.riskType) }}
    </p>
    <p class="text-xs leading-[18px] text-muted">
      {{ baseline.isDefault ? 'По умолчанию' : 'Настроено вами' }} ·
      {{ notificationTimeZoneLabel(baseline.timezone) }}
      <span v-if="!dialog && baseline.updatedAt">
        · изменено {{ formatDateTime(baseline.updatedAt, timeZone) }}</span
      >
    </p>
    <div v-if="validationSummary" ref="validationElement">
      <UiAlert compact tone="danger" :title="validationSummary.title">{{
        validationSummary.description
      }}</UiAlert>
    </div>
    <UiAlert v-if="saved" compact tone="success" title="✓ Настройка сохранена"
      >Изменения применены только к этому типу риска.</UiAlert
    >
    <UiAlert
      v-if="failure"
      compact
      tone="danger"
      title="Не удалось сохранить правило"
      :trace-id="isApiError(error) ? error.traceId : ''"
      >Изменения остались в форме. Повторите сохранение.</UiAlert
    >
    <UiField v-slot="{ id, describedBy, invalid }" label="Как уведомлять" label-style="compact">
      <UiSelect
        :id="id"
        v-model="draft.deliveryMode"
        :style="busyControlStyle"
        :name="`mode-${preference.riskType}`"
        :options="modes"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="busy || resetAcknowledged"
      />
    </UiField>
    <p class="text-sm leading-5 text-muted">{{ description }}</p>
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Минимальная важность"
      label-style="compact"
    >
      <UiSelect
        :id="id"
        v-model="draft.minimumSeverity"
        :style="busyControlStyle"
        :name="`severity-${preference.riskType}`"
        :options="thresholds"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="busy || resetAcknowledged || draft.deliveryMode === 'DISABLED'"
      />
    </UiField>
    <UiField
      v-if="draft.deliveryMode === 'DIGEST'"
      v-slot="{ id, describedBy, invalid }"
      label="Время сводки"
      label-style="compact"
      :error="errors.digestTime"
    >
      <UiInput
        :id="id"
        v-model="draft.digestTime"
        :style="busyControlStyle"
        type="time"
        :name="`digest-${preference.riskType}`"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="busy || resetAcknowledged"
      />
    </UiField>
    <h3 class="text-base leading-[22px] font-semibold text-ink">Куда отправлять</h3>
    <template v-for="check in checks" :key="check.key">
      <label
        class="flex min-h-[46px] items-center text-sm leading-5 text-ink"
        :style="dialog && busy ? { opacity: 0.45 } : undefined"
      >
        <span class="flex size-[46px] shrink-0 items-center justify-center"
          ><input
            v-model="draft[check.key]"
            type="checkbox"
            :name="`${check.name}-${preference.riskType}`"
            class="size-4 accent-brand"
            :style="busyCheckboxStyle(draft[check.key])"
            :disabled="busy || resetAcknowledged || draft.deliveryMode === 'DISABLED'" /></span
        >{{ check.label }}
      </label>
      <template v-if="check.key === 'telegramEnabled' && draft.telegramEnabled && !telegramLinked">
        <p class="text-sm leading-5 text-ink" role="status">Telegram не подключён</p>
        <p class="text-sm leading-5 text-muted">
          Выбор можно сохранить. Сообщения начнут приходить после личной привязки бота.
        </p>
      </template>
    </template>
    <div v-if="draft.quietHoursEnabled" class="grid grid-cols-2 gap-3">
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="С"
        label-style="compact"
        :error="errors.quietHoursStart"
      >
        <UiInput
          :id="id"
          v-model="draft.quietHoursStart"
          :style="busyControlStyle"
          type="time"
          :name="`quiet-start-${preference.riskType}`"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="busy || resetAcknowledged || draft.deliveryMode === 'DISABLED'"
        />
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="До"
        label-style="compact"
        :error="errors.quietHoursEnd"
      >
        <UiInput
          :id="id"
          v-model="draft.quietHoursEnd"
          :style="busyControlStyle"
          type="time"
          :name="`quiet-end-${preference.riskType}`"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="busy || resetAcknowledged || draft.deliveryMode === 'DISABLED'"
        />
      </UiField>
    </div>
    <p class="text-sm leading-5 text-muted">
      {{
        quietHint ??
        'Время — по часовому поясу организации. Тихие часы не меняют рабочий график точки.'
      }}
    </p>
    <UiButton
      v-if="!baseline.isDefault"
      variant="ghost"
      class="text-muted!"
      :disabled="busy || resetAcknowledged"
      @click="resetOpen = true"
      >Вернуть по умолчанию</UiButton
    >
    <UiAlert
      v-if="readError && !resetOpen"
      tone="warning"
      title="Данные сохранены, но список не обновлён"
      >Повторите чтение. Повторно сохранять настройку не нужно.<UiButton
        variant="ghost"
        @click="model.retryRead"
        >Обновить список</UiButton
      ></UiAlert
    >
    <p v-if="!saved && !failure && !busy" class="text-sm leading-5 text-muted">
      {{
        dirty
          ? 'Есть изменения. Сохраните, чтобы применить правило.'
          : 'Изменений нет. Чтобы сохранить, измените настройку.'
      }}
    </p>
    <UiButton v-if="!dialog" type="submit" :disabled="!dirty || resetAcknowledged" :loading="busy"
      >Сохранить</UiButton
    >
  </form>
  <UiSheetDialog
    v-model:open="resetOpen"
    title="Вернуть по умолчанию?"
    settings-redesign
    footer-fill
    size="sm"
    :content-height="600"
    :dismissible="!busy"
  >
    <div class="flex flex-col gap-4">
      <h3 class="text-base leading-[22px] font-semibold text-ink">
        {{ riskTypeLabel(preference.riskType) }}
      </h3>
      <p class="text-sm leading-5 text-ink">
        Будет применено текущее значение сервера для этого типа. Другие правила не изменятся.
      </p>
      <UiAlert v-if="failure || readError" tone="danger">{{
        resetAcknowledged
          ? 'Сброс подтверждён. Не удалось прочитать настройку по умолчанию. Повторите чтение.'
          : failure?.description
      }}</UiAlert>
    </div>
    <template #footer
      ><UiButton variant="secondary" :disabled="busy" @click="resetOpen = false"
        >Оставить мои</UiButton
      ><UiButton :loading="busy" @click="model.reset">{{
        resetAcknowledged ? 'Повторить чтение' : 'Вернуть'
      }}</UiButton></template
    >
  </UiSheetDialog>
</template>
