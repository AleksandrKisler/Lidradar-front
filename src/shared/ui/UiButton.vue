<script setup lang="ts">
/**
 * Кнопка действия по макету «Основы интерфейса»: высота 44, радиус 12,
 * варианты «основное», «вторичное», «опасное», «мягкое».
 *
 * Состояние `loading` блокирует повторную отправку и объявляет занятость
 * (`aria-busy`), не меняя доступное имя кнопки.
 */
import UiSpinner from './UiSpinner.vue'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
    size?: 'md' | 'sm'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
    /** Растянуть на всю ширину контейнера. */
    block?: boolean
  }>(),
  { variant: 'primary', size: 'md', type: 'button', disabled: false, loading: false, block: false },
)

const variants = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  secondary: 'border border-line bg-paper text-ink hover:bg-canvas',
  danger: 'bg-danger text-white hover:bg-[#b32420]',
  // Тёмный оттенок: на серой канве и в подсветках контраст остаётся не ниже 4.5:1.
  ghost: 'bg-transparent text-brand-dark hover:bg-brand-pale',
} as const

const sizes = {
  md: 'h-11 px-5 text-sm',
  sm: 'h-9 px-3.5 text-sm',
} as const
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    :class="[
      'inline-flex items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60',
      variants[variant],
      sizes[size],
      block ? 'w-full' : '',
    ]"
  >
    <UiSpinner v-if="loading" class="size-4 shrink-0" />
    <slot />
  </button>
</template>
