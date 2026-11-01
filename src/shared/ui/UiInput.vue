<script setup lang="ts">
import { readTimeInput } from './time-input'
/**
 * Текстовое поле по макету: высота 46, радиус 10, состояние ошибки
 * подсвечивается рамкой и объявляется через `aria-invalid`.
 */
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    id?: string | undefined
    type?:
      | 'text'
      | 'email'
      | 'password'
      | 'search'
      | 'tel'
      | 'url'
      | 'number'
      | 'time'
      | 'date'
      | undefined
    invalid?: boolean | undefined
    describedBy?: string | undefined
    disabled?: boolean | undefined
    placeholder?: string | undefined
    autocomplete?: string | undefined
    maxlength?: number | undefined
    inputmode?: 'text' | 'email' | 'numeric' | 'decimal' | 'tel' | 'url' | 'search' | undefined
  }>(),
  {
    id: undefined,
    type: 'text',
    invalid: false,
    describedBy: undefined,
    disabled: false,
    placeholder: undefined,
    autocomplete: undefined,
    maxlength: undefined,
    inputmode: undefined,
  },
)

const model = defineModel<string | undefined>({ default: '' })
</script>

<template>
  <input
    :id="id"
    v-model="model"
    v-bind="$attrs"
    :type="type === 'time' ? 'text' : type"
    :disabled="disabled"
    :placeholder="placeholder ?? (type === 'time' ? 'ЧЧ:ММ' : undefined)"
    :autocomplete="autocomplete ?? (type === 'time' ? 'off' : undefined)"
    :maxlength="maxlength"
    :inputmode="type === 'time' ? 'numeric' : inputmode"
    :aria-invalid="invalid || undefined"
    :aria-describedby="describedBy"
    :class="[
      'h-input w-full rounded-field border bg-paper px-3.5 text-field text-ink text-ellipsis placeholder:text-secondary disabled:cursor-not-allowed disabled:opacity-70',
      invalid ? 'border-danger' : 'border-line hover:border-muted/60',
    ]"
    @input="type === 'time' && (model = readTimeInput($event))"
  />
</template>
