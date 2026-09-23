<script setup lang="ts">
/**
 * Состояние ошибки запроса: понятное объяснение по коду, повтор и
 * технические детали для поддержки. Серверный текст не выводится.
 */
import { computed } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import UiButton from './UiButton.vue'

const props = withDefaults(
  defineProps<{
    error: unknown
    /** Переопределяет заголовок по умолчанию. */
    title?: string | undefined
    retryLabel?: string | undefined
    /** Скрыть кнопку повтора, если повтор не имеет смысла. */
    retryable?: boolean | undefined
  }>(),
  { title: '', retryLabel: 'Повторить', retryable: true },
)

const emit = defineEmits<{ retry: [] }>()

const description = computed(() => describeError(props.error))
const technical = computed(() => {
  if (!isApiError(props.error)) return null
  return { code: props.error.code, status: props.error.httpStatus, traceId: props.error.traceId }
})
</script>

<template>
  <div role="alert" class="rounded-card border border-danger/30 bg-paper p-6">
    <h2 class="text-lg font-bold text-ink">{{ title || description.title }}</h2>
    <p class="mt-2 text-sm leading-6 text-muted">{{ description.description }}</p>
    <div class="mt-5 flex flex-wrap items-center gap-4">
      <UiButton v-if="retryable" variant="secondary" @click="emit('retry')">{{
        retryLabel
      }}</UiButton>
      <details v-if="technical" class="text-xs text-muted">
        <summary class="cursor-pointer select-none">Технические детали</summary>
        <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt>Код</dt>
          <dd>
            <code>{{ technical.code }}</code>
          </dd>
          <dt>HTTP</dt>
          <dd>
            <code>{{ technical.status || '—' }}</code>
          </dd>
          <dt>Трассировка</dt>
          <dd>
            <code class="select-all">{{ technical.traceId || '—' }}</code>
          </dd>
        </dl>
      </details>
    </div>
  </div>
</template>
