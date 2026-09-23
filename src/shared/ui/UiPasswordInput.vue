<script setup lang="ts">
/**
 * Поле пароля с кнопкой показа. Кнопка объявляет своё состояние через
 * `aria-pressed`; значение поля никуда не сохраняется и живёт только в
 * состоянии формы до завершения запроса.
 */
import { ref } from 'vue'

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
      <svg
        v-if="revealed"
        class="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <path
          d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.4 10.4 0 0 1 12 5c5 0 9 4 10 7-.4 1.1-1.1 2.3-2.1 3.3M6.4 6.4C4.3 7.8 2.7 9.8 2 12c1 3 5 7 10 7 1.7 0 3.3-.5 4.7-1.3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <svg
        v-else
        class="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <path d="M2 12c1-3 5-7 10-7s9 4 10 7c-1 3-5 7-10 7S3 15 2 12Z" stroke-linejoin="round" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  </div>
</template>
