<script setup lang="ts">
/** Local analytical read error; the caller owns the query and its retry. */
import { computed } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { UiButton } from '@/shared/ui'

const props = withDefaults(
  defineProps<{
    error: unknown
    title: string
    description?: string
    embedded?: boolean
  }>(),
  {
    description: 'Проверьте соединение и повторите загрузку этого блока.',
    embedded: false,
  },
)
const emit = defineEmits<{ retry: [] }>()
const message = computed(() => {
  if (isApiError(props.error) && [400, 401, 403, 404, 429].includes(props.error.httpStatus))
    return describeError(props.error).description
  return props.description
})
</script>

<template>
  <div role="alert" class="analytics-error" :class="{ 'analytics-error-card': !embedded }">
    <component :is="embedded ? 'h3' : 'h2'">{{ title }}</component>
    <p>{{ message }}</p>
    <UiButton variant="secondary" class="w-[240px] max-w-full" @click="emit('retry')"
      >Повторить</UiButton
    >
  </div>
</template>

<style scoped>
.analytics-error {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  color: var(--color-ink);
}
.analytics-error-card {
  padding: 24px;
  border: 1px solid var(--color-analytics-line);
  border-radius: 16px;
  background: var(--color-paper);
}
h2,
h3 {
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}
p {
  font-size: 14px;
  line-height: 20px;
}
</style>
