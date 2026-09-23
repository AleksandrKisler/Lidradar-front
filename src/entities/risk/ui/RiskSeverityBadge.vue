<script setup lang="ts">
/** Метка важности риска с текстом: цвет дублирует, а не заменяет подпись. */
import { computed } from 'vue'
import { UiBadge } from '@/shared/ui'
import { severityLabel, severityTone } from '../model/labels'

const props = defineProps<{ severity: string }>()
const label = computed(() => severityLabel(props.severity))
const tone = computed(() => severityTone(props.severity))
</script>

<template>
  <UiBadge :tone="tone">{{ label }}</UiBadge>
</template>
