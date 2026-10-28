<script setup lang="ts">
/**
 * Заголовок карточки гостевых страниц Access (Figma «Восстановление пароля», «Новый пароль»,
 * «Ссылка восстановления», «Подтверждение почты»): надпись над заголовком, заголовок и пояснение.
 * `danger` окрашивает надпись в красный — признак отклонённой ссылки.
 */
defineProps<{
  eyebrow: string
  title: string
  description?: string | undefined
  danger?: boolean | undefined
}>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <p :class="['text-meta font-medium', danger ? 'text-danger' : 'text-secondary']">
      {{ eyebrow }}
    </p>
    <h1
      tabindex="-1"
      class="text-metric font-semibold text-ink focus:outline-none md:text-4xl md:leading-10"
    >
      {{ title }}
    </h1>
    <p
      v-if="description"
      class="text-note break-words text-secondary"
      data-testid="auth-card-description"
    >
      {{ description }}
    </p>
    <slot />
  </div>
</template>
