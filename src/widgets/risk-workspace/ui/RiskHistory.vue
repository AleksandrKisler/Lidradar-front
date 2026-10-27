<script setup lang="ts">
/**
 * История рабочего пространства (Figma 212:2623): обнаружение риска, этапы
 * сделки, действия и исход по убыванию времени. Записи не редактируются и не
 * удаляются — только дополняются. Время — в часовом поясе организации.
 */
import { computed } from 'vue'
import { dayKey, formatDay, formatTime, plural } from '@/shared/lib'

export interface RiskTimelineEntry {
  id: string
  kind: 'detected' | 'stage' | 'action' | 'outcome'
  title: string
  /** Основание события: причина, источник перехода, тип записи. */
  detail: string
  createdAt: string
}

const props = defineProps<{ entries: RiskTimelineEntry[]; timeZone: string }>()

const rows = computed(() =>
  [...props.entries].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  ),
)
/** Дата показывается, когда события лежат в разных днях организации. */
const spansDays = computed(
  () => new Set(rows.value.map((entry) => dayKey(entry.createdAt, props.timeZone))).size > 1,
)
const recorded = computed(
  () => rows.value.filter((entry) => entry.kind === 'action' || entry.kind === 'outcome').length,
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-4">
      <h2 id="risk-history-title" class="text-[17px] leading-6 font-semibold text-ink">История</h2>
      <p class="text-sm leading-5 text-muted">
        {{ rows.length }} {{ plural(rows.length, 'событие', 'события', 'событий') }}
      </p>
    </div>
    <ol class="flex flex-col divide-y divide-line" aria-label="История">
      <li
        v-for="entry in rows"
        :key="`${entry.kind}-${entry.id}`"
        class="flex gap-4 py-4 text-sm leading-5 first:pt-0"
      >
        <time
          :datetime="entry.createdAt"
          :class="['shrink-0 text-muted', spansDays ? 'w-[96px]' : 'w-[52px]']"
          >{{ spansDays ? `${formatDay(entry.createdAt, timeZone)}, ` : ''
          }}{{ formatTime(entry.createdAt, timeZone) }}</time
        >
        <div class="flex min-w-0 flex-col gap-1">
          <p class="font-medium text-ink">{{ entry.title }}</p>
          <p class="text-muted">{{ entry.detail }}</p>
        </div>
      </li>
    </ol>
    <p v-if="!recorded" class="-mt-4 text-sm leading-5 text-muted">Действий и исходов пока нет.</p>
  </div>
</template>
