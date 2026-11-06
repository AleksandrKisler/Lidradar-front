<script setup lang="ts">
/**
 * История рабочего пространства (Figma 212:2623): обнаружение риска, этапы
 * сделки и действия по убыванию времени. Последний исход сделки показан
 * отдельным блоком: API отдаёт только его, а не журнал всех исходов, и заметок
 * повторно не отдаёт — полным журналом этот список не называется. Время — в
 * часовом поясе организации.
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

const newestFirst = (left: RiskTimelineEntry, right: RiskTimelineEntry) =>
  Date.parse(right.createdAt) - Date.parse(left.createdAt)
const rows = computed(() =>
  props.entries.filter((entry) => entry.kind !== 'outcome').sort(newestFirst),
)
const lastOutcome = computed(
  () => props.entries.filter((entry) => entry.kind === 'outcome').sort(newestFirst)[0] ?? null,
)
/** Дата показывается, когда события лежат в разных днях организации. */
const spansDays = computed(
  () => new Set(rows.value.map((entry) => dayKey(entry.createdAt, props.timeZone))).size > 1,
)
const recorded = computed(() => rows.value.filter((entry) => entry.kind === 'action').length)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-4">
      <h2 id="risk-history-title" class="text-[17px] leading-6 font-semibold text-ink">История</h2>
      <p class="text-sm leading-5 text-muted">
        {{ rows.length }} {{ plural(rows.length, 'событие', 'события', 'событий') }}
      </p>
    </div>
    <div
      class="flex flex-col gap-1 rounded-field bg-canvas px-4 py-3 text-sm leading-5"
      role="group"
      aria-labelledby="risk-last-outcome-title"
    >
      <p id="risk-last-outcome-title" class="text-muted">Последний исход сделки</p>
      <template v-if="lastOutcome">
        <p class="font-medium text-ink">{{ lastOutcome.title }}</p>
        <time :datetime="lastOutcome.createdAt" class="text-muted"
          >{{ formatDay(lastOutcome.createdAt, timeZone) }},
          {{ formatTime(lastOutcome.createdAt, timeZone) }}</time
        >
      </template>
      <p v-else class="font-medium text-ink">Исход не записан</p>
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
    <p v-if="!recorded" class="-mt-4 text-sm leading-5 text-muted">Действий пока нет.</p>
    <p class="text-xs leading-[18px] text-muted">
      Здесь показаны этапы и действия, доступные в карточке. Прежние исходы и заметки отсюда не
      читаются.
    </p>
  </div>
</template>
