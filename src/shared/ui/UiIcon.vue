<script setup lang="ts">
/**
 * Иконка Material Symbols Outlined. По умолчанию декоративная и скрыта от
 * скринридеров; смысл всегда несёт соседний текст или `aria-label` кнопки.
 * Размер задаётся классом `size-*`, цвет — `currentColor`.
 */
import { computed } from 'vue'
import { ICON_PATHS, type IconName } from './icons'

const props = defineProps<{ name: IconName }>()

const path = computed(() => ICON_PATHS[props.name])
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
    <path :d="path" />
  </svg>
</template>
