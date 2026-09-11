<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'primary' | 'secondary'; disabled?: boolean }>(), {
  variant: 'primary',
  disabled: false,
})
</script>
<template>
  <button
    type="button"
    :disabled="disabled"
    :class="
      variant === 'primary'
        ? 'bg-brand text-white hover:bg-indigo-700'
        : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
    "
    class="rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
  >
    <slot />
  </button>
</template>
