<script setup lang="ts">
/**
 * Нативный выпадающий список: доступен с клавиатуры и на мобильных без
 * дополнительного кода. Пустое значение показывает `placeholder`.
 */
defineOptions({ inheritAttrs: false })

export interface UiSelectOption {
  value: string
  label: string
  disabled?: boolean
}

withDefaults(
  defineProps<{
    id?: string | undefined
    options: UiSelectOption[]
    placeholder?: string | undefined
    invalid?: boolean | undefined
    describedBy?: string | undefined
    disabled?: boolean | undefined
    /** `filter` — компактный фильтр ленты (Figma HIG / Filter): 36 px, текст 14/20. */
    size?: 'md' | 'filter' | undefined
  }>(),
  {
    id: undefined,
    placeholder: '',
    invalid: false,
    describedBy: undefined,
    disabled: false,
    size: 'md',
  },
)

const model = defineModel<string | undefined>({ default: '' })
</script>

<template>
  <select
    :id="id"
    v-model="model"
    v-bind="$attrs"
    :disabled="disabled"
    :aria-invalid="invalid || undefined"
    :aria-describedby="describedBy"
    :class="[
      'appearance-none rounded-field border bg-paper ui-select-chevron bg-no-repeat disabled:cursor-not-allowed disabled:opacity-70',
      // Пустое значение без подсказки — полноценный пункт («Все точки»), а не заглушка.
      model || (!placeholder && size !== 'filter') ? 'text-ink' : 'text-muted',
      size === 'filter'
        ? 'h-9 bg-[length:18px_18px] bg-[position:right_0.5rem_center] pr-[26px] pl-2 text-sm leading-5'
        : 'h-input w-full bg-[length:24px_24px] bg-[position:right_0.625rem_center] pr-10 pl-3.5 text-field',
      invalid ? 'border-danger' : 'border-line hover:border-muted/60',
    ]"
  >
    <option v-if="placeholder" value="">{{ placeholder }}</option>
    <option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :disabled="option.disabled"
    >
      {{ option.label }}
    </option>
  </select>
</template>
