<script setup lang="ts">
/** Заголовок страницы: надзаголовок, название раздела, пояснение и действия. */
withDefaults(
  defineProps<{ title: string; subtitle?: string | undefined; eyebrow?: string | undefined }>(),
  {
    subtitle: '',
    eyebrow: '',
  },
)
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p v-if="eyebrow" class="text-xs font-semibold tracking-wide text-muted">
        {{ eyebrow }}
      </p>
      <h1 class="text-2xl font-bold text-ink md:text-3xl">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-muted">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-3">
      <slot name="actions" />
    </div>
  </header>
</template>
