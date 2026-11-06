<script setup lang="ts">
/** Settings retains the confirmed result; onboarding keeps its existing close-on-save flow. */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { isUnknownResult } from '@/shared/api'
import { UiButton, UiSavedResult, UiSheetDialog } from '@/shared/ui'
import type { Location } from '@/entities/location'
import LocationForm from './LocationForm.vue'

const props = defineProps<{
  tenantId: string
  location: Location | null
  defaultTimezone: string
  context?: 'settings' | 'onboarding' | undefined
  returnFocus?: (() => HTMLElement | null) | undefined
}>()
const emit = defineEmits<{
  saved: [location: Location]
  failed: [error: unknown]
  busy: [busy: boolean]
}>()
const open = defineModel<boolean>('open', { default: false })
let mounted = true
onBeforeUnmount(() => {
  mounted = false
})
function restoreTrigger(event: Event) {
  const target = props.returnFocus?.()
  if (!target) return
  event.preventDefault()
  target.focus({ preventScroll: true })
}
const FORM_ID = 'location-dialog-form'
const busy = ref(false)
const editing = ref<Location | null>(props.location)
const result = ref<Location | null>(null)
const created = ref(false)
const failed = ref(false)
const blocked = ref(false)
watch(
  open,
  (value) => {
    busy.value = false
    if (value) {
      editing.value = props.location
      result.value = null
      failed.value = false
      blocked.value = false
    }
  },
  { immediate: true },
)
watch(busy, (value) => emit('busy', value), { flush: 'sync' })
function onSaved(location: Location): void {
  emit('saved', location)
  if (props.context === 'onboarding') {
    open.value = false
    return
  }
  created.value = !editing.value
  result.value = location
  busy.value = false
}
function onFailed(error: unknown): void {
  failed.value = true
  blocked.value = props.context !== 'onboarding' && !editing.value && isUnknownResult(error)
  emit('failed', error)
}
async function editSaved(): Promise<void> {
  editing.value = result.value
  result.value = null
  failed.value = false
  await nextTick()
  if (mounted) document.querySelector<HTMLInputElement>('#location-dialog-form input')?.focus()
}
</script>

<template>
  <UiSheetDialog
    v-model:open="open"
    :title="editing ? 'Изменить точку' : 'Добавить точку'"
    :description="
      result
        ? ''
        : editing
          ? 'Пороги считаются только в рабочее время этой точки.'
          : context === 'onboarding'
            ? 'Укажите местное время и пороги ожидания. График настраивается на этом же шаге, после закрытия окна.'
            : 'Укажите местное время и пороги ожидания. График можно настроить после создания.'
    "
    description-in-body
    :settings-form="context !== 'onboarding'"
    :location-form="context !== 'onboarding'"
    :success="Boolean(result)"
    description-strong
    size="sm"
    footer-fill
    :tablet-as-desktop="context === 'onboarding'"
    :initial-focus="context === 'onboarding' ? 'input[name=locationName]' : undefined"
    :dismissible="!busy"
    :success-height="created ? 575 : 681"
    @close-auto-focus="restoreTrigger"
  >
    <UiSavedResult
      v-if="result"
      class="location-result"
      :title="created ? 'Точка добавлена' : 'Изменения сохранены'"
      :message="
        created
          ? `Точка «${result.name}» успешно добавлена.`
          : `Данные точки «${result.name}» сохранены.`
      "
      edit-label="Изменить точку"
      @ok="open = false"
      @edit="editSaved"
    />
    <LocationForm
      v-else-if="open"
      :key="editing?.id ?? 'new'"
      variant="dialog"
      :form-id="FORM_ID"
      :tenant-id="tenantId"
      :location="editing"
      :default-timezone="defaultTimezone"
      :context="context"
      @saved="onSaved"
      @busy="busy = $event"
      @failed="onFailed"
    />
    <template v-if="!result" #footer>
      <UiButton
        variant="secondary"
        :class="context !== 'onboarding' ? 'disabled:text-muted' : ''"
        :disabled="busy"
        @click="open = false"
        >Отмена</UiButton
      >
      <UiButton type="submit" :form="FORM_ID" :loading="busy" :disabled="blocked">{{
        blocked
          ? 'Требуется сверка'
          : busy && context !== 'onboarding'
            ? 'Сохраняем…'
            : failed && context !== 'onboarding'
              ? 'Повторить сохранение'
              : editing
                ? 'Сохранить точку'
                : 'Добавить точку'
      }}</UiButton>
    </template>
  </UiSheetDialog>
</template>
