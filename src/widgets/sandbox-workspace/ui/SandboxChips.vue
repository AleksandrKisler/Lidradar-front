<script setup lang="ts">
/** Выбор одного значения чипами (radiogroup): паузы и «после последнего сообщения прошло». */
import { UiIcon } from '@/shared/ui'

const props = defineProps<{
  label: string
  options: readonly { value: number; label: string }[]
  modelValue: number
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function select(value: number): void {
  if (!props.disabled) emit('update:modelValue', value)
}
</script>

<template>
  <div role="radiogroup" :aria-label="label" class="flex flex-wrap gap-2">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="option.value === modelValue"
      :disabled="disabled"
      :class="[
        'inline-flex h-8 items-center gap-1 rounded-field border px-3 text-sm font-medium transition-colors disabled:opacity-50',
        option.value === modelValue
          ? 'border-transparent bg-brand-pale text-brand-dark'
          : 'border-line bg-paper text-ink hover:bg-canvas',
      ]"
      @click="select(option.value)"
    >
      <UiIcon v-if="option.value === modelValue" name="check" class="size-4" />{{ option.label }}
    </button>
  </div>
</template>
