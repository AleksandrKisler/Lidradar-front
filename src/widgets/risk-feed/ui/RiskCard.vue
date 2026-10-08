<script setup lang="ts">
/**
 * Карточка риска в ленте: важность и тип, контакт и услуга, причина,
 * потенциал сделки, последнее сообщение и безопасный внешний переход.
 * Все тексты API выводятся как текст; ссылка берётся только из ответа.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { formatDateTime, formatRelative } from '@/shared/lib'
import { UiBadge, UiCard } from '@/shared/ui'
import {
  RiskSeverityBadge,
  externalLinkUnavailableLabel,
  type RiskCardViewModel,
} from '@/entities/risk'

const props = defineProps<{ card: RiskCardViewModel; timeZone: string; now: Date }>()

const detectedRelative = computed(() => formatRelative(props.card.detectedAt, props.now))
const detectedAbsolute = computed(() => formatDateTime(props.card.detectedAt, props.timeZone))
const dueRelative = computed(() => formatRelative(props.card.dueAt, props.now))
const dueAbsolute = computed(() => formatDateTime(props.card.dueAt, props.timeZone))

const unavailableText = computed(() =>
  externalLinkUnavailableLabel(props.card.externalUnavailableReason),
)

const messageAuthor = computed(() => {
  switch (props.card.lastMessage?.direction) {
    case 'INCOMING':
      return 'Клиент'
    case 'OUTGOING':
      return 'Вы'
    default:
      return 'Система'
  }
})
</script>

<template>
  <UiCard as="li">
    <article :aria-labelledby="`risk-${card.id}-title`">
      <div class="flex flex-wrap items-center gap-2">
        <RiskSeverityBadge :severity="card.severity" />
        <UiBadge :tone="card.typeTone">{{ card.typeLabel }}</UiBadge>
        <UiBadge tone="neutral">{{ card.statusLabel }}</UiBadge>
      </div>

      <div class="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div class="min-w-0">
          <h3 :id="`risk-${card.id}-title`" class="text-xl font-bold break-words text-ink">
            <RouterLink
              :to="{ name: 'risk', params: { riskId: card.id } }"
              class="rounded-field hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {{ card.contactName }}
            </RouterLink>
          </h3>
          <p class="mt-0.5 text-sm text-muted">
            <span>{{ card.serviceName ?? 'Услуга не уточнена' }}</span>
            <span v-if="card.channelName" aria-hidden="true"> · </span>
            <span v-if="card.channelName">{{ card.channelName }}</span>
          </p>
        </div>
        <p class="text-2xl font-bold text-ink tabular-nums">
          <template v-if="card.potential">{{ card.potential }}</template>
          <span v-else class="text-base font-medium text-muted">Сумма не определена</span>
        </p>
      </div>

      <p class="mt-3 max-w-3xl text-sm leading-6 text-ink">{{ card.reason }}</p>

      <!-- Пары «подпись — значение» разделяются flex-отступом: Vue убирает
           переносы между элементами, и пробел из разметки сюда не попадает. -->
      <dl class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <div class="flex gap-1">
          <dt>Ожидание с</dt>
          <dd>
            <time :datetime="card.dueAt" :title="dueAbsolute ?? undefined">{{ dueRelative }}</time>
          </dd>
        </div>
        <div class="flex gap-1">
          <dt>Обнаружен</dt>
          <dd>
            <time :datetime="card.detectedAt" :title="detectedAbsolute ?? undefined">{{
              detectedRelative
            }}</time>
          </dd>
        </div>
        <div v-if="card.actionsCount" class="flex gap-1">
          <dt>Действий</dt>
          <dd>{{ card.actionsCount }}</dd>
        </div>
        <div v-if="card.outcomeLabel" class="flex gap-1">
          <dt>Последний исход</dt>
          <dd>{{ card.outcomeLabel }}</dd>
        </div>
      </dl>

      <blockquote
        v-if="card.lastMessage"
        class="mt-4 rounded-control border-l-4 border-line bg-canvas px-4 py-2.5 text-sm text-ink"
      >
        <span class="font-semibold text-muted">{{ messageAuthor }}: </span>
        <template v-if="card.lastMessage.preview">{{ card.lastMessage.preview }}</template>
        <span v-else class="text-muted">сообщение без текста</span>
      </blockquote>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <a
          v-if="card.externalUrl"
          :href="card.externalUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex h-9 items-center rounded-control bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Открыть в Telegram
        </a>
        <p v-else-if="unavailableText" class="text-sm text-muted">{{ unavailableText }}</p>
        <span v-if="card.hasRecommendation" class="text-sm text-success">Есть рекомендация</span>
      </div>
    </article>
  </UiCard>
</template>
