<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import type { Location } from '@/entities/location'
import { UiGlyph, UiTooltip } from '@/shared/ui'

const props = defineProps<{ location: Location; selected: boolean; disabled: boolean }>()
const emit = defineEmits<{ select: [trigger: HTMLElement]; edit: [trigger: HTMLElement] }>()
const name = ref<HTMLElement>()
const card = ref<HTMLElement>()
const tablet = ref(false)
const cardWidth = ref(272)
const truncated = ref(false)
let observer: ResizeObserver | undefined
function measure() {
  tablet.value = innerWidth >= 768 && innerWidth < 1024
  cardWidth.value = card.value?.clientWidth ?? 272
  truncated.value = Boolean(name.value && name.value.scrollWidth > name.value.clientWidth)
}
onMounted(() => {
  observer = new ResizeObserver(measure)
  if (name.value) observer.observe(name.value)
  measure()
})
watch(
  () => props.location.name,
  async () => {
    await nextTick()
    measure()
  },
)
watch(
  name,
  (element) => {
    observer?.disconnect()
    if (element) observer?.observe(element)
    measure()
  },
  { flush: 'post' },
)
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div
    ref="card"
    :class="[
      'relative flex h-[54px] min-w-0 items-center rounded-[12px]',
      disabled ? 'opacity-50' : '',
    ]"
    :style="{
      backgroundColor: selected ? '#eaf3ff' : '#fff',
      boxShadow: `inset 0 0 0 1px ${selected ? '#b6cff2' : '#cdd2db'}`,
    }"
  >
    <UiTooltip
      class="min-w-0 flex-1"
      :text="location.name"
      :disabled="!truncated || disabled"
      :above="tablet"
      :width="cardWidth"
    >
      <template #default="{ describedBy }">
        <button
          type="button"
          class="block h-[54px] w-full min-w-0 rounded-[12px] pl-3 text-left text-base leading-[22px] font-medium text-ink"
          :aria-pressed="selected"
          :aria-describedby="describedBy"
          :disabled="disabled"
          @click="emit('select', $event.currentTarget as HTMLElement)"
        >
          <span ref="name" class="block truncate">{{ location.name }}</span>
          <span class="sr-only">{{ location.active ? 'Активна' : 'Неактивна' }}</span>
        </button>
      </template>
    </UiTooltip>
    <button
      type="button"
      class="mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-field text-brand hover:bg-brand/10 lg:mr-3 lg:size-7"
      aria-label="Изменить точку"
      :disabled="disabled"
      @click="emit('edit', $event.currentTarget as HTMLElement)"
    >
      <UiGlyph name="pencil" class="size-[18px]" />
    </button>
    <UiGlyph
      :name="location.active ? 'point-active' : 'point-inactive'"
      :class="[
        'pointer-events-none absolute -right-[1.13px] -top-[1.13px] size-2',
        location.active ? 'text-success' : 'text-danger',
      ]"
    />
  </div>
</template>
