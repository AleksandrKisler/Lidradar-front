<script setup lang="ts">
/**
 * Ненавязчивый индикатор потока сигналов. Живое соединение не означает
 * актуальности данных, поэтому текст говорит только о канале обновлений;
 * потеря потока — предупреждение с советом обновлять вручную, не ошибка.
 */
import { computed } from 'vue'
import { useRealtimeState } from '@/shared/api'

const state = useRealtimeState()

const view = computed(() => {
  switch (state.value) {
    case 'connecting':
      return { text: 'Подключаем обновления…', tone: 'muted' as const }
    case 'open':
      return { text: 'Обновления онлайн', tone: 'ok' as const }
    case 'backoff':
      return { text: 'Обновления недоступны: обновляйте вручную', tone: 'warn' as const }
    case 'offline':
      return { text: 'Нет сети: данные могут устареть', tone: 'warn' as const }
    default:
      return null
  }
})

const classes = {
  muted: 'border-line text-muted',
  ok: 'border-success/30 bg-success-pale text-success',
  warn: 'border-warning/40 bg-warning-pale text-warning',
} as const
</script>

<template>
  <p
    v-if="view"
    role="status"
    :class="[
      'inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
      classes[view.tone],
    ]"
  >
    <span aria-hidden="true" class="size-1.5 rounded-full bg-current" />
    {{ view.text }}
  </p>
</template>
