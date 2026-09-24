<script setup lang="ts">
/**
 * Редактор настройки уведомлений одного типа риска. Любое изменение
 * отправляется полным PUT; сброс возвращает серверное значение по умолчанию
 * через DELETE и перечитывание. Telegram-канал без личной привязки
 * сопровождается предупреждением, но окончательно проверяет сервер.
 */
import { computed, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { describeError, isApiError } from '@/shared/api'
import {
  UiAlert,
  UiBadge,
  UiButton,
  UiDialog,
  UiField,
  UiInput,
  UiSelect,
  type UiSelectOption,
} from '@/shared/ui'
import { formatDateTime } from '@/shared/lib'
import {
  DELIVERY_MODES,
  SEVERITY_THRESHOLDS,
  deliveryModeDescription,
  deliveryModeLabel,
  describeQuietHours,
  draftFromPreference,
  notificationKeys,
  putPreference,
  resetPreference,
  sameDraft,
  samePreference,
  severityThresholdLabel,
  toPreferenceRequest,
  validateDraft,
  type NotificationPreference,
  type PreferenceDraft,
  type PreferenceField,
} from '@/entities/notification'

const props = defineProps<{
  tenantId: string
  preference: NotificationPreference
  telegramLinked: boolean
  timeZone: string
}>()
const emit = defineEmits<{ saved: [preference: NotificationPreference]; reset: [] }>()

const queryClient = useQueryClient()
const draft = ref<PreferenceDraft>(draftFromPreference(props.preference))
const errors = ref<Partial<Record<PreferenceField, string>>>({})
const saved = ref(false)
const resetOpen = ref(false)

// Перечитывание списка после сохранения другой строки не стирает черновик этой.
watch(
  () => props.preference,
  (next, previous) => {
    if (samePreference(next, previous)) return
    draft.value = draftFromPreference(next)
    errors.value = {}
  },
)

const dirty = computed(() => !sameDraft(draft.value, draftFromPreference(props.preference)))
watch(dirty, (isDirty) => {
  if (isDirty) saved.value = false
})

const modeOptions: UiSelectOption[] = DELIVERY_MODES.map((value) => ({
  value,
  label: deliveryModeLabel(value),
}))
const thresholdOptions: UiSelectOption[] = SEVERITY_THRESHOLDS.map((value) => ({
  value,
  label: severityThresholdLabel(value),
}))

async function refresh(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: notificationKeys.preferences(props.tenantId) })
}

const save = useMutation({
  mutationFn: () =>
    putPreference(props.tenantId, props.preference.riskType, toPreferenceRequest(draft.value)),
  onSuccess: async (preference) => {
    await refresh()
    saved.value = true
    emit('saved', preference)
  },
})
const reset = useMutation({
  mutationFn: () => resetPreference(props.tenantId, props.preference.riskType),
  onSuccess: async () => {
    await refresh()
    resetOpen.value = false
    emit('reset')
  },
})

const error = computed(() => save.error.value ?? reset.error.value)
const errorView = computed(() => (error.value ? describeError(error.value) : null))
const traceId = computed(() => (isApiError(error.value) ? error.value.traceId : ''))

async function submit(): Promise<void> {
  // Кнопка отключена без изменений, но форму можно отправить клавишей.
  if (!dirty.value || save.isPending.value) return
  saved.value = false
  save.reset()
  errors.value = validateDraft(draft.value)
  if (Object.keys(errors.value).length > 0) return
  await save.mutateAsync().catch(() => null)
}

// После первой неудачной отправки ошибки пересчитываются по мере правки.
watch(
  draft,
  () => {
    if (Object.keys(errors.value).length > 0) errors.value = validateDraft(draft.value)
  },
  { deep: true },
)

