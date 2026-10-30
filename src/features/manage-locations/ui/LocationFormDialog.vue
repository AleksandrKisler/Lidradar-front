<script setup lang="ts">
/**
 * Окно «Добавить точку» / «Изменить точку» (Figma «Настройки»): поля формы, нижняя панель с
 * «Отмена» и основным действием. Состояние формы живёт внутри окна и сбрасывается при закрытии.
 * В мастере (`context="onboarding"`) пояснение говорит, что график настраивается на том же шаге:
 * у новой точки он уже предзаполнен, пустой график не навязывается.
 */
import { ref, watch } from 'vue'
import { UiButton, UiSheetDialog } from '@/shared/ui'
import type { Location } from '@/entities/location'
import LocationForm from './LocationForm.vue'

const props = defineProps<{
  tenantId: string
  location: Location | null
  defaultTimezone: string
  context?: 'settings' | 'onboarding' | undefined
}>()
const emit = defineEmits<{
  saved: [location: Location]
  failed: [error: unknown]
  busy: [busy: boolean]
}>()
const open = defineModel<boolean>('open', { default: false })

const FORM_ID = 'location-dialog-form'
const busy = ref(false)
watch(open, (isOpen) => {
  if (!isOpen) busy.value = false
})
watch(busy, (value) => emit('busy', value))

const createDescription = () =>
  props.context === 'onboarding'
    ? 'Укажите местное время и пороги ожидания. График настраивается на этом же шаге, после закрытия окна.'
    : 'Укажите местное время и пороги ожидания. График можно настроить после создания.'

function onSaved(location: Location): void {
  open.value = false
  emit('saved', location)
}
</script>

<template>
  <UiSheetDialog
    v-model:open="open"
    :title="location ? 'Изменить точку' : 'Добавить точку'"
    :description="
      location ? 'Пороги считаются только в рабочее время этой точки.' : createDescription()
    "
    description-in-body
    description-strong
    size="sm"
    footer-fill
    :tablet-as-desktop="context === 'onboarding'"
    :initial-focus="context === 'onboarding' ? 'input[name=locationName]' : undefined"
    :dismissible="!busy"
  >
    <LocationForm
      v-if="open"
      variant="dialog"
      :form-id="FORM_ID"
      :tenant-id="tenantId"
      :location="location"
      :default-timezone="defaultTimezone"
      :context="context"
      @saved="onSaved"
      @busy="busy = $event"
      @failed="emit('failed', $event)"
    />
    <template #footer>
      <UiButton variant="secondary" :disabled="busy" @click="open = false"> Отмена </UiButton>
      <UiButton type="submit" :form="FORM_ID" :loading="busy">
        {{ location ? 'Сохранить точку' : 'Добавить точку' }}
      </UiButton>
    </template>
  </UiSheetDialog>
</template>
