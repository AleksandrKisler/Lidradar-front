<script setup lang="ts">
/**
 * Переписка только для чтения: контакт и канал, история сообщений с
 * разделителями по дням и подгрузкой более старых сверху с сохранением
 * якоря прокрутки, безопасная внешняя ссылка. Composer намеренно
 * отсутствует: ответ клиенту — только во внешнем канале.
 */
import { computed, nextTick, ref, toRef, watch } from 'vue'
import { formatDay } from '@/shared/lib'
import { UiButton, UiCard, UiEmptyState, UiErrorState, UiSkeleton } from '@/shared/ui'
import { isApiError } from '@/shared/api'
import {
  connectionStatusLabel,
  contactLabel,
  orderOldestFirst,
  toMessageBubble,
  useConversationQuery,
  useMessagesQuery,
  type MessageBubbleViewModel,
} from '@/entities/conversation'
import { externalLinkUnavailableLabel } from '@/entities/risk'
import { anchoredScrollTop } from '../model/scroll'
import MessageBubble from './MessageBubble.vue'

const props = defineProps<{ tenantId: string; conversationId: string; timeZone: string }>()

const detail = useConversationQuery(toRef(props, 'tenantId'), toRef(props, 'conversationId'))
const messages = useMessagesQuery(toRef(props, 'tenantId'), toRef(props, 'conversationId'))

const notFound = computed(() => isApiError(detail.error.value) && detail.error.value.isNotFound)
const contactName = computed(() =>
  detail.data.value ? contactLabel(detail.data.value.contact) : null,
)
const channelLine = computed(() => {
  const channel = detail.data.value?.channel
  if (!channel) return null
  return `${channel.name} · ${connectionStatusLabel(channel.status)}`
})
const externalUrl = computed(() => detail.data.value?.externalLink.url ?? null)
const unavailableText = computed(() =>
  detail.data.value
    ? externalLinkUnavailableLabel(detail.data.value.externalLink.unavailableReason)
    : null,
)

const bubbles = computed(() =>
  orderOldestFirst(messages.data.value?.pages ?? []).map(toMessageBubble),
)

/** Сообщения по дням в порядке чтения. */
const groups = computed(() => {
  const result: { key: string; label: string; items: MessageBubbleViewModel[] }[] = []
  for (const bubble of bubbles.value) {
    const label = formatDay(bubble.sentAt, props.timeZone) ?? ''
    const last = result.at(-1)
    if (last && last.label === label) last.items.push(bubble)
    else result.push({ key: `${label}-${bubble.id}`, label, items: [bubble] })
  }
  return result
})

const container = ref<HTMLElement | null>(null)

// Первая загрузка: прокрутка к последнему сообщению.
watch(
  () =>
    [
      props.conversationId,
      messages.data.value?.pages.length === 1 && bubbles.value.length,
    ] as const,
  async () => {
    if (messages.data.value?.pages.length !== 1) return
    await nextTick()
    const element = container.value
    if (element) element.scrollTop = element.scrollHeight
  },
  { immediate: true },
)

/** Подгружает более старые сообщения, не сдвигая читаемое место. */
async function loadOlder(): Promise<void> {
  const element = container.value
  const previousTop = element?.scrollTop ?? 0
  const previousHeight = element?.scrollHeight ?? 0
  await messages.fetchNextPage()
  await nextTick()
  if (element) {
    element.scrollTop = anchoredScrollTop(previousTop, previousHeight, element.scrollHeight)
  }
}
</script>

<template>
  <UiCard as="section" aria-labelledby="conversation-title" class="flex flex-col gap-4">
    <div
      v-if="detail.isPending.value"
      role="status"
      aria-label="Загрузка переписки"
      class="flex flex-col gap-3"
    >
      <UiSkeleton class="h-7 w-56" />
      <UiSkeleton class="h-4 w-40" />
      <UiSkeleton class="mt-4 h-48 w-full" />
    </div>

    <UiEmptyState
      v-else-if="notFound"
      title="Переписка не найдена"
      description="Её нет в этой организации или ссылка устарела."
    />

    <UiErrorState
      v-else-if="detail.isError.value || !detail.data.value"
      :error="detail.error.value"
      title="Не удалось загрузить переписку"
      @retry="detail.refetch()"
    />

    <template v-else>
      <header class="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div class="min-w-0">
          <h2 id="conversation-title" class="text-xl font-bold break-words text-ink">
            {{ contactName }}
          </h2>
          <p class="mt-0.5 text-sm text-muted">{{ channelLine }}</p>
        </div>
        <div class="flex flex-col items-end gap-1">
          <a
            v-if="externalUrl"
            :href="externalUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-10 items-center rounded-control border border-line bg-paper px-4 text-sm font-semibold text-ink hover:bg-canvas"
          >
            Открыть в Telegram
          </a>
          <p v-else-if="unavailableText" class="text-sm text-muted">{{ unavailableText }}</p>
          <p class="text-xs text-muted">Ответ клиенту — только во внешнем канале.</p>
        </div>
      </header>

      <div
        v-if="messages.isPending.value"
        role="status"
        aria-label="Загрузка сообщений"
        class="flex flex-col gap-3"
      >
        <UiSkeleton class="h-14 w-2/3" />
        <UiSkeleton class="h-14 w-2/3 self-end" />
        <UiSkeleton class="h-14 w-1/2" />
      </div>
      <UiErrorState
        v-else-if="messages.isError.value && !bubbles.length"
        :error="messages.error.value"
        title="Не удалось загрузить сообщения"
        @retry="messages.refetch()"
      />
      <p v-else-if="!bubbles.length" class="py-6 text-center text-sm text-muted">
        Сообщений в этой переписке пока нет.
      </p>
      <div
        v-else
        ref="container"
        class="flex max-h-[60dvh] min-h-64 flex-col gap-4 overflow-y-auto pr-1"
        role="region"
        aria-label="Сообщения"
        tabindex="0"
      >
        <div class="flex justify-center">
          <UiButton
            v-if="messages.hasNextPage.value"
            variant="ghost"
            size="sm"
            :loading="messages.isFetchingNextPage.value"
            @click="loadOlder"
          >
            Показать более ранние
          </UiButton>
          <p v-else class="text-xs text-muted">Начало переписки</p>
        </div>
        <section
          v-for="group in groups"
          :key="group.key"
          :aria-label="group.label"
          class="flex flex-col gap-3"
        >
          <p class="text-center text-xs font-semibold text-muted">{{ group.label }}</p>
          <ul class="flex flex-col gap-3">
            <MessageBubble
              v-for="bubble in group.items"
              :key="bubble.id"
              :bubble="bubble"
              :time-zone="timeZone"
            />
          </ul>
        </section>
      </div>
    </template>
  </UiCard>
</template>
