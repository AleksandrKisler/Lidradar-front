<script setup lang="ts">
/**
 * Строка списка переписок: контакт, время последнего сообщения, превью с
 * направлением и бейдж активных рисков. Вся строка — ссылка на переписку;
 * фильтры остаются в адресе.
 */
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { formatDateTime, formatTime, dayKey } from '@/shared/lib'
import { UiBadge } from '@/shared/ui'
import type { ConversationRowViewModel } from '@/entities/conversation'

const props = defineProps<{
  row: ConversationRowViewModel
  timeZone: string
  now: Date
  selected: boolean
}>()

const route = useRoute()

/** Сегодняшние сообщения — только время, остальные — дата и время. */
const lastLabel = computed(() => {
  if (!props.row.lastAt) return null
  return dayKey(props.row.lastAt, props.timeZone) === dayKey(props.now, props.timeZone)
    ? formatTime(props.row.lastAt, props.timeZone)
    : formatDateTime(props.row.lastAt, props.timeZone)
})

const previewPrefix = computed(() => {
  switch (props.row.previewDirection) {
    case 'OUTGOING':
      return 'Вы: '
    case 'SYSTEM':
      return 'Система: '
    default:
      return ''
  }
})
</script>

<template>
  <li>
    <RouterLink
      :to="{ name: 'conversation', params: { conversationId: row.id }, query: route.query }"
      :aria-current="selected ? 'page' : undefined"
      :class="[
        'flex gap-3 rounded-control border px-3 py-3 transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        // Выбранная строка на светлой канве: серый текст превью сохраняет контраст 4.5:1.
        selected ? 'border-brand bg-canvas' : 'border-transparent',
      ]"
    >
      <span
        aria-hidden="true"
        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-pale text-xs font-bold text-brand-dark"
      >
        {{ row.initials }}
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="flex items-baseline justify-between gap-3">
          <span class="truncate text-sm font-semibold text-ink">{{ row.contactName }}</span>
          <time
            v-if="lastLabel && row.lastAt"
            :datetime="row.lastAt"
            class="shrink-0 text-xs text-muted"
          >
            {{ lastLabel }}
          </time>
        </span>
        <span class="truncate text-sm text-muted">
          <template v-if="row.preview">{{ previewPrefix }}{{ row.preview }}</template>
          <template v-else>Сообщений пока нет</template>
        </span>
        <span class="flex flex-wrap items-center gap-2 text-xs text-muted">
          <UiBadge :tone="row.risks.tone">{{ row.risks.label }}</UiBadge>
          <span class="truncate">{{ row.channelName }}</span>
        </span>
      </span>
    </RouterLink>
  </li>
</template>
