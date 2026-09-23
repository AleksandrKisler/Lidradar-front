<script setup lang="ts">
/**
 * Многострочное поле по тем же правилам, что и `UiInput`: ошибка объявляется
 * через `aria-invalid`, пояснения связываются через `aria-describedby`.
 */
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    id?: string | undefined
    rows?: number | undefined
    invalid?: boolean | undefined
    describedBy?: string | undefined
    disabled?: boolean | undefined
    placeholder?: string | undefined
    maxlength?: number | undefined
  }>(),
  {
    id: undefined,
    rows: 3,
    invalid: false,
    describedBy: undefined,
    disabled: false,
    placeholder: undefined,
    maxlength: undefined,
  },
)

const model = defineModel<string | undefined>({ default: '' })
</script>

<template>
  <textarea
    :id="id"
    v-model="model"
    v-bind="$attrs"
    :rows="rows"
    :disabled="disabled"
    :placeholder="placeholder"
    :maxlength="maxlength"
    :aria-invalid="invalid || undefined"
    :aria-describedby="describedBy"
    :class="[
      'w-full rounded-field border bg-paper px-3.5 py-2.5 text-base leading-6 text-ink placeholder:text-muted/70 disabled:cursor-not-allowed disabled:bg-canvas',
      invalid ? 'border-danger' : 'border-line hover:border-muted/60',
    ]"
  />
</template>
