<script setup lang="ts">
/**
 * Карточка риска в ленте Radar в двух представлениях по Figma: плитка
 * 21:1982 (27:2488) и строка списка 21:1753 (31:1151). Показывает важность
 * и статус, контакт и услугу, тип и причину, последнее сообщение, потенциал
 * сделки и переход к разбору. Тексты API выводятся только как текст.
 * Внешняя ссылка на чат, время обнаружения и история действий в карточке
 * макета отсутствуют и доступны в рабочем пространстве риска.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { formatLongDateTime } from '@/shared/lib'
import { UiGlyph } from '@/shared/ui'
import { RiskSeverityBadge, type RiskCardViewModel } from '@/entities/risk'

const props = withDefaults(
  defineProps<{
    card: RiskCardViewModel
    timeZone: string
    now: Date
    view?: 'tiles' | 'list'
    /** Имена точек по идентификатору; неизвестная точка просто не показывается. */
    locationNames?: Record<string, string> | undefined
  }>(),
  { view: 'tiles', locationNames: () => ({}) },
)

/** Доступное представление: полная дата, время и пояс организации, без относительных «n мин назад». */
function spoken(value: string | null | undefined): string | null {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? formatLongDateTime(date, props.timeZone) : null
}
const dueSpoken = computed(() => spoken(props.card.dueAt))
const detectedSpoken = computed(() => spoken(props.card.detectedAt))

const location = computed(() =>
  props.card.locationId ? (props.locationNames[props.card.locationId] ?? null) : null,
)
/** Плитка: «услуга · точка» (Figma 27:2488); список и телефон добавляют канал (31:1151). */
const meta = computed(() =>
  [
    props.card.serviceName ?? 'Услуга не уточнена',
    location.value,
    props.view === 'list' || !location.value ? props.card.channelName : null,
  ]
    .filter((part) => part)
    .join(' · '),
)

// Группа «В работе» включает ACTED: акцент по статусу, а не по тексту подписи.
const inProgress = computed(() => ['ACKNOWLEDGED', 'ACTED'].includes(props.card.status))

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
const riskRoute = computed(() => ({ name: 'risk', params: { riskId: props.card.id } }))
</script>

