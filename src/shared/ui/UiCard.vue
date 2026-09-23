<script setup lang="ts">
/** Светлая поверхность с рамкой и радиусом карточки из макета. */
withDefaults(defineProps<{ as?: 'div' | 'section' | 'article' | 'li'; padded?: boolean }>(), {
  as: 'div',
  padded: true,
})
</script>

<template>
  <component
    :is="as"
    :class="['rounded-card border border-line bg-paper', padded ? 'p-5 md:p-6' : '']"
  >
    <slot />
  </component>
</template>
