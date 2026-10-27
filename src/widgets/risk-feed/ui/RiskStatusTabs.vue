<script setup lang="ts">
/**
 * Статус активной ленты (Figma 21:1982): «Все риски», «Новые», «В работе».
 * Числа из макета не выводятся: сводка не содержит разбивки по статусам, а
 * считать их по загруженной странице нельзя. Вкладки только фильтруют ленту.
 */
import type { RiskFeedStatus } from '@/entities/risk'

defineProps<{ modelValue: RiskFeedStatus | null }>()
const emit = defineEmits<{ 'update:modelValue': [status: RiskFeedStatus | null] }>()

const tabs: { value: RiskFeedStatus | null; label: string }[] = [
  { value: null, label: 'Все риски' },
  { value: 'OPEN', label: 'Новые' },
  { value: 'ACKNOWLEDGED', label: 'В работе' },
]
</script>

<template>
  <div
    class="flex gap-1 rounded-field bg-segment p-1 max-lg:w-full"
    role="group"
    aria-label="Статус рисков"
  >
    <button
      v-for="tab in tabs"
      :key="tab.label"
      type="button"
      :aria-pressed="modelValue === tab.value"
      :class="[
        'h-8 rounded-field px-4 text-sm leading-5 font-medium max-lg:h-11 max-lg:flex-1 max-lg:px-2 max-lg:text-base',
        modelValue === tab.value
          ? 'border border-line bg-paper text-brand'
          : 'text-secondary hover:text-ink',
      ]"
      @click="emit('update:modelValue', tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
