<script setup lang="ts">
/**
 * Одно сообщение. Направление читается по подписи автора, а не только по
 * выравниванию; удалённое у поставщика сообщение показывает заглушку;
 * вложения — метаданные без ссылки на скачивание.
 */
import { computed } from 'vue'
import { formatDateTime, formatTime } from '@/shared/lib'
import type { MessageBubbleViewModel } from '@/entities/conversation'

const props = defineProps<{ bubble: MessageBubbleViewModel; timeZone: string }>()

const alignment = computed(() => {
  switch (props.bubble.direction) {
    case 'OUTGOING':
      return 'self-end bg-brand-pale'
    case 'SYSTEM':
      return 'self-center bg-canvas text-ink/70'
    default:
      return 'self-start bg-paper border border-line'
  }
})
</script>

<template>
  <li
    :class="['flex w-full max-w-[85%] flex-col gap-1 rounded-card px-4 py-3 text-sm', alignment]"
    :aria-label="`${bubble.author}, ${formatDateTime(bubble.sentAt, timeZone)}`"
  >
    <span class="text-xs font-semibold text-ink/70">{{ bubble.author }}</span>
    <p v-if="bubble.deleted" class="text-ink/70 italic">Сообщение удалено в мессенджере.</p>
    <template v-else>
      <p v-if="bubble.text" class="break-words whitespace-pre-line text-ink">{{ bubble.text }}</p>
      <p v-else-if="bubble.type !== 'TEXT' && !bubble.attachments.length" class="text-ink/70">
        {{ bubble.typeLabel }}
      </p>
      <ul v-if="bubble.attachments.length" class="flex flex-col gap-1" aria-label="Вложения">
        <li
          v-for="attachment in bubble.attachments"
          :key="attachment.id"
          class="flex flex-wrap items-center gap-x-2 rounded-field border border-dashed border-line px-2.5 py-1.5 text-xs text-ink/70"
        >
          <span class="font-semibold text-ink">{{ attachment.label }}</span>
          <span>{{ attachment.size }}</span>
          <span>· Вложение недоступно в LidRadar</span>
        </li>
      </ul>
    </template>
    <time :datetime="bubble.sentAt" class="self-end text-[11px] text-ink/70">
      {{ formatTime(bubble.sentAt, timeZone) }}
    </time>
  </li>
</template>
