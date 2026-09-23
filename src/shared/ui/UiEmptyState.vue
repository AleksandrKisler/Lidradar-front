<script setup lang="ts">
/**
 * Пустое состояние. Показывается только после успешного ответа с пустым
 * результатом: ошибка загрузки и отсутствие данных — разные композиции.
 */
withDefaults(defineProps<{ title: string; description?: string | undefined }>(), {
  description: '',
})
</script>

<template>
  <div class="flex flex-col items-center px-6 py-12 text-center">
    <div v-if="$slots.icon" class="mb-4 text-brand" aria-hidden="true"><slot name="icon" /></div>
    <h2 class="text-xl font-bold text-ink">{{ title }}</h2>
    <p v-if="description" class="mt-2 max-w-md text-sm leading-6 text-muted">{{ description }}</p>
    <div v-if="$slots.actions" class="mt-6 flex flex-wrap justify-center gap-3">
      <slot name="actions" />
    </div>
  </div>
</template>
