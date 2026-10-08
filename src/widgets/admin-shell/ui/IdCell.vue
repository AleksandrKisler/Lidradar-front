<script setup lang="ts">
/** Идентификатор объекта: сокращённый показ, полное значение в подсказке и кнопка копирования. */
import { ref } from 'vue'
import { UiIcon } from '@/shared/ui'
import { shortId } from '@/entities/admin'

const props = defineProps<{ value: string | null | undefined }>()
const copied = ref(false)

async function copy(): Promise<void> {
  if (!props.value) return
  try {
    await navigator.clipboard.writeText(props.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <span v-if="value" class="inline-flex items-center gap-1">
    <code class="text-xs text-ink" :title="value">{{ shortId(value) }}</code>
    <button
      type="button"
      class="inline-flex size-6 items-center justify-center rounded text-brand-dark hover:bg-brand-pale"
      :aria-label="`Скопировать ${value}`"
      @click="copy"
    >
      <UiIcon :name="copied ? 'check' : 'content-copy'" class="size-4" />
    </button>
  </span>
  <span v-else class="text-xs text-muted">—</span>
</template>
