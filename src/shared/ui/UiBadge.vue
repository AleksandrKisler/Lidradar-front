<script setup lang="ts">
/**
 * Метка состояния. Цвет никогда не является единственным носителем
 * смысла: текст метки обязателен.
 */
withDefaults(
  defineProps<{ tone?: 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info' }>(),
  { tone: 'neutral' },
)

const tones = {
  neutral: 'bg-canvas text-muted border-line',
  brand: 'bg-brand-pale text-brand-dark border-brand/20',
  success: 'bg-success-pale text-success border-success/20',
  danger: 'bg-danger-pale text-danger border-danger/20',
  warning: 'bg-warning-pale text-warning border-warning/20',
  info: 'bg-info-pale text-info border-info/20',
} as const
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
      tones[tone],
    ]"
  >
    <slot />
  </span>
</template>
