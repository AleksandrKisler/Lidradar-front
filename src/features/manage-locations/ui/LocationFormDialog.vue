<script setup lang="ts">
/** Диалог формы точки для настроек; состояние формы живёт внутри диалога. */
import { UiDialog } from '@/shared/ui'
import type { Location } from '@/entities/location'
import LocationForm from './LocationForm.vue'

defineProps<{ tenantId: string; location: Location | null; defaultTimezone: string }>()
const emit = defineEmits<{ saved: [location: Location] }>()
const open = defineModel<boolean>('open', { default: false })

function onSaved(location: Location): void {
  open.value = false
  emit('saved', location)
}
</script>

<template>
  <UiDialog v-model:open="open" :title="location ? 'Изменить точку' : 'Новая точка'" size="lg">
    <LocationForm
      v-if="open"
      :tenant-id="tenantId"
      :location="location"
      :default-timezone="defaultTimezone"
      @saved="onSaved"
      @cancel="open = false"
    />
  </UiDialog>
</template>
