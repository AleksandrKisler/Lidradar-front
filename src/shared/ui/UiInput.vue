<script setup lang="ts">
/**
 * Текстовое поле по макету: высота 46, радиус 10, состояние ошибки
 * подсвечивается рамкой и объявляется через `aria-invalid`.
 */
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    id?: string | undefined
    type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number' | 'time' | undefined
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
    :type="type"
    :disabled="disabled"
    :placeholder="placeholder"
    :autocomplete="autocomplete"
    :maxlength="maxlength"
    :inputmode="inputmode"
    :aria-invalid="invalid || undefined"
    :aria-describedby="describedBy"
    :class="[
      'h-input w-full rounded-field border bg-paper px-3.5 text-base text-ink placeholder:text-muted/70 disabled:cursor-not-allowed disabled:bg-canvas',
      invalid ? 'border-danger' : 'border-line hover:border-muted/60',
    ]"
  />
</template>
