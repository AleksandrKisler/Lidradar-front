<script setup lang="ts">
/**
 * Переход во внешний канал по ссылке, построенной сервером. Если у
 * пользователя есть право записывать действия, переход фиксируется как
 * действие `OPEN_CONVERSATION` — после клика по реальной ссылке, не раньше.
 * Повторный клик при неизвестном результате использует прежний ключ.
 */
import { computed } from 'vue'
import { describeError } from '@/shared/api'
import { UiButton } from '@/shared/ui'
import type { Action } from '@/entities/risk'
import { useRecordAction } from '../model/use-record-action'

const props = withDefaults(
  defineProps<{ url: string; riskId: string; canRecord: boolean; label?: string | undefined }>(),
  { label: 'Открыть в Telegram' },
)
const emit = defineEmits<{ recorded: [action: Action] }>()

const record = useRecordAction(() => props.riskId)

const statusText = computed(() => {
  switch (record.status.value) {
    case 'pending':
      return 'Записываем переход…'
    case 'success':
      return record.result.value?.replayed
        ? 'Переход уже был записан.'
        : 'Переход записан как действие.'
    case 'error':
      return `Переход не записан: ${describeError(record.error.value).description}`
    case 'unknown':
      return 'Не удалось подтвердить запись перехода.'
    default:
      return null
  }
})

async function onClick(): Promise<void> {
  if (!props.canRecord) return
  const result = await record.submit({ type: 'OPEN_CONVERSATION' })
  if (result) emit('recorded', result.action)
}

async function retry(): Promise<void> {
  const result = await record.retry()
  if (result) emit('recorded', result.action)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <a
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex h-11 items-center justify-center rounded-control bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark"
      @click="onClick"
    >
      {{ label }}
    </a>
    <p v-if="statusText" class="text-sm text-muted" role="status">{{ statusText }}</p>
    <UiButton v-if="record.canRetry.value" size="sm" variant="secondary" @click="retry">
      Повторить запись перехода
    </UiButton>
  </div>
</template>
