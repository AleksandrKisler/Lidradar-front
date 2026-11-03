<script setup lang="ts">
import errorIcon from './assets/error.svg?no-inline'
withDefaults(
  defineProps<{
    title: string
    description?: string
    tone?: 'danger' | 'warning' | 'neutral'
    icon?: boolean
  }>(),
  { description: '', tone: 'danger', icon: true },
)
</script>

<template>
  <div
    :role="tone === 'danger' ? 'alert' : 'status'"
    class="integration-banner"
    :class="`integration-banner--${tone}`"
  >
    <div class="flex items-center gap-2">
      <img
        v-if="tone === 'danger' && icon"
        :src="errorIcon"
        width="20"
        height="20"
        alt=""
        class="shrink-0"
      />
      <p class="min-w-0 text-sm leading-5 font-medium break-words">{{ title }}</p>
    </div>
    <p v-if="description" class="text-sm leading-5 text-secondary">{{ description }}</p>
    <slot />
  </div>
</template>

<style scoped>
.integration-banner {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--color-analytics-line);
  border-radius: 12px;
  overflow-wrap: anywhere;
}
.integration-banner--danger {
  border-color: var(--color-danger);
  background: var(--color-danger-pale);
  color: var(--color-danger);
}
.integration-banner--warning {
  background: var(--color-warning-pale);
  color: var(--color-warning);
}
.integration-banner--neutral {
  background: var(--color-canvas);
  color: var(--color-ink);
}
</style>
