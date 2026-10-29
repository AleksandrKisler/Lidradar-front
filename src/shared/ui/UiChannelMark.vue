<script setup lang="ts">
/** Знак источника переписки в карточке шага «Источник сообщений» (Figma): Telegram — синий круг, MAX — серый (недоступен). */
defineProps<{ kind: 'telegram' | 'max' }>()
</script>

<template>
  <svg viewBox="0 0 40 40" class="size-10 shrink-0" aria-hidden="true">
    <template v-if="kind === 'telegram'">
      <circle cx="20" cy="20" r="20" fill="#0088CC" />
      <path
        fill="#fff"
        d="M9.2 19.8 28.6 12.3c.9-.3 1.7.2 1.4 1.5l-3.3 15.5c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1.1.5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2l-11.5 7.2-5-1.5c-1.1-.3-1.1-1.1.2-1.6Z"
      />
    </template>
    <template v-else>
      <circle cx="20" cy="20" r="20" fill="#dededf" />
      <path
        fill="#6e6e73"
        d="M20 10.5c-5.3 0-9.5 3.9-9.5 8.8 0 2.6 1.2 4.8 3.1 6.4l-.5 4c-.1.7.6 1.1 1.2.8l3.6-2c.7.1 1.4.2 2.1.2 5.3 0 9.5-3.9 9.5-8.8S25.3 10.5 20 10.5Z"
      />
      <circle cx="20" cy="19.3" r="3.6" fill="#dededf" />
    </template>
  </svg>
</template>