<template>
  <li class="min-w-0">
    <!-- Плитка (27:2488): 3 колонки на широкой ленте -->
    <article
      v-if="view === 'tiles'"
      :aria-labelledby="`risk-${card.id}-title`"
      class="relative flex min-h-[356px] min-w-0 flex-col rounded-[14px] border border-hairline bg-paper px-[19px] pt-[15px] pb-[9px] md:max-lg:min-h-[352px] max-lg:pb-[17px]"
    >
      <div class="flex items-center justify-between gap-2">
        <RiskSeverityBadge :severity="card.severity" />
        <span
          :class="['text-xs leading-[18px] font-medium', inProgress ? 'text-brand' : 'text-muted']"
          >{{ card.statusLabel }}</span
        >
      </div>
      <h3
        :id="`risk-${card.id}-title`"
        class="mt-[18px] truncate text-lg leading-6 font-semibold text-ink"
      >
        <RouterLink :to="riskRoute" class="rounded-field hover:underline">{{
          card.contactName
        }}</RouterLink>
      </h3>
      <p class="mt-1 truncate text-xs leading-[18px] text-muted">{{ meta }}</p>
      <p class="mt-3.5 truncate text-note font-semibold text-ink">{{ card.typeLabel }}</p>
      <p
        class="mt-[25px] flex h-[18px] min-w-0 items-center gap-2 text-meta text-muted max-lg:mt-[9px]"
      >
        <UiGlyph name="clock" class="size-4" />
        <span class="truncate" :title="card.reason">{{ card.reason }}</span>
      </p>
      <blockquote
        v-if="card.lastMessage"
        class="mt-3 h-16 rounded-lg bg-canvas px-2.5 py-1.5 text-xs leading-[17px] text-muted max-lg:h-[50px]"
      >
        <span class="line-clamp-3">
          <span class="sr-only">{{ messageAuthor }}: </span>
          <template v-if="card.lastMessage.preview">«{{ card.lastMessage.preview }}»</template>
          <template v-else>сообщение без текста</template>
        </span>
      </blockquote>
      <div v-else class="mt-3 h-16 max-lg:h-[50px]" aria-hidden="true" />
      <!-- На 320 px длинная сумма («Неизвестна») не помещается рядом с кнопкой: кнопка переносится,
           а не наезжает на текст. -->
      <div
        class="mt-3.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-3 border-t border-hairline pt-[18px] max-lg:mt-auto max-lg:border-t-0 max-lg:pt-0"
      >
        <div class="flex min-w-0 flex-col gap-1">
          <p class="text-xl leading-[26px] font-semibold text-ink tabular-nums">
            <template v-if="card.potential">{{ card.potential }}</template>
            <template v-else>Неизвестна</template>
          </p>
          <p class="flex items-center gap-2 text-xs leading-[18px] text-muted">
            <UiGlyph name="banknote" class="size-[18px]" />{{
              card.potential ? 'Потенциал сделки' : 'Сумма сделки'
            }}
          </p>
        </div>
        <RouterLink
          :to="riskRoute"
          :aria-label="`Разобрать риск: ${card.contactName}`"
          class="flex shrink-0 items-center justify-center font-medium max-lg:h-input max-lg:w-[140px] max-lg:rounded-button max-lg:border max-lg:border-line max-lg:bg-paper max-lg:text-field max-lg:leading-5 max-lg:text-ink max-lg:hover:bg-canvas lg:h-9 lg:w-[116px] lg:rounded-[7px] lg:bg-action-pale lg:text-[13px] lg:leading-5 lg:text-link lg:hover:bg-nav-selected"
          >Разобрать →</RouterLink
        >
      </div>
      <dl class="sr-only">
        <dt>Срок по правилу</dt>
        <dd>
          <time v-if="dueSpoken" :datetime="card.dueAt">{{ dueSpoken }}</time>
          <template v-else>неизвестен</template>
        </dd>
        <dt>Риск обнаружен</dt>
        <dd>
          <time v-if="detectedSpoken" :datetime="card.detectedAt">{{ detectedSpoken }}</time>
          <template v-else>неизвестно</template>
        </dd>
        <template v-if="card.actionsCount">
          <dt>Действий</dt>
          <dd>{{ card.actionsCount }}</dd>
        </template>
        <template v-if="card.outcomeLabel">
          <dt>Последний исход</dt>
          <dd>{{ card.outcomeLabel }}</dd>
        </template>
      </dl>
    </article>

    <!-- Строка списка (31:1151): оценка и действие справа от широкого экрана -->
    <article
      v-else
      :aria-labelledby="`risk-${card.id}-title`"
      class="relative grid min-w-0 rounded-[14px] border border-hairline bg-paper px-[19px] pt-[15px] pb-[9px] md:grid-cols-[minmax(0,1fr)_180px] md:gap-x-6 md:pt-[21px] md:pb-[15px] lg:grid-cols-[minmax(0,1fr)_auto_216px] lg:gap-x-0 lg:pt-[15px] lg:pb-[9px]"
    >
      <div class="flex min-w-0 flex-col">
        <div
          class="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 md:justify-between lg:justify-start"
        >
          <h3
            :id="`risk-${card.id}-title`"
            class="w-[292px] max-w-full min-w-0 truncate text-lg leading-6 font-semibold text-ink"
          >
            <RouterLink :to="riskRoute" class="rounded-field hover:underline">{{
              card.contactName
            }}</RouterLink>
          </h3>
          <div class="flex items-center gap-3">
            <RiskSeverityBadge :severity="card.severity" />
            <span
              :class="[
                'text-xs leading-[18px] font-medium',
                inProgress ? 'text-brand' : 'text-muted',
              ]"
              >{{ card.statusLabel }}</span
            >
          </div>
        </div>
        <!-- Планшет (630:6708): тип и причина двумя строками; от 1024 px — в одну строку (31:1151). -->
        <div
          class="mt-2.5 flex min-w-0 flex-col gap-2.5 lg:min-h-[22px] lg:flex-row lg:items-center lg:gap-2"
        >
          <p class="shrink-0 text-note font-semibold text-ink">{{ card.typeLabel }}</p>
          <span class="text-meta text-muted max-lg:hidden" aria-hidden="true">·</span>
          <p class="flex min-w-0 items-center gap-2">
            <UiGlyph name="clock" class="size-4 shrink-0 text-muted" />
            <span class="truncate text-meta text-muted" :title="card.reason">{{
              card.reason
            }}</span>
          </p>
        </div>
        <blockquote
          v-if="card.lastMessage"
          class="mt-2.5 flex min-h-[38px] items-center rounded-lg bg-canvas px-3 py-2.5 text-meta text-muted"
        >
          <span class="truncate">
            <span class="sr-only">{{ messageAuthor }}: </span>
            <template v-if="card.lastMessage.preview">«{{ card.lastMessage.preview }}»</template>
            <template v-else>сообщение без текста</template>
          </span>
        </blockquote>
        <p class="mt-3 truncate text-xs leading-[18px] text-muted">{{ meta }}</p>
      </div>

      <div class="my-1 mr-4 ml-6 hidden w-px bg-hairline lg:block" aria-hidden="true" />

      <div
        class="mt-3 flex flex-col gap-2 border-t border-hairline pt-3 md:my-auto md:items-end md:border-t-0 md:pt-0 md:max-lg:gap-1 lg:my-1 lg:mb-1.5"
      >
        <p class="text-[22px] leading-7 font-semibold text-ink tabular-nums">
          <template v-if="card.potential">{{ card.potential }}</template>
          <template v-else>Неизвестна</template>
        </p>
        <p class="flex items-center gap-2 text-xs leading-[18px] text-muted">
          <UiGlyph name="banknote" class="size-[18px]" />{{
            card.potential ? 'Потенциал сделки' : 'Сумма сделки не определена'
          }}
        </p>
        <RouterLink
          :to="riskRoute"
          :aria-label="`Разобрать риск: ${card.contactName}`"
          class="flex items-center justify-center font-medium md:max-lg:mt-2 lg:mt-auto max-lg:h-input max-lg:w-full max-lg:rounded-button max-lg:border max-lg:border-line max-lg:bg-paper max-lg:text-field max-lg:leading-5 max-lg:text-ink max-lg:hover:bg-canvas md:w-[180px] lg:h-9 lg:rounded-[7px] lg:bg-action-pale lg:text-[13px] lg:leading-5 lg:text-link lg:hover:bg-nav-selected"
          ><span class="lg:hidden">Разобрать →</span
          ><span class="max-lg:hidden">Разобрать риск →</span></RouterLink
        >
      </div>
      <dl class="sr-only">
        <dt>Срок по правилу</dt>
        <dd>
          <time v-if="dueSpoken" :datetime="card.dueAt">{{ dueSpoken }}</time>
          <template v-else>неизвестен</template>
        </dd>
        <dt>Риск обнаружен</dt>
        <dd>
          <time v-if="detectedSpoken" :datetime="card.detectedAt">{{ detectedSpoken }}</time>
          <template v-else>неизвестно</template>
        </dd>
        <template v-if="card.actionsCount">
          <dt>Действий</dt>
          <dd>{{ card.actionsCount }}</dd>
        </template>
        <template v-if="card.outcomeLabel">
          <dt>Последний исход</dt>
          <dd>{{ card.outcomeLabel }}</dd>
        </template>
      </dl>
    </article>
  </li>
</template>
