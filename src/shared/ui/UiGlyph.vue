<script setup lang="ts">
/**
 * Контурная иконка из экспорта Figma (assets/*.svg), закрашенная `currentColor`.
 * Файл не перерисовывается: он используется как маска, поэтому цвет задаёт
 * класс `text-*` (активный раздел, приглушённый текст). Иконка декоративна;
 * смысл несёт соседний текст или `aria-label` кнопки.
 */
import { computed } from 'vue'
import { GLYPHS, type GlyphName } from './glyphs'

const props = defineProps<{ name: GlyphName }>()
const url = computed(() => `url("${GLYPHS[props.name]}")`)
</script>

<template>
  <span
    class="inline-block shrink-0 bg-current"
    :style="{
      maskImage: url,
      maskSize: '100% 100%',
      maskRepeat: 'no-repeat',
      WebkitMaskImage: url,
      WebkitMaskSize: '100% 100%',
      WebkitMaskRepeat: 'no-repeat',
    }"
    aria-hidden="true"
  />
</template>
