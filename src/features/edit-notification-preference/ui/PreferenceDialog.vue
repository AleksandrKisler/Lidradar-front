<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import { UiButton, UiDialog, UiSheetDialog } from '@/shared/ui'
import type { NotificationPreference } from '@/entities/notification'
import PreferenceEditor from './PreferenceEditor.vue'
const props = defineProps<{
  tenantId: string
  preference: NotificationPreference
  telegramLinked: boolean
  timeZone: string
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [value: NotificationPreference]; reset: [] }>()
const formId = useId(),
  state = ref({ dirty: false, busy: false, failed: false, blocked: false }),
  discard = ref(false)
function close(value = false) {
  if (value || state.value.busy) return
  if (state.value.dirty && !state.value.blocked) discard.value = true
  else open.value = false
}
function discardChanges() {
  discard.value = false
  open.value = false
}
watch(
  [() => props.tenantId, () => props.preference.riskType],
  () => {
    open.value = discard.value = false
  },
  { flush: 'sync' },
)
</script>
<template>
  <UiSheetDialog
    :open="open"
    title="Настроить уведомления"
    settings-redesign
    footer-fill
    size="sm"
    :content-height="900"
    :dismissible="!state.busy"
    @update:open="close"
  >
    <PreferenceEditor
      v-if="open"
      :form-id="formId"
      dialog
      :tenant-id="tenantId"
      :preference="preference"
      :telegram-linked="telegramLinked"
      :time-zone="timeZone"
      @state="state = $event"
      @saved="emit('saved', $event)"
      @reset="emit('reset')"
    />
    <template #footer>
      <UiButton
        variant="secondary"
        class="disabled:bg-line disabled:text-muted disabled:opacity-100"
        :disabled="state.busy"
        @click="close()"
        >Отмена</UiButton
      >
      <UiButton
        type="submit"
        :class="
          state.busy ? undefined : 'disabled:bg-line disabled:text-muted disabled:opacity-100'
        "
        :form="formId"
        :disabled="!state.dirty || state.blocked"
        :loading="state.busy"
        >{{
          state.busy ? 'Сохраняем…' : state.failed ? 'Повторить сохранение' : 'Сохранить'
        }}</UiButton
      >
    </template>
  </UiSheetDialog>
  <UiDialog
    v-model:open="discard"
    title="Закрыть без сохранения?"
    description="Изменения этого правила не будут применены."
  >
    <template #footer>
      <UiButton variant="secondary" @click="discard = false">Продолжить редактирование</UiButton>
      <UiButton variant="danger" @click="discardChanges">Не сохранять</UiButton>
    </template>
  </UiDialog>
</template>
