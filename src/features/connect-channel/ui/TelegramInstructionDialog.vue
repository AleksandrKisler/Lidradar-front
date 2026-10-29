<script setup lang="ts">
/**
 * Окно «Подробная инструкция» (Figma 479:24381): шестнадцать шагов с обезличенными скриншотами,
 * быстрые переходы по этапам закреплены над списком, возврат к форме — в нижней панели.
 * Клик по скриншоту открывает его крупнее. Окно грузится отдельным фрагментом: скриншоты весят
 * около двух мегабайт и нужны только тем, кто открыл инструкцию.
 */
import { ref } from 'vue'
import { UiButton, UiChannelMark, UiSheetDialog } from '@/shared/ui'
import { GUIDE_JUMPS, GUIDE_STEPS, type GuideStep } from '../model/guide-steps'

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
const zoomedStep = (): GuideStep | null =>
  zoomed.value === null ? null : (GUIDE_STEPS[zoomed.value] ?? null)

function jump(step: number): void {
  document.getElementById(`guide-step-${step}`)?.scrollIntoView({ block: 'start' })
}
</script>

<template>
  <UiSheetDialog
    v-model:open="open"
    title="Подключение бота"
    description="16 шагов в Telegram для macOS. Создание, настройка и подключение."
    size="xl"
    :overlay="false"
    :concealed="zoomed !== null"
  >
    <template #mark><UiChannelMark kind="telegram" /></template>
    <template #toolbar>
      <nav aria-label="Этапы инструкции" class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <button
          v-for="item in GUIDE_JUMPS"
          :key="item.step"
          type="button"
          class="flex min-h-9 items-center justify-center gap-2 py-1 rounded-control border border-line bg-canvas px-3 text-sm text-link hover:bg-action-pale"
          @click="jump(item.step)"
        >
          <span class="font-medium whitespace-nowrap">{{ item.range }}</span
          >{{ item.label }}
        </button>
      </nav>
    </template>

    <ol class="flex flex-col">
      <li
        v-for="(step, index) in GUIDE_STEPS"
        :id="`guide-step-${index + 1}`"
        :key="step.title"
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
          type="button"
          class="relative aspect-[520/336] w-full max-w-[520px] shrink-0 overflow-hidden rounded-control bg-canvas lg:w-[520px]"
          :aria-label="`Увеличить скриншот шага ${index + 1}`"
          @click="zoomed = index"
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

    <template #note>Нажмите на скриншот, чтобы увеличить. Личные данные скрыты.</template>
    <template #footer>
      <UiButton variant="secondary" @click="open = false">Вернуться к подключению</UiButton>
    </template>

    <UiSheetDialog
      v-if="zoomedStep()"
      :open="true"
      :title="`Шаг ${(zoomed ?? 0) + 1}. ${zoomedStep()?.title ?? ''}`"
      size="xl"
      :overlay="false"
      @update:open="(value: boolean) => !value && (zoomed = null)"
    >
      <div
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
