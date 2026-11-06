<script setup lang="ts">
/**
 * Окно «Подробная инструкция»: шестнадцать шагов с обезличенными скриншотами,
 * быстрые переходы по этапам закреплены над списком, возврат к форме — в нижней панели.
 * Клик по скриншоту открывает его крупнее. Окно и мобильные изображения
 * загружаются отдельными фрагментами по мере открытия инструкции.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { UiButton, UiChannelMark, UiSheetDialog } from '@/shared/ui'
import GuideAdaptiveIllustration from './GuideAdaptiveIllustration.vue'
import GuideTabletIllustration from './GuideTabletIllustration.vue'
import { GUIDE_JUMPS, GUIDE_STEPS } from '../model/guide-steps'
import {
  MOBILE_GUIDE_STEPS,
  TABLET_GUIDE_STEPS,
  type AdaptiveGuideStep,
} from '../model/mobile-guide-steps'

const props = withDefaults(
  defineProps<{
    adaptive?: boolean
    overlay?: boolean
    returnFocus?: (() => HTMLElement | null) | undefined
  }>(),
  { adaptive: false, overlay: false, returnFocus: undefined },
)
const width = ref(typeof window === 'undefined' ? 1440 : window.innerWidth)
const layout = computed(() =>
  !props.adaptive || width.value >= 1024 ? 'desktop' : width.value >= 768 ? 'tablet' : 'mobile',
)
const steps = computed<readonly AdaptiveGuideStep[]>(() =>
  layout.value === 'mobile'
    ? MOBILE_GUIDE_STEPS
    : layout.value === 'tablet'
      ? TABLET_GUIDE_STEPS
      : GUIDE_STEPS,
)
const description = computed(() =>
  layout.value === 'mobile'
    ? '16 шагов · Telegram на iPhone'
    : layout.value === 'tablet'
      ? '16 шагов · iPad. Временные кадры macOS; в шаге 15 — iPhone.'
      : '16 шагов в Telegram для macOS. Создание, настройка и подключение.',
)
const adaptiveNarrow = computed(() => props.adaptive && layout.value !== 'desktop')
function resize() {
  width.value = window.innerWidth
}
onMounted(() => window.addEventListener('resize', resize))
onBeforeUnmount(() => window.removeEventListener('resize', resize))

// URL modules load only for the opt-in narrow guide. Images retain native dimensions;
// the browser loads only images in the active guide, with lazy offscreen screenshots.
const mobileModules = import.meta.glob('../guide-mobile/*.{png,svg}', {
  query: '?url&no-inline',
  import: 'default',
})
const mobileAssets = shallowRef<Record<string, string>>({})
let mobileAssetsPromise: Promise<void> | undefined
function loadMobileAssets() {
  mobileAssetsPromise ??= Promise.all(
    Object.entries(mobileModules).map(
      async ([path, load]) => [path, await load()] as [string, string],
    ),
  ).then((entries) => {
    mobileAssets.value = Object.fromEntries(entries)
  })
  return mobileAssetsPromise
}
watch(
  adaptiveNarrow,
  (value) => {
    if (value) void loadMobileAssets()
  },
  { immediate: true },
)
const open = defineModel<boolean>('open', { default: false })

const assets = import.meta.glob('../guide/*.{png,svg}', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
}) as Record<string, string>

function asset(kind: 'step' | 'focus', id: string): string {
  const ext = kind === 'step' ? 'png' : 'svg'
  return assets[`../guide/${kind}-${id}.${ext}`] ?? ''
}

const zoomed = ref<number | null>(null)
const zoomedStep = () => (zoomed.value === null ? null : (steps.value[zoomed.value] ?? null))
const zoomOrigin = ref<HTMLElement | null>(null)
function showZoom(index: number, event: MouseEvent) {
  zoomOrigin.value = event.currentTarget as HTMLElement
  zoomed.value = index
}
function restoreParentFocus(event: Event): void {
  if (!props.returnFocus) return
  // The parent sheet is still concealed during the synchronous unmount event.
  event.preventDefault()
  void nextTick(() => {
    const target = props.returnFocus?.()
    if (target?.isConnected) target.focus()
  })
}
function restoreZoomFocus(event: Event): void {
  event.preventDefault()
  void nextTick(() => {
    if (open.value && zoomed.value === null && zoomOrigin.value?.isConnected) {
      zoomOrigin.value.focus()
    }
  })
}
watch(layout, () => {
  zoomed.value = null
  zoomOrigin.value = null
  document.getElementById('guide-step-1')?.closest('.sheet-body')?.scrollTo?.({ top: 0 })
})
watch(open, (value) => {
  if (!value) zoomed.value = null
})

function jump(step: number): void {
  document.getElementById(`guide-step-${step}`)?.scrollIntoView({ block: 'start' })
}
</script>

<template>
  <UiSheetDialog
    v-model:open="open"
    title="Подключение бота"
    :description="description"
    :settings-redesign="adaptiveNarrow"
    :content-height="layout === 'tablet' ? 1066 : undefined"
    size="xl"
    :overlay="overlay"
    :concealed="zoomed !== null"
    :return-focus="returnFocus"
    @close-auto-focus="restoreParentFocus"
  >
    <template #mark><UiChannelMark kind="telegram" /></template>
    <template #toolbar>
      <nav
        aria-label="Этапы инструкции"
        :class="[
          'grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4',
          adaptiveNarrow && 'guide-nav--adaptive',
        ]"
      >
        <button
          v-for="item in GUIDE_JUMPS"
          :key="item.step"
          type="button"
          class="flex min-h-9 items-center justify-center gap-2 py-1 rounded-control border border-line bg-canvas px-3 text-sm text-link hover:bg-action-pale"
          :class="adaptiveNarrow ? 'guide-jump--adaptive' : undefined"
          @click="jump(item.step)"
        >
          <span class="font-medium whitespace-nowrap">{{ item.range }}</span
          >{{ item.label }}
        </button>
      </nav>
    </template>

    <ol
      class="flex flex-col"
      :data-guide-platform="layout === 'mobile' ? 'iPhone' : 'macOS'"
      :data-guide-layout="layout"
      :class="adaptiveNarrow && 'guide-steps--adaptive'"
    >
      <li
        v-for="(step, index) in steps"
        :id="`guide-step-${index + 1}`"
        :key="index"
        class="flex flex-col gap-6 py-6 lg:flex-row lg:gap-8"
      >
        <div class="flex flex-col gap-4 lg:w-[504px] lg:shrink-0">
          <p class="text-xs text-secondary">{{ step.group }}</p>
          <div class="flex h-12 items-center gap-3">
            <span
              class="flex size-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-paper text-xs font-semibold text-secondary"
              aria-hidden="true"
              >{{ index + 1 }}</span
            >
            <h3 class="text-sm font-medium text-ink">
              <span class="sr-only">Шаг {{ index + 1 }}. </span>{{ step.title }}
            </h3>
          </div>
          <p class="text-sm text-secondary">{{ step.text }}</p>
          <p class="text-xs text-secondary">{{ step.hint }}</p>
        </div>
        <button
          v-if="step.visual"
          type="button"
          class="guide-adaptive-shot"
          :class="layout === 'tablet' && index === 14 ? 'guide-adaptive-shot--phone' : ''"
          :aria-label="`Увеличить скриншот шага ${index + 1}`"
          @click="showZoom(index, $event)"
        >
          <GuideAdaptiveIllustration
            v-if="Object.keys(mobileAssets).length"
            :step="step"
            :assets="mobileAssets"
          />
        </button>
        <button
          v-else-if="layout === 'tablet'"
          type="button"
          class="guide-adaptive-shot"
          :aria-label="`Увеличить скриншот шага ${index + 1}`"
          @click="showZoom(index, $event)"
        >
          <GuideTabletIllustration :step="step" :assets="assets" />
        </button>
        <button
          v-else
          type="button"
          class="relative aspect-[520/336] w-full max-w-[520px] shrink-0 overflow-hidden rounded-control bg-canvas lg:w-[520px]"
          :aria-label="`Увеличить скриншот шага ${index + 1}`"
          @click="showZoom(index, $event)"
        >
          <img
            :src="asset('step', step.shot)"
            alt=""
            loading="lazy"
            class="absolute inset-0 size-full object-cover"
          />
          <img :src="asset('focus', step.focus)" alt="" class="absolute inset-0 size-full" />
          <span
            v-for="(frame, n) in step.frames"
            :key="n"
            class="absolute border-[1.5px] border-brand"
            :style="{
              left: `${(frame[0] / 520) * 100}%`,
              top: `${(frame[1] / 336) * 100}%`,
              width: `${(frame[2] / 520) * 100}%`,
              height: `${(frame[3] / 336) * 100}%`,
              borderRadius: `${frame[4]}px`,
            }"
          />
        </button>
      </li>
    </ol>

    <template #note>{{
      layout === 'mobile'
        ? 'Скриншоты iPhone · 30.10.2026. Нажмите на изображение, чтобы рассмотреть действие.'
        : layout === 'tablet'
          ? 'Увеличение доступно для приложенных изображений.'
          : 'Нажмите на скриншот, чтобы увеличить. Личные данные скрыты.'
    }}</template>
    <template #footer>
      <UiButton variant="secondary" @click="open = false">Вернуться к подключению</UiButton>
    </template>

    <UiSheetDialog
      v-if="zoomedStep()"
      :open="true"
      :title="`Шаг ${(zoomed ?? 0) + 1}. ${zoomedStep()?.title ?? ''}`"
      size="xl"
      :overlay="false"
      :return-focus="() => zoomOrigin"
      @close-auto-focus="restoreZoomFocus"
      @update:open="(value: boolean) => !value && (zoomed = null)"
    >
      <div
        v-if="zoomedStep()?.visual"
        class="guide-zoom-visual mx-auto w-full"
        :style="{ maxWidth: `${zoomedStep()!.visual!.width * 2}px` }"
      >
        <GuideAdaptiveIllustration :step="zoomedStep()!" :assets="mobileAssets" zoom />
      </div>
      <div v-else-if="layout === 'tablet'" class="mx-auto w-full max-w-[1040px]">
        <GuideTabletIllustration :step="zoomedStep()!" :assets="assets" zoom />
      </div>
      <div
        v-else
        class="relative mx-auto aspect-[520/336] w-full max-w-[1040px] overflow-hidden rounded-control bg-canvas"
      >
        <img
          :src="asset('step', zoomedStep()!.shot)"
          alt=""
          class="absolute inset-0 size-full object-cover"
        />
        <img :src="asset('focus', zoomedStep()!.focus)" alt="" class="absolute inset-0 size-full" />
        <span
          v-for="(frame, n) in zoomedStep()!.frames"
          :key="n"
          class="absolute border-2 border-brand"
          :style="{
            left: `${(frame[0] / 520) * 100}%`,
            top: `${(frame[1] / 336) * 100}%`,
            width: `${(frame[2] / 520) * 100}%`,
            height: `${(frame[3] / 336) * 100}%`,
            borderRadius: `${frame[4]}px`,
          }"
        />
      </div>
      <template #footer>
        <UiButton variant="secondary" @click="zoomed = null">Закрыть</UiButton>
      </template>
    </UiSheetDialog>
  </UiSheetDialog>
</template>

<style>
/* Local opt-in selectors: the shared sheet and default onboarding retain their layout. */
.guide-adaptive-shot {
  display: block;
  width: 100%;
  flex-shrink: 0;
  overflow: hidden;
  cursor: pointer;
}
.guide-adaptive-shot--phone {
  max-width: 342px;
}
@media (max-width: 1023px) {
  .lr-sc:has(.guide-nav--adaptive) {
    border: 0;
  }
  .lr-sc:has(.guide-nav--adaptive) > header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 6px 16px;
    height: auto;
    padding: 24px;
  }
  .lr-sc:has(.guide-nav--adaptive) > header h2 {
    font-size: 24px;
    line-height: 30px;
  }
  .lr-sc:has(.guide-nav--adaptive) > header > p {
    grid-column: 1;
    grid-row: 2;
    font-size: 14px;
    line-height: 20px;
    color: #565b64;
  }
  .lr-sc:has(.guide-nav--adaptive) > header > button {
    grid-column: 2;
    grid-row: 1 / span 2;
    width: 46px;
    height: 46px;
    padding: 0;
    margin: 0;
  }
  .lr-sc:has(.guide-nav--adaptive) > header + div {
    padding: 0 24px 12px;
  }
  .guide-nav--adaptive {
    gap: 8px;
  }
  .guide-nav--adaptive > .guide-jump--adaptive {
    min-width: 0;
    min-height: 46px;
    gap: 4px;
    padding: 0 4px;
    white-space: nowrap;
    font-size: clamp(11px, 3.59vw, 14px);
    line-height: 20px;
    font-weight: 500;
    border-radius: 9px;
  }
  .lr-sc:has(.guide-nav--adaptive) > .sheet-body {
    padding: 0 24px;
    overflow-x: hidden;
  }
  .lr-sc:has(.guide-nav--adaptive) .guide-steps--adaptive button {
    box-sizing: border-box;
    padding: 0;
    margin: 0;
  }
  .guide-steps--adaptive > li {
    gap: 20px;
  }
  .guide-steps--adaptive > li > div {
    min-width: 0;
  }
  .guide-steps--adaptive > li > div > p:first-child,
  .guide-steps--adaptive > li > div > p:last-child {
    font-size: 14px;
    line-height: 20px;
  }
  .guide-steps--adaptive > li > div > div {
    height: auto;
    min-height: 24px;
  }
  .guide-steps--adaptive h3 {
    min-width: 0;
    font-size: 17px;
    line-height: 24px;
    font-weight: 600;
  }
  .guide-steps--adaptive > li > div > p:nth-last-child(2) {
    font-size: 17px;
    line-height: 25px;
  }
  .lr-sc:has(.guide-nav--adaptive) > footer {
    gap: 12px;
    padding: 20px 24px;
  }
  .lr-sc:has(.guide-nav--adaptive) > footer > div {
    margin: 0;
    width: 100%;
  }
  .lr-sc:has(.guide-nav--adaptive) > footer button {
    height: 46px;
    min-height: 46px;
    font-size: 17px;
  }
}
@media (min-width: 768px) and (max-width: 1023px) {
  .lr-sc:has(.guide-nav--adaptive) {
    max-height: calc(100dvh - 128px);
    border-radius: 18px;
  }
  .lr-sc:has(.guide-nav--adaptive) > header {
    grid-template-columns: 40px minmax(0, 1fr) auto;
    padding: 32px;
  }
  .lr-sc:has(.guide-nav--adaptive) > header h2,
  .lr-sc:has(.guide-nav--adaptive) > header > p {
    grid-column: 2;
  }
  .lr-sc:has(.guide-nav--adaptive) > header > button {
    grid-column: 3;
  }
  .lr-sc:has(.guide-nav--adaptive) > header + div {
    padding-inline: 32px;
  }
  .guide-nav--adaptive {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .lr-sc:has(.guide-nav--adaptive) > .sheet-body {
    padding-inline: 32px;
  }
  .guide-steps--adaptive > li {
    gap: 24px;
  }
  .guide-steps--adaptive > li > button:not(.guide-adaptive-shot--phone) {
    max-width: none;
  }
  .guide-steps--adaptive > li > div > p:nth-last-child(2) {
    font-size: 16px;
    line-height: 24px;
  }
  .lr-sc:has(.guide-nav--adaptive) > footer {
    gap: 24px;
    padding-inline: 32px;
  }
  .lr-sc:has(.guide-nav--adaptive) > footer > p {
    flex: 1;
  }
  .lr-sc:has(.guide-nav--adaptive) > footer > div {
    width: 300px;
    flex: 0 0 300px;
  }
}
</style>
