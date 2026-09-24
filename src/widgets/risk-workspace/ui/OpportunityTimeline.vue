<script setup lang="ts">
/**
 * Неизменяемая история этапов сделки от новых к старым: откуда и куда,
 * источник перехода (правило, AI, вручную, импорт) и уверенность модели,
 * если она есть. Записи только добавляются.
 */
import { computed } from 'vue'
import { formatDateTime } from '@/shared/lib'
import { UiBadge } from '@/shared/ui'
import {
  opportunityStageLabel,
  stageSourceLabel,
  type OpportunityStageHistory,
} from '@/entities/risk'

const props = defineProps<{ entries: OpportunityStageHistory[]; timeZone: string }>()

const rows = computed(() =>
  [...props.entries].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
)
</script>

<template>
  <ol v-if="rows.length" class="flex flex-col divide-y divide-line" aria-label="История этапов">
    <li
      v-for="entry in rows"
      :key="entry.id"
      class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm"
    >
      <span class="flex flex-wrap items-center gap-2">
        <span class="text-ink">
          <template v-if="entry.fromStage">
            {{ opportunityStageLabel(entry.fromStage) }} →
            {{ opportunityStageLabel(entry.toStage) }}
          </template>
          <template v-else>Создана как «{{ opportunityStageLabel(entry.toStage) }}»</template>
        </span>
        <UiBadge :tone="entry.source === 'USER' ? 'brand' : 'neutral'">
          {{ stageSourceLabel(entry.source) }}
        </UiBadge>
        <span v-if="entry.confidence !== null" class="text-xs text-muted">
          уверенность {{ Math.round(entry.confidence * 100) }} %
        </span>
      </span>
      <time :datetime="entry.createdAt" class="text-muted">
        {{ formatDateTime(entry.createdAt, timeZone) }}
      </time>
    </li>
  </ol>
  <p v-else class="text-sm text-muted">История этапов пока пуста.</p>
</template>
