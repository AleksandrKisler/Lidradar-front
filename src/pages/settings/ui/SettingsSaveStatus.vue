<script setup lang="ts">
import { computed } from 'vue'
import { UiGlyph } from '@/shared/ui'
const props = defineProps<{
  status: 'saving' | 'saved' | 'error' | 'dirty' | 'idle'
  schedule?: boolean
}>()
const label = computed(
  () =>
    ({
      saving: 'Сохраняем…',
      saved: 'Сохранено',
      error: 'Ошибка сохранения',
      dirty: props.schedule ? 'Не сохранён' : 'Не сохранено',
      idle: 'Изменений нет',
    })[props.status],
)
</script>

<template>
  <span
    role="status"
    :style="{
      width: `${status === 'saving' ? 96 : status === 'error' ? 160 : status === 'dirty' ? (schedule ? 95 : 102) : 132}px`,
    }"
    :class="[
      'inline-flex h-7 min-w-max shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs leading-[18px] whitespace-nowrap',
      status === 'saved'
        ? 'bg-success-pale text-success'
        : status === 'error'
          ? 'bg-danger-pale text-danger-ink'
          : 'bg-canvas text-muted',
    ]"
    ><UiGlyph v-if="status === 'saved'" name="settings-saved" class="size-3.5" /><UiGlyph
      v-else-if="status === 'error'"
      name="circle-alert"
      class="size-3"
    />{{ label }}</span
  >
</template>
