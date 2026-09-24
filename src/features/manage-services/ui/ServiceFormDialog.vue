<script setup lang="ts">
/** Диалог формы услуги для настроек. */
import { UiDialog } from '@/shared/ui'
import type { Location } from '@/entities/location'
import type { ServiceCatalogItem } from '@/entities/service'
import ServiceForm from './ServiceForm.vue'

defineProps<{
  tenantId: string
  service: ServiceCatalogItem | null
  locations: Location[]
  defaultCurrency: string
}>()
const emit = defineEmits<{ saved: [service: ServiceCatalogItem] }>()
const open = defineModel<boolean>('open', { default: false })

function onSaved(service: ServiceCatalogItem): void {
  open.value = false
  emit('saved', service)
}
</script>

<template>
  <UiDialog v-model:open="open" :title="service ? 'Изменить услугу' : 'Новая услуга'" size="lg">
    <ServiceForm
      v-if="open"
      :tenant-id="tenantId"
      :service="service"
      :locations="locations"
      :default-currency="defaultCurrency"
      @saved="onSaved"
      @cancel="open = false"
    />
  </UiDialog>
</template>
