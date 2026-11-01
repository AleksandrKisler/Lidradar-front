<script setup lang="ts">
/** Settings retains the confirmed response until OK, close or edit of that same ID. */
import { nextTick, ref, useId, watch } from 'vue'
import { isUnknownResult } from '@/shared/api'
import { UiButton, UiSavedResult, UiSheetDialog } from '@/shared/ui'
import type { Location } from '@/entities/location'
import type { ServiceCatalogItem } from '@/entities/service'
import ServiceForm from './ServiceForm.vue'

const props = defineProps<{
  tenantId: string
  service: ServiceCatalogItem | null
  locations: Location[]
  defaultCurrency: string
}>()
const emit = defineEmits<{ saved: [service: ServiceCatalogItem] }>()
const open = defineModel<boolean>('open', { default: false })
const formId = useId()
const operationKey = ref(0)
const editing = ref<ServiceCatalogItem | null>(null)
const result = ref<ServiceCatalogItem | null>(null)
const created = ref(false)
const busy = ref(false)
const failed = ref(false)
const blocked = ref(false)
watch(
  [open, () => props.tenantId, () => props.service?.id],
  () => {
    operationKey.value++
    editing.value = props.service
    result.value = null
    busy.value = failed.value = blocked.value = false
  },
  { immediate: true, flush: 'sync' },
)
function onBusy(value: boolean, key?: number) {
  if (key === operationKey.value) busy.value = value
}
function onSaved(service: ServiceCatalogItem, key?: number) {
  if (key !== operationKey.value || !open.value) return
  created.value = !editing.value
  result.value = service
  busy.value = false
  emit('saved', service)
}
function onFailed(error: unknown, key?: number) {
  if (key !== operationKey.value) return
  failed.value = true
  blocked.value = !editing.value && isUnknownResult(error)
}
async function editSaved() {
  editing.value = result.value
  result.value = null
  operationKey.value++
  failed.value = blocked.value = false
  await nextTick()
  document.getElementById(formId)?.querySelector<HTMLInputElement>('input')?.focus()
}
</script>

<template>
  <UiSheetDialog
    v-model:open="open"
    :title="editing ? 'Изменить услугу' : 'Добавить услугу'"
    :description="
      result ? '' : 'Цена помогает оценивать потенциал сделки. Поля цены можно оставить пустыми.'
    "
    entity-form
    settings-form
    description-in-body
    footer-fill
    size="sm"
    :dismissible="!busy"
    :success="Boolean(result)"
    :success-height="673"
  >
    <UiSavedResult
      v-if="result"
      class="md:pt-1"
      :content-width="480"
      :title="created ? 'Услуга добавлена' : 'Изменения сохранены'"
      :message="
        created
          ? `Услуга «${result.name}» успешно добавлена.`
          : `Данные услуги «${result.name}» сохранены.`
      "
      edit-label="Изменить услугу"
      @ok="open = false"
      @edit="editSaved"
    />
    <ServiceForm
      v-else-if="open"
      :key="operationKey"
      dialog
      :form-id="formId"
      :operation-key="operationKey"
      :tenant-id="tenantId"
      :service="editing"
      :locations="locations"
      :default-currency="defaultCurrency"
      @busy="onBusy"
      @saved="onSaved"
      @failed="onFailed"
    />
    <template v-if="!result" #footer>
      <UiButton
        variant="secondary"
        class="disabled:text-muted"
        :disabled="busy"
        @click="open = false"
        >Отмена</UiButton
      >
      <UiButton type="submit" :form="formId" :loading="busy" :disabled="blocked">{{
        blocked
          ? 'Требуется сверка'
          : busy
            ? 'Сохраняем…'
            : failed
              ? 'Повторить сохранение'
              : editing
                ? 'Сохранить услугу'
                : 'Добавить услугу'
      }}</UiButton>
    </template>
  </UiSheetDialog>
</template>
