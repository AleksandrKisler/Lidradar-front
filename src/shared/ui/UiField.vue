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
    /** `compact` — подпись 14/20 для форм внутри карточек; `muted` — необязательное поле. */
    labelStyle?: 'default' | 'compact' | 'muted' | undefined
    /**
     * Ошибка заменяет подсказку, а не дополняет её (макеты Access «Ошибка»). Для остальных форм
     * подсказка остаётся: она может нести смысл, которого нет в тексте ошибки.
     */
    errorReplacesDescription?: boolean | undefined
  }>(),
  {
    description: '',
    error: '',
    required: false,
    labelStyle: 'default',
    errorReplacesDescription: false,
  },
)

const id = useId()
const descriptionId = `${id}-description`
const errorId = `${id}-error`

/** Подсказка показывается всегда; в формах Access (`errorReplacesDescription`) пока нет ошибки. */
const showDescription = computed(
  () => Boolean(props.description) && !(props.errorReplacesDescription && props.error),
)

/** Идентификаторы пояснений, которые нужно объявить у элемента управления. */
const describedBy = computed(() => {
  const ids: string[] = []
  if (showDescription.value) ids.push(descriptionId)
  if (props.error) ids.push(errorId)
  return ids.length ? ids.join(' ') : undefined
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <label
      :for="id"
      :class="[
        'leading-5',
        labelStyle === 'default' ? 'text-base font-medium text-ink' : 'text-sm',
        labelStyle === 'compact' ? 'font-medium text-ink' : '',
        labelStyle === 'muted' ? 'text-muted' : '',
      ]"
    >
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>
    <slot :id="id" :described-by="describedBy" :invalid="Boolean(error)" />
    <p v-if="showDescription" :id="descriptionId" class="text-xs text-secondary">
      {{ description }}
    </p>
    <p :id="errorId" class="min-h-0 text-sm leading-5 text-danger empty:-mt-2" aria-live="polite">
      <template v-if="error">{{ error }}</template>
    </p>
  </div>
</template>
