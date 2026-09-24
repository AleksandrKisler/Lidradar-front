<script setup lang="ts">
/**
 * Светлая поверхность с рамкой и радиусом карточки из макета. `min-w-0`
 * позволяет карточке сжиматься в колонках flex/grid, чтобы широкие таблицы
 * прокручивались внутри своей области, а не растягивали страницу.
 */
withDefaults(defineProps<{ as?: 'div' | 'section' | 'article' | 'li'; padded?: boolean }>(), {
  as: 'div',
  padded: true,
})
</script>

<template>
  <component
    :is="as"
    :class="['min-w-0 rounded-card border border-line bg-paper', padded ? 'p-5 md:p-6' : '']"
  >
    <slot />
  </component>
</template>
