<script setup lang="ts">
/**
 * Заголовок страницы без боковой панели по макетам «Рабочие пространства» и «Принять приглашение»:
 * крупный заголовок и пояснение по центру над карточкой. Заголовок получает фокус программно.
 */
defineProps<{
  title: string
  description: string
  /** Узкое пояснение (макет «Рабочие пространства»): строка около 500 px. */
  narrow?: boolean
}>()
</script>

<template>
  <div class="mb-6 flex flex-col items-center gap-3 text-center md:mb-9">
    <h1
      tabindex="-1"
      class="text-metric font-semibold text-ink focus:outline-none md:text-4xl lg:text-display"
      data-testid="page-intro-title"
    >
      {{ title }}
    </h1>
    <p
      :class="[
        'text-field leading-[25px] text-secondary',
        narrow ? 'max-w-[500px]' : 'max-w-[586px]',
      ]"
    >
      {{ description }}
    </p>
  </div>
</template>
