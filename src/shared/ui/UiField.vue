<script setup lang="ts">
/**
 * Обёртка поля формы: подпись, описание и ошибка связаны с элементом
 * управления через `id` и `aria-describedby`. Элемент управления передаётся
 * в слот и получает готовые атрибуты доступности.
 */
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    description?: string | undefined
    error?: string | undefined
    required?: boolean | undefined
  }>(),
  { description: '', error: '', required: false },
)

const id = useId()
const descriptionId = `${id}-description`
const errorId = `${id}-error`

/** Идентификаторы пояснений, которые нужно объявить у элемента управления. */
const describedBy = computed(() => {
  const ids: string[] = []
  if (props.description) ids.push(descriptionId)
  if (props.error) ids.push(errorId)
  return ids.length ? ids.join(' ') : undefined
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-sm font-medium text-ink">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>
    <slot :id="id" :described-by="describedBy" :invalid="Boolean(error)" />
    <p v-if="description" :id="descriptionId" class="text-xs text-muted">{{ description }}</p>
    <p :id="errorId" class="min-h-0 text-xs text-danger" aria-live="polite">
      <template v-if="error">{{ error }}</template>
    </p>
  </div>
</template>
