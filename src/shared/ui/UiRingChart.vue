<script setup lang="ts">
/**
 * Концентрические кольца: каждое кольцо отвечает за свою величину и состоит
 * из сегментов одного или разных оттенков на бледном фоне. Внешнее кольцо —
 * первое в списке. Знаменатель `max` — полный круг; кольцо без значений
 * остаётся пустым фоном.
 *
 * Рисунок только дублирует легенду рядом, поэтому скрыт от скринридеров;
 * точные значения всплывают подсказкой при наведении. В центре — слот только
 * для числа без подписей: размер шрифта подбирается под отверстие, а смысл
 * числа объясняет строка легенды рядом. При появлении кольца разворачиваются
 * один раз (см. стили).
 */
import { computed } from 'vue'
import { layoutRing } from '@/shared/lib'
import { RING_TONES, type RingTone } from './ring-tones'

export interface RingSegment {
  value: number
  tone: RingTone
  /** Подсказка при наведении: «Входящие: 4 из 8». */
  title?: string | undefined
}

export interface Ring {
  key: string
  /** Значение, которому соответствует полный круг. */
  max: number
  segments: RingSegment[]
  /** Оттенок фона; по умолчанию — оттенок первого сегмента. */
  trackTone?: RingTone | undefined
}

const props = withDefaults(defineProps<{ rings: Ring[]; size?: number | undefined }>(), {
  size: 144,
})

/** Колец больше четырёх уже не различить: лишние отбрасываются. */
const visible = computed(() => props.rings.slice(0, 4))

/** Чем меньше колец, тем толще каждое: один бублик читается как цельная фигура. */
const stroke = computed(() => [16, 12, 10, 8][Math.max(visible.value.length, 1) - 1] ?? 8)
const gap = 4
const edge = 1

const radiusOf = (index: number) =>
  props.size / 2 - edge - stroke.value / 2 - index * (stroke.value + gap)

const layout = computed(() =>
  visible.value.map((ring, index) => {
    const radius = radiusOf(index)
    const tone = ring.trackTone ?? ring.segments[0]?.tone ?? 'neutral'
    return {
      key: ring.key,
      radius,
      track: RING_TONES[ring.max > 0 ? tone : 'neutral'].track,
      pieces: layoutRing(
        radius,
        stroke.value,
        ring.segments.map((segment) => segment.value),
        ring.max,
      ).map((piece) => {
        const segment = ring.segments[piece.index]
        return {
          ...piece,
          color: RING_TONES[segment?.tone ?? 'neutral'].main,
          title: segment?.title,
        }
      }),
    }
  }),
)

/** Чем больше колец, тем меньше отверстие и тем мельче число в нём. */
const centerSize = computed(
  () =>
    ['text-3xl', 'text-2xl', 'text-xl', 'text-lg'][Math.max(visible.value.length, 1) - 1] ??
    'text-lg',
)

/** Отступ центрального слота: текст остаётся внутри отверстия самого малого кольца. */
const inset = computed(() => {
  const inner = radiusOf(Math.max(visible.value.length, 1) - 1) - stroke.value / 2
  return Math.max(props.size / 2 - inner + 2, 0)
})
</script>

<template>
  <div class="relative shrink-0" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg
      class="ring-reveal block"
      :viewBox="`0 0 ${size} ${size}`"
      :width="size"
      :height="size"
      aria-hidden="true"
      focusable="false"
    >
      <g :transform="`translate(${size / 2} ${size / 2})`" fill="none" :stroke-width="stroke">
        <g v-for="ring in layout" :key="ring.key">
          <circle :r="ring.radius" :style="{ stroke: ring.track }" />
          <template v-for="piece in ring.pieces" :key="piece.index">
            <circle
              v-if="piece.shape === 'circle'"
              :r="ring.radius"
              :style="{ stroke: piece.color }"
            >
              <title v-if="piece.title">{{ piece.title }}</title>
            </circle>
            <path
              v-else-if="piece.shape === 'path'"
              :d="piece.d"
              stroke-linecap="round"
              :style="{ stroke: piece.color }"
            >
              <title v-if="piece.title">{{ piece.title }}</title>
            </path>
            <circle
              v-else
              :cx="piece.x"
              :cy="piece.y"
              :r="stroke / 2"
              stroke="none"
              :style="{ fill: piece.color }"
            >
              <title v-if="piece.title">{{ piece.title }}</title>
            </circle>
          </template>
        </g>
      </g>
    </svg>
    <div
      v-if="$slots.default"
      :class="[
        'absolute inset-0 flex items-center justify-center text-center leading-none font-medium whitespace-nowrap tabular-nums',
        centerSize,
      ]"
      :style="{ padding: `${inset}px` }"
    >
      <slot />
    </div>
  </div>
</template>
