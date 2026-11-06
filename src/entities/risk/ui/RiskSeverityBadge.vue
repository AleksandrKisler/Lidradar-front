<script setup lang="ts">
/**
 * Метка важности риска (Figma 267:3676): иконка и текст на цветной «таблетке».
 * Цвет дублирует, а не заменяет подпись: у «Средний» и «Низкий» цвета в
 * эталоне совпадают (27:2667, 267:3796), различает их текст.
 */
import { computed } from 'vue'
import { UiGlyph } from '@/shared/ui'
import { severityLabel } from '../model/labels'

const props = defineProps<{ severity: string }>()
const label = computed(() => severityLabel(props.severity))
const classes = computed(() => {
  switch (props.severity) {
    case 'CRITICAL':
      return 'bg-sev-critical-bg text-sev-critical'
    case 'HIGH':
      return 'bg-sev-high-bg text-sev-high'
    case 'MEDIUM':
      return 'bg-sev-medium-bg text-sev-medium'
    default:
      return 'bg-sev-low-bg text-sev-low'
  }
})
</script>

<template>
  <span
    :class="[
      'inline-flex h-7 items-center gap-1 rounded-full px-3 text-meta font-medium whitespace-nowrap',
      classes,
    ]"
  >
    <UiGlyph name="circle-alert" class="size-4" />{{ label }}
  </span>
</template>
