<script setup lang="ts">
/** Лента переписки: клиент слева, бизнес справа, паузы подписями; внизу — линия «сейчас». */
import { UiIcon } from '@/shared/ui'
import { formatMoment } from '@/entities/sandbox'
import type { TimelineItem } from '../model/view'

defineProps<{
  items: readonly TimelineItem[]
  timeZone: string
  now: Date
  editable: boolean
}>()
const emit = defineEmits<{ remove: [index: number] }>()
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex justify-between text-xs font-medium text-muted" aria-hidden="true">
      <span>Клиент</span><span>Ваш бизнес</span>
    </div>
    <div class="flex flex-col gap-3" role="list" aria-label="Сообщения">
      <template v-for="item in items" :key="item.key">
        <p v-if="item.kind === 'gap'" class="text-center text-xs text-muted" role="listitem">
          {{ item.label }}
        </p>
        <div
          v-else
          role="listitem"
          :class="['flex items-end gap-2', item.direction === 'OUTGOING' ? 'flex-row-reverse' : '']"
        >
          <div
            :class="[
              'flex max-w-[78%] min-w-0 flex-col gap-1',
              item.direction === 'OUTGOING' ? 'items-end' : 'items-start',
            ]"
          >
            <p
              :class="[
                'rounded-card px-4 py-2.5 text-sm break-words whitespace-pre-line',
                item.direction === 'OUTGOING'
                  ? 'rounded-br-md bg-brand-pale text-ink'
                  : 'rounded-bl-md bg-canvas text-ink',
              ]"
            >
              {{ item.text }}
            </p>
            <span class="px-1 text-xs text-muted">
              {{ item.direction === 'OUTGOING' ? 'Бизнес' : 'Клиент' }} ·
              {{ formatMoment(item.at, timeZone, now) }}{{ item.sent ? ' · отправлено' : '' }}
            </span>
          </div>
          <button
            v-if="editable && item.draftIndex !== null"
            type="button"
            class="mb-6 flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
            :aria-label="`Удалить сообщение ${item.draftIndex + 1}`"
            @click="emit('remove', item.draftIndex)"
          >
            <UiIcon name="close" class="size-4" />
          </button>
        </div>
      </template>
    </div>
    <slot name="tail" />
    <div class="flex items-center gap-3 text-xs font-semibold text-brand-dark">
      <span class="h-px flex-1 bg-brand/40" />сейчас<span class="h-px flex-1 bg-brand/40" />
    </div>
  </div>
</template>
