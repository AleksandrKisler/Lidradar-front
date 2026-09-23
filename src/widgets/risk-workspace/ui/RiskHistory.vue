<script setup lang="ts">
/**
 * Неизменяемая история рабочего пространства: действия и исход по убыванию
 * времени. Записи не редактируются и не удаляются — только дополняются.
 */
import { formatDateTime } from '@/shared/lib'
import { UiBadge } from '@/shared/ui'
import type { RiskHistoryEntry } from '@/entities/risk'

defineProps<{ entries: RiskHistoryEntry[]; timeZone: string }>()
</script>

<template>
  <ol v-if="entries.length" class="flex flex-col divide-y divide-line" aria-label="История">
    <li
      v-for="entry in entries"
      :key="`${entry.kind}-${entry.id}`"
      class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm"
    >
      <span class="flex items-center gap-2">
        <UiBadge :tone="entry.kind === 'outcome' ? 'success' : 'neutral'">
          {{ entry.kind === 'outcome' ? 'Исход' : 'Действие' }}
        </UiBadge>
        <span class="text-ink">{{ entry.label }}</span>
      </span>
      <time :datetime="entry.createdAt" class="text-muted">
        {{ formatDateTime(entry.createdAt, timeZone) }}
      </time>
    </li>
  </ol>
  <p v-else class="text-sm text-muted">Действий и исходов по этому риску ещё нет.</p>
</template>
