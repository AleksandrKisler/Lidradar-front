<script setup lang="ts">
/**
 * Поле пароля с кнопкой показа. Кнопка объявляет своё состояние через
 * `aria-pressed`; значение поля никуда не сохраняется и живёт только в
 * состоянии формы до завершения запроса.
 */
import { ref } from 'vue'
import UiIcon from './UiIcon.vue'

defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    id?: string | undefined
    invalid?: boolean | undefined
    describedBy?: string | undefined
    disabled?: boolean | undefined
    autocomplete?: 'current-password' | 'new-password' | undefined
  }>(),
  {
    id: undefined,
    invalid: false,
    describedBy: undefined,
    disabled: false,
    autocomplete: 'current-password',
  },
)

const model = defineModel<string | undefined>({ default: '' })
const revealed = ref(false)
</script>

<template>
  <div class="relative">
    <input
      :id="id"
      v-model="model"
      v-bind="$attrs"
      :type="revealed ? 'text' : 'password'"
      :disabled="disabled"
      :autocomplete="autocomplete"
      spellcheck="false"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedBy"
      :class="[
        'h-input w-full rounded-field border bg-paper pr-12 pl-3.5 text-base text-ink disabled:cursor-not-allowed disabled:bg-canvas',
        invalid ? 'border-danger' : 'border-line hover:border-muted/60',
      ]"
    />
    <button
      type="button"
      class="absolute inset-y-0 right-1 my-auto flex size-10 items-center justify-center rounded-field text-muted hover:text-ink"
      :aria-pressed="revealed"
      :aria-label="revealed ? 'Скрыть пароль' : 'Показать пароль'"
      :disabled="disabled"
      @click="revealed = !revealed"
    >
      <UiIcon :name="revealed ? 'visibility-off' : 'visibility'" class="size-6" />
    </button>
  </div>
</template>
