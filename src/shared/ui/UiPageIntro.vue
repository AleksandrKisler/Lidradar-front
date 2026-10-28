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
  /** Плотная подача (макет «Начало работы»): строка около 450 px, меньший отступ под пояснением. */
  compact?: boolean
  /** Широкое пояснение (макет «Точка и график»): строка около 640 px. */
  wide?: boolean
}>()
</script>

<template>
  <div
    :class="[
      'flex flex-col items-center gap-3 text-center',
      compact || wide ? 'mb-4 md:mb-[30px]' : 'mb-6 md:mb-9',
    ]"
  >
    <h1
      tabindex="-1"
      class="text-metric font-semibold text-ink focus:outline-none md:text-4xl lg:text-display"
      data-testid="page-intro-title"
    >
      {{ title }}
    </h1>
    <p
      :class="[
        'text-field leading-[25px] text-secondary md:whitespace-pre-line',
        wide
          ? 'max-w-[640px]'
          : compact
            ? 'max-w-[450px]'
            : narrow
              ? 'max-w-[500px]'
              : 'max-w-[586px]',
      ]"
    >
      {{ description }}
    </p>
  </div>
</template>
