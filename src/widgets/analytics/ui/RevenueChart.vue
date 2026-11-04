<script setup lang="ts">
/** All day details come from the loaded summary series, including zero days. */
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { formatAmount, formatCalendarDate, formatMoney, plural } from '@/shared/lib'
import { UiButton, UiCard, UiGlyph, UiDialog } from '@/shared/ui'
import { buildChart, type AnalyticsDailyPoint, type AnalyticsPeriod } from '@/entities/report'

const props = defineProps<{
  series: AnalyticsDailyPoint[]
  currency: string
  period?: AnalyticsPeriod
  total?: string
}>()
const chart = computed(() => buildChart(props.series, (point) => point.confirmedRecovered))
const width = ref(672)
const plot = ref<HTMLElement | null>(null)
const selectedIndex = ref<number | null>(null)
const selected = computed(() =>
  selectedIndex.value === null ? null : (props.series[selectedIndex.value] ?? null),
)
const selectedId = useId()
const daysOpen = ref(false)
const daysTrigger = ref<HTMLButtonElement | null>(null)
const rows = ref<HTMLElement | null>(null)
function openDays(event: MouseEvent): void {
  // Retain the invoking button even when WebKit leaves focus on the chart.
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus({ preventScroll: true })
  daysOpen.value = true
}
let observer: ResizeObserver | null = null
onMounted(() => {
  if (!plot.value) return
  if (plot.value.clientWidth > 0) width.value = plot.value.clientWidth
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(([entry]) => {
    if (entry && entry.contentRect.width > 0) width.value = entry.contentRect.width
  })
  observer.observe(plot.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch(
  () => props.series.map((point) => point.date).join(','),
  () => {
    selectedIndex.value = null
    daysOpen.value = false
  },
)
const top = computed(() => {
  const max = Math.max(0, ...chart.value.bars.map((bar) => bar.value))
  if (max <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(max))
  const scaled = max / power
  return (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 4 ? 4 : scaled <= 5 ? 5 : 10) * power
})
const ticks = computed(() => (chart.value.empty ? [0] : [0, top.value / 2, top.value]))
const left = computed(() =>
  Math.min(88, Math.max(42, String(Math.floor(top.value)).length * 7 + 12)),
)
const slot = computed(() => (width.value - left.value) / Math.max(props.series.length, 1))
const barWidth = computed(() => Math.max(1, slot.value - Math.min(4, slot.value * 0.12)))
const x = (index: number) => left.value + index * slot.value + (slot.value - barWidth.value) / 2
const y = (value: number) => 182 - (value / top.value) * 150
const labelIndexes = computed(
  () => new Set([0, Math.floor((props.series.length - 1) / 2), props.series.length - 1]),
)
const firstDate = computed(() => props.period?.fromDate ?? props.series[0]?.date)
const lastDate = computed(() => props.period?.toDate ?? props.series.at(-1)?.date)
const dateLabel = (date: string) => formatCalendarDate(date, { year: true })
const tableDate = (date: string) => date.split('-').reverse().join('.')
const shortDate = (date: string) => formatCalendarDate(date, { month: 'short', year: false })
const rangeLabel = computed(() => {
  const from = firstDate.value,
    to = lastDate.value
  if (!from || !to) return 'Период без дневных данных'
  const date = (value: string) => formatCalendarDate(value, { year: false })
  if (from === to) return `${date(to)} ${to.slice(0, 4)}`
  if (from.slice(0, 7) === to.slice(0, 7))
    return `${Number(from.slice(8))} — ${date(to)} ${to.slice(0, 4)}`
  if (from.slice(0, 4) === to.slice(0, 4)) return `${date(from)} — ${date(to)} ${to.slice(0, 4)}`
  return `${date(from)} ${from.slice(0, 4)} — ${date(to)} ${to.slice(0, 4)}`
})
const chartRange = computed(() =>
  firstDate.value && lastDate.value
    ? firstDate.value === lastDate.value
      ? shortDate(firstDate.value)
      : `${shortDate(firstDate.value)} — ${shortDate(lastDate.value)}`
    : '',
)
/** Decimal strings are added as integer minor units, without floating-point rounding. */
const total = computed(() => {
  if (props.total !== undefined) return props.total
  let sum = 0n
  for (const point of props.series) {
    const match = /^(\d+)\.(\d{2})$/.exec(point.confirmedRecovered)
    if (!match) return undefined
    sum += BigInt(match[1]!) * 100n + BigInt(match[2]!)
  }
  return `${sum / 100n}.${String(sum % 100n).padStart(2, '0')}`
})
function keydown(event: KeyboardEvent) {
  if (!props.series.length) return
  const current = selectedIndex.value ?? -1
  let next: number
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      next = Math.min(current + 1, props.series.length - 1)
      break
    case 'ArrowLeft':
    case 'ArrowUp':
      next = current < 0 ? props.series.length - 1 : Math.max(0, current - 1)
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = props.series.length - 1
      break
    case 'Escape':
      selectedIndex.value = null
      event.preventDefault()
      return
    default:
      return
  }
  event.preventDefault()
  selectedIndex.value = next
}
function selectDay(event: MouseEvent) {
  if (!plot.value || !props.series.length) return
  const target = event.target instanceof Element ? event.target.closest('[data-day-index]') : null
  const index = target?.getAttribute('data-day-index')
  if (index !== undefined && index !== null) selectedIndex.value = Number(index)
  else {
    const rect = plot.value.getBoundingClientRect()
    const px = ((event.clientX - rect.left) * width.value) / (rect.width || width.value)
    selectedIndex.value = Math.max(
      0,
      Math.min(props.series.length - 1, Math.floor((px - left.value) / slot.value)),
    )
  }
  plot.value.focus()
}
function lastDay() {
  rows.value?.lastElementChild?.scrollIntoView({ block: 'end' })
}
</script>

<template>
  <UiCard as="section" :padded="false" class="revenue" aria-label="Возвращённая выручка">
    <h3><UiGlyph name="banknote" class="size-[18px] text-muted" />Возвращённая выручка</h3>
    <p :id="selectedId" class="description" aria-live="polite">
      <template v-if="selected"
        >{{ dateLabel(selected.date) }} ·
        {{ formatMoney(selected.confirmedRecovered, currency) ?? '—' }} · возвращено и
        подтверждено</template
      >
      <template v-else-if="chart.empty"
        >За период подтверждённой возвращённой выручки нет. · {{ currency }}</template
      >
      <template v-else>Подтверждённые оплаты после работы с риском · {{ currency }}</template>
    </p>
    <div
      ref="plot"
      class="plot"
      :tabindex="series.length ? 0 : undefined"
      role="group"
      aria-label="Возвращённая выручка по дням. Выбор дня: стрелки, Home и End"
      :aria-describedby="selectedId"
      @keydown="keydown"
      @click="selectDay"
    >
      <svg :viewBox="`0 0 ${width} 220`" width="100%" height="220" aria-hidden="true">
        <g v-for="tick in ticks" :key="tick">
          <line :x1="left" :x2="width" :y1="y(tick)" :y2="y(tick)" class="grid-line" />
          <text :x="left - 8" :y="y(tick) + 4" text-anchor="end" class="axis">
            {{ formatAmount(tick.toFixed(2)) }}
          </text>
        </g>
        <g v-for="(bar, index) in chart.bars" :key="bar.date" :data-day-index="index">
          <rect
            :x="x(index)"
            :y="y(bar.value)"
            :width="barWidth"
            :height="Math.max(0, 182 - y(bar.value))"
            class="bar"
            :class="{ selected: selectedIndex === index }"
          />
          <rect :x="left + index * slot" y="24" :width="slot" height="164" fill="transparent" />
          <text
            v-if="labelIndexes.has(index)"
            :x="x(index) + barWidth / 2"
            y="210"
            :text-anchor="index === 0 ? 'start' : index === series.length - 1 ? 'end' : 'middle'"
            class="axis"
          >
            {{ shortDate(bar.date) }}
          </text>
        </g>
      </svg>
    </div>
    <div class="chart-footer">
      <p v-if="selected">
        Выбран {{ shortDate(selected.date) }} ·
        {{ formatMoney(selected.confirmedRecovered, currency) ?? '—' }}
      </p>
      <p v-else>{{ chartRange }} · по дням</p>
      <button ref="daysTrigger" type="button" class="days-button" @click="openDays">
        Данные по дням
      </button>
    </div>
    <UiDialog
      v-model:open="daysOpen"
      title="Данные по дням"
      :description="`${rangeLabel} · ${series.length} ${plural(series.length, 'день', 'дня', 'дней')}`"
      analytics-daily
      :return-focus="() => daysTrigger"
    >
      <p class="daily-context">
        Возвращено и подтверждено · {{ currency }}<br />Время организации:
        {{ period?.timezone ?? 'по датам отчёта' }}
      </p>
      <div class="daily-scroll" role="region" aria-label="Данные по дням" tabindex="0">
        <table>
          <caption class="sr-only">
            Подтверждённая возвращённая выручка по дням
          </caption>
          <thead>
            <tr>
              <th scope="col">Дата</th>
              <th scope="col">Сумма за день</th>
            </tr>
          </thead>
          <tbody ref="rows">
            <tr v-for="point in series" :key="point.date">
              <td>{{ tableDate(point.date) }}</td>
              <td>{{ formatMoney(point.confirmedRecovered, currency) ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <button v-if="series.length > 14" type="button" class="days-button" @click="lastDay">
        К последнему дню
      </button>
      <p class="daily-total">Итого за период: {{ formatMoney(total, currency) ?? '—' }}</p>
      <UiButton variant="secondary" class="mt-4 w-full" @click="daysOpen = false">Закрыть</UiButton>
    </UiDialog>
  </UiCard>
</template>

<style scoped>
.revenue {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  border-color: var(--color-analytics-line);
}
h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}
.description {
  min-height: 20px;
  color: var(--color-secondary);
  font-size: 14px;
  line-height: 20px;
}
.plot {
  min-width: 0;
  height: 220px;
  cursor: crosshair;
}
.plot svg {
  display: block;
  overflow: visible;
}
.grid-line {
  stroke: var(--color-line);
  stroke-width: 1;
}
.axis {
  fill: var(--color-secondary);
  font-size: 12px;
}
.bar {
  fill: var(--color-brand);
}
.bar.selected {
  stroke: var(--color-ink);
  stroke-width: 2;
}
.chart-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.chart-footer p {
  min-width: 0;
  color: var(--color-secondary);
  font-size: 12px;
  line-height: 18px;
}
.days-button {
  min-height: 46px;
  padding: 12px 16px;
  border-radius: var(--radius-button);
  font-size: 17px;
  font-weight: 500;
  line-height: 22px;
  color: var(--color-secondary);
  cursor: pointer;
}
.days-button:hover {
  background: var(--color-canvas);
}
.daily-context {
  font-size: 13px;
  line-height: 18px;
}
.daily-scroll {
  max-height: min(calc(100dvh - 340px), 392px);
  margin-top: 16px;
  overflow: auto;
  overscroll-behavior: contain;
}
table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 14px;
  line-height: 20px;
}
th {
  position: sticky;
  top: 0;
  background: var(--color-paper);
  text-align: left;
  font-weight: 400;
  padding-bottom: 20px;
}
td {
  padding: 14px 0;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
tbody::before {
  content: '';
  display: table-row;
  height: 16px;
}
.daily-total {
  margin-top: 16px;
  font-size: 14px;
  line-height: 20px;
  overflow-wrap: anywhere;
}
@media (max-width: 599px) {
  .revenue {
    padding: 16px;
  }
  .chart-footer {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }
  .chart-footer p {
    padding-top: 8px;
  }
  .days-button {
    width: 100%;
  }
}
</style>
