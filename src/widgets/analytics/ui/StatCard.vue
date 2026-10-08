<script setup lang="ts">
/**
 * Карточка сводки: заголовок, концентрические кольца и легенда. Каждая строка
 * легенды сохраняет прежнее название и значение; цветной маркер связывает её
 * с кольцом. Если кольца построить нельзя, карточка остаётся обычным списком.
 * В узкой колонке кольца стоят над легендой, в широкой — слева от неё и
 * прижаты к верху: отступ от заголовка у всех карточек одинаковый, а не
 * зависит от высоты легенды. Внутри колец только число.
 */
import { computed } from 'vue'
import { RING_TONES, UiCard, UiRingChart, type Ring, type RingTone } from '@/shared/ui'

export interface StatRow {
  label: string
  value: string
  /** Доля от целого, уже отформатированная: «50 %». */
  share?: string | undefined
  /** Пояснение мелким шрифтом под значением. */
  hint?: string | undefined
  /** Оттенок кольца, к которому относится строка. */
  tone?: RingTone | undefined
}

/** Число в центре колец: без подписей, смысл задаёт строка легенды. */
export interface StatCenter {
  value: string
  tone?: RingTone | undefined
}

const props = withDefaults(
  defineProps<{
    title: string
    rows: StatRow[]
    rings?: Ring[] | undefined
    center?: StatCenter | undefined
  }>(),
  { rings: () => [], center: undefined },
)

const hasRings = computed(() => props.rings.length > 0)
const accent = (tone: RingTone | undefined) => RING_TONES[tone ?? 'neutral'].accent
/** Цвет строки осмыслен только рядом с кольцами; без них — обычный список. */
const toneOf = (row: StatRow): RingTone | undefined => (hasRings.value ? row.tone : undefined)
</script>

<template>
  <UiCard as="section" :aria-label="title" class="@container">
    <h3 class="text-base font-medium text-ink">{{ title }}</h3>
    <div class="mt-4 flex flex-col items-start gap-5 @md:flex-row @md:gap-6">
      <UiRingChart v-if="hasRings" :rings="rings">
        <template v-if="center" #default>
          <span :style="{ color: accent(center.tone) }">{{ center.value }}</span>
        </template>
      </UiRingChart>
      <dl class="flex w-full min-w-0 flex-1 flex-col gap-2.5 text-sm">
        <div v-for="row in rows" :key="row.label" class="flex items-start justify-between gap-3">
          <dt class="flex min-w-0 items-baseline gap-2 text-muted">
            <span
              v-if="hasRings"
              aria-hidden="true"
              :class="[
                'size-2.5 shrink-0 translate-y-px rounded-full',
                row.tone ? '' : 'invisible',
              ]"
              :style="row.tone ? { backgroundColor: RING_TONES[row.tone].main } : undefined"
            />
            <span class="min-w-0">{{ row.label }}</span>
          </dt>
          <dd
            :class="['shrink-0 text-right font-medium tabular-nums', toneOf(row) ? '' : 'text-ink']"
            :style="toneOf(row) ? { color: accent(toneOf(row)) } : undefined"
          >
            {{ row.value
            }}<span v-if="row.share" class="font-normal text-muted"> · {{ row.share }}</span>
            <span v-if="row.hint" class="block text-xs font-normal text-muted">{{ row.hint }}</span>
          </dd>
        </div>
      </dl>
    </div>
  </UiCard>
</template>