const quietHint = computed(() =>
  draft.value.quietHoursEnabled && !errors.value.quietHoursStart && !errors.value.quietHoursEnd
    ? describeQuietHours(draft.value.quietHoursStart, draft.value.quietHoursEnd)
    : null,
)
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
    <div class="flex flex-wrap items-center gap-2 text-sm text-muted">
      <UiBadge :tone="preference.isDefault ? 'neutral' : 'brand'">
        {{ preference.isDefault ? 'По умолчанию' : 'Настроено вами' }}
      </UiBadge>
      <span v-if="preference.updatedAt"
        >изменено {{ formatDateTime(preference.updatedAt, timeZone) }}</span
      >
      <span>· часовой пояс {{ preference.timezone }}</span>
    </div>

    <div class="grid gap-5 sm:grid-cols-2">
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Как уведомлять"
        :description="deliveryModeDescription(draft.deliveryMode)"
      >
        <UiSelect
          :id="id"
          v-model="draft.deliveryMode"
          :name="`mode-${preference.riskType}`"
          :options="modeOptions"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="save.isPending.value"
        />
      </UiField>
      <UiField v-slot="{ id, describedBy, invalid }" label="Минимальная важность">
        <UiSelect
          :id="id"
          v-model="draft.minimumSeverity"
          :name="`severity-${preference.riskType}`"
          :options="thresholdOptions"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="save.isPending.value || draft.deliveryMode === 'DISABLED'"
        />
      </UiField>
    </div>

    <UiField
      v-if="draft.deliveryMode === 'DIGEST'"
      v-slot="{ id, describedBy, invalid }"
      label="Время сводки"
      description="По часовому поясу организации."
      :error="errors.digestTime"
    >
      <UiInput
        :id="id"
        v-model="draft.digestTime"
        type="time"
        :name="`digest-${preference.riskType}`"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="save.isPending.value"
      />
    </UiField>

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1 text-sm font-semibold text-ink">Куда отправлять</legend>
      <label class="flex items-center gap-2 text-sm text-ink">
        <input
          v-model="draft.inAppEnabled"
          type="checkbox"
          :name="`inapp-${preference.riskType}`"
          class="size-4 accent-brand"
          :disabled="save.isPending.value"
        />
        Внутри LidRadar
      </label>
      <label class="flex items-center gap-2 text-sm text-ink">
        <input
          v-model="draft.telegramEnabled"
          type="checkbox"
          :name="`telegram-${preference.riskType}`"
          class="size-4 accent-brand"
          :disabled="save.isPending.value"
        />
        Личные уведомления в Telegram
      </label>
      <p v-if="draft.telegramEnabled && !telegramLinked" class="text-xs text-warning" role="status">
        Telegram не привязан: сообщения туда не придут, пока вы не подключите бота выше.
      </p>
    </fieldset>

    <fieldset class="flex flex-col gap-3">
      <legend class="mb-1 text-sm font-semibold text-ink">Тихие часы</legend>
      <label class="flex items-center gap-2 text-sm text-ink">
        <input
          v-model="draft.quietHoursEnabled"
          type="checkbox"
          :name="`quiet-${preference.riskType}`"
          class="size-4 accent-brand"
          :disabled="save.isPending.value"
        />
        Не беспокоить ночью
      </label>
      <div v-if="draft.quietHoursEnabled" class="grid gap-4 sm:grid-cols-2">
        <UiField
          v-slot="{ id, describedBy, invalid }"
          label="Не беспокоить с"
          :error="errors.quietHoursStart"
        >
          <UiInput
            :id="id"
            v-model="draft.quietHoursStart"
            type="time"
            :name="`quiet-start-${preference.riskType}`"
            :described-by="describedBy"
            :invalid="invalid"
            :disabled="save.isPending.value"
          />
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="До" :error="errors.quietHoursEnd">
          <UiInput
            :id="id"
            v-model="draft.quietHoursEnd"
            type="time"
            :name="`quiet-end-${preference.riskType}`"
            :described-by="describedBy"
            :invalid="invalid"
            :disabled="save.isPending.value"
          />
        </UiField>
      </div>
      <p v-if="quietHint" class="text-xs text-muted">
        Интервал {{ quietHint }} по поясу организации. Тихие часы ограничивают оповещения, а не учёт
        рабочих часов точки.
      </p>
    </fieldset>

    <UiAlert v-if="saved" tone="success">Настройка сохранена.</UiAlert>
    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <UiButton
        v-if="!preference.isDefault"
        variant="ghost"
        size="sm"
        :disabled="save.isPending.value"
        @click="resetOpen = true"
      >
        Вернуть по умолчанию
      </UiButton>
      <span v-else />
      <UiButton type="submit" :disabled="!dirty" :loading="save.isPending.value"
        >Сохранить</UiButton
      >
    </div>

    <UiDialog
      v-model:open="resetOpen"
      title="Вернуть настройку по умолчанию?"
      description="Ваши изменения для этого типа риска будут удалены, начнёт действовать значение сервера."
      :dismissible="!reset.isPending.value"
    >
      <template #footer>
        <UiButton variant="secondary" :disabled="reset.isPending.value" @click="resetOpen = false">
          Отмена
        </UiButton>
        <UiButton variant="danger" :loading="reset.isPending.value" @click="reset.mutate()"
          >Вернуть</UiButton
        >
      </template>
    </UiDialog>
  </form>
</template>
