<script setup lang="ts">
/**
 * Столбцы возвращённой выручки по дням окна. Ряд рисуется как пришёл с
 * сервера: по одной точке на дату, нули на месте; пропуски не
 * интерполируются. График подстраивается под ширину карточки, чтобы всё
 * окно (до 366 дней) было видно целиком; подписи сумм показываются, пока
 * столбцам хватает места. Для читателей экрана данные продублированы таблицей.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatAmount, formatMoney } from '@/shared/lib'
import { buildChart, type AnalyticsDailyPoint } from '@/entities/report'

const props = defineProps<{ series: AnalyticsDailyPoint[]; currency: string }>()

const chart = computed(() => buildChart(props.series, (point) => point.confirmedRecovered))

const container = ref<HTMLElement | null>(null)
/** Размеры области; до измерения — разумные значения для SSR и тестов. */
const width = ref(720)
const minHeight = 208
const height = ref(minHeight)
let observer: ResizeObserver | null = null

function measure(nextWidth: number | undefined, nextHeight: number | undefined): void {
  if (nextWidth && nextWidth > 0) width.value = nextWidth
  if (nextHeight && nextHeight > 0) height.value = Math.max(nextHeight, minHeight)
}

onMounted(() => {
  if (!container.value) return
  measure(container.value.clientWidth, container.value.clientHeight)
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    measure(rect?.width, rect?.height)
  })
  observer.observe(container.value)
})
onBeforeUnmount(() => observer?.disconnect())

const paddingLeft = 56
const paddingRight = 8
const paddingTop = 20
const paddingBottom = 28
const plotHeight = computed(() => height.value - paddingTop - paddingBottom)

const slot = computed(() => {
  const count = Math.max(chart.value.bars.length, 1)
  return Math.max((width.value - paddingLeft - paddingRight) / count, 2)
})
const barWidth = computed(() => Math.max(Math.min(slot.value * 0.62, 28), 1))
const showValues = computed(() => slot.value >= 34)
/** Подпись даты занимает около 52 px: на узком графике показываем каждую n-ю. */
const labelEvery = computed(() => Math.max(chart.value.labelStep, Math.ceil(52 / slot.value)))

const x = (index: number) => paddingLeft + index * slot.value + (slot.value - barWidth.value) / 2
const y = (ratio: number) => paddingTop + plotHeight.value - ratio * plotHeight.value
const tickY = (tick: number) => y(chart.value.top > 0 ? tick / chart.value.top : 0)
</script>

<template>
  <figure
    ref="container"
    class="relative min-h-52 flex-1"
    :aria-label="`Возвращённая выручка по дням, ${currency}`"
  >
    <figcaption class="sr-only">Возвращённая выручка по дням, {{ currency }}</figcaption>
    <p
      v-if="chart.empty"
      class="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted"
    >
      За период подтверждённой возвращённой выручки нет.
    </p>
    <svg
      v-else
      :viewBox="`0 0 ${width} ${height}`"
      :width="width"
      :height="height"
      class="absolute inset-0 block max-w-full"
      aria-hidden="true"
    >
      <g v-for="tick in chart.ticks" :key="tick">
        <line
          :x1="paddingLeft"
          :x2="width - paddingRight"
          :y1="tickY(tick)"
          :y2="tickY(tick)"
          class="stroke-line"
          stroke-width="1"
        />
        <text
          :x="paddingLeft - 8"
          :y="tickY(tick) + 4"
          text-anchor="end"
          class="fill-muted text-[10px]"
        >
          {{ formatAmount(tick.toFixed(2)) }}
        </text>
      </g>
      <g v-for="(bar, index) in chart.bars" :key="bar.date">
        <rect
          :x="x(index)"
          :y="y(bar.height)"
          :width="barWidth"
          :height="Math.max(bar.height * plotHeight, bar.value > 0 ? 2 : 0)"
          :rx="Math.min(4, barWidth / 2)"
          class="fill-brand"
        />
        <text
          v-if="showValues && bar.value > 0"
          :x="x(index) + barWidth / 2"
          :y="y(bar.height) - 6"
          text-anchor="middle"
          class="fill-brand-dark text-[10px] font-semibold"
        >
          {{ formatAmount(bar.amount) }}
        </text>
        <text
          v-if="index % labelEvery === 0"
          :x="x(index) + barWidth / 2"
          :y="height - 8"
          text-anchor="middle"
          class="fill-muted text-[10px]"
        >
          {{ bar.label }}
        </text>
      </g>
    </svg>
    <table class="sr-only">
      <caption>
        Возвращённая выручка по дням
      </caption>
      <thead>
        <tr>
          <th scope="col">Дата</th>
          <th scope="col">Возвращено</th>
          <th scope="col">Оплат</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="point in series" :key="point.date">
          <td>{{ point.date }}</td>
          <td>{{ formatMoney(point.confirmedRecovered, currency) }}</td>
          <td>{{ point.payments }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>
