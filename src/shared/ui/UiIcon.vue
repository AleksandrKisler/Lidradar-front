<script setup lang="ts">
/**
 * Иконка Material Symbols Outlined. По умолчанию декоративная и скрыта от
 * скринридеров; смысл всегда несёт соседний текст или `aria-label` кнопки.
 * Размер задаётся классом `size-*`, цвет — `currentColor`.
 */
import type { IconName } from './icons'
import sprite from './assets/material-icons.svg?no-inline'

const props = defineProps<{ name: IconName }>()
</script>

<template>
  <svg
    width="24"
    height="24"
    class="shrink-0"
    viewBox="0 -960 960 960"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <use :href="`${sprite}#${props.name}`" />
  </svg>
</template>
