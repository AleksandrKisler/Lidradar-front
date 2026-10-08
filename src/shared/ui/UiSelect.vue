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
  }>(),
  { id: undefined, placeholder: '', invalid: false, describedBy: undefined, disabled: false },
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
      'h-input w-full appearance-none rounded-field border bg-paper bg-[url(\'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 -960 960 960%22 fill=%22%2363718A%22><path d=%22M480-344 240-584l43-43 197 197 197-197 43 43-240 240Z%22/></svg>\')] bg-[length:24px_24px] bg-[position:right_0.625rem_center] bg-no-repeat pr-10 pl-3.5 text-base text-ink disabled:cursor-not-allowed disabled:bg-canvas',
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
