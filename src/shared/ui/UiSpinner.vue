<script setup lang="ts">
/**
 * Индикатор выполнения. Декоративный по умолчанию: смысл состояния передаёт
 * текст рядом (`aria-busy` у кнопки, `role="status"` у блока загрузки).
 */
withDefaults(defineProps<{ label?: string }>(), { label: '' })
</script>

<template>
  <svg
    class="animate-spin"
    viewBox="0 0 24 24"
    fill="none"
    :aria-hidden="label ? undefined : 'true'"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
  >
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
    <path
      class="opacity-90"
      d="M22 12a10 10 0 0 1-10 10"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
    />
  </svg>
</template>
