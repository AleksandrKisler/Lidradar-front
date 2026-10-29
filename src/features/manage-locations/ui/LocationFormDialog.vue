<script setup lang="ts">
/**
 * Окно «Добавить точку» / «Изменить точку» (Figma «Настройки»): поля формы, нижняя панель с
 * «Отмена» и основным действием. Состояние формы живёт внутри окна и сбрасывается при закрытии.
 */
import { ref, watch } from 'vue'
import { UiButton, UiSheetDialog } from '@/shared/ui'
import type { Location } from '@/entities/location'
import LocationForm from './LocationForm.vue'

defineProps<{ tenantId: string; location: Location | null; defaultTimezone: string }>()
const emit = defineEmits<{ saved: [location: Location] }>()
const open = defineModel<boolean>('open', { default: false })

const FORM_ID = 'location-dialog-form'
const busy = ref(false)
watch(open, (isOpen) => {
  if (!isOpen) busy.value = false
})

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
      location
        ? 'Пороги считаются только в рабочее время этой точки.'
        : 'Укажите местное время и пороги ожидания. График можно настроить после создания.'
    "
    description-in-body
    description-strong
    size="sm"
    footer-fill
    :dismissible="!busy"
  >
    <LocationForm
      v-if="open"
      variant="dialog"
      :form-id="FORM_ID"
      :tenant-id="tenantId"
      :location="location"
      :default-timezone="defaultTimezone"
      @saved="onSaved"
      @busy="busy = $event"
    />
    <template #footer>
      <UiButton variant="secondary" :disabled="busy" @click="open = false"> Отмена </UiButton>
      <UiButton type="submit" :form="FORM_ID" :loading="busy">
        {{ location ? 'Сохранить точку' : 'Добавить точку' }}
      </UiButton>
    </template>
  </UiSheetDialog>
</template>
