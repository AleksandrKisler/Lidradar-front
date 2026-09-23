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
      'h-input w-full appearance-none rounded-field border bg-paper bg-[url(\'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2363718A%22><path d=%22M5.5 7.5l4.5 4.5 4.5-4.5%22 stroke=%22%2363718A%22 stroke-width=%221.6%22 fill=%22none%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>\')] bg-[length:20px_20px] bg-[position:right_0.75rem_center] bg-no-repeat pr-10 pl-3.5 text-base text-ink disabled:cursor-not-allowed disabled:bg-canvas',
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
