<script setup lang="ts">
/**
 * Окно-«лист» диалогов подключения (Figma «Подключить Telegram», «Уведомления в Telegram»,
 * «Подробная инструкция»): знак источника слева от заголовка, подзаголовок, прокручиваемое тело и
 * нижняя панель с разделителем. На телефоне занимает весь экран, кнопки панели идут столбцом
 * (основное сверху), знак скрыт; от планшета — карточка по центру с радиусом 24.
 *
 * Ограничение закрытия, начальный фокус и обход Tab по кругу (`keepTabInside`) — как у `UiDialog`.
 */
import { computed } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import UiIcon from './UiIcon.vue'
import { keepTabInside } from './UiDialog.vue'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string | undefined
    /** Ширина карточки от планшета: 640, 760, 960 или 1120 px. */
    size?: 'sm' | 'md' | 'lg' | 'xl' | undefined
    dismissible?: boolean | undefined
    initialFocus?: string | undefined
    /** Без собственной подложки: окно поверх другого окна, подложка которого уже есть. */
    overlay?: boolean | undefined
    /** Пояснение — первой строкой тела, а не под заголовком (формы и подтверждения настроек). */
    descriptionInBody?: boolean | undefined
    /** Пояснение в теле набрано полужирным (вводный абзац формы). */
    descriptionStrong?: boolean | undefined
    /** Кнопки нижней панели делят ширину поровну (диалоги настроек). */
    footerFill?: boolean | undefined
    /** Окно скрыто, но живёт: его перекрывает вложенное окно (подложка остаётся). */
    concealed?: boolean | undefined
    /** На планшете — поля и пояснение как на десктопе (окна шага «Точки и графики»). */
    tabletAsDesktop?: boolean | undefined
    /** Только desktop формы настроек: gap24 после описания, pb24 с сохранением footer. */
    settingsForm?: boolean | undefined
  }>(),
  {
    description: '',
    size: 'md',
    dismissible: true,
    initialFocus: undefined,
    overlay: true,
    footerFill: false,
    descriptionInBody: false,
    descriptionStrong: false,
    concealed: false,
    tabletAsDesktop: false,
    settingsForm: false,
  },
)

const open = defineModel<boolean>('open', { default: false })
/** Боковые поля: диалоги настроек уже (17/24/32 px), диалоги подключения — 24/32 px. */
const pad = computed(() =>
  props.footerFill
    ? props.tabletAsDesktop
      ? 'px-4 md:px-8'
      : 'px-4 md:px-6 lg:px-8'
    : 'px-6 md:px-8',
)

const widths = {
  sm: 'md:max-w-[640px]',
  md: 'md:max-w-[760px]',
  lg: 'md:max-w-[960px]',
  xl: 'md:max-w-[1120px]',
} as const

function focusInitial(event: Event): void {
  if (!props.initialFocus) return
  const container = event.target instanceof Element ? event.target : null
  const target = container?.querySelector<HTMLElement>(props.initialFocus)
  if (!target) return
  event.preventDefault()
  target.focus()
}

function guard(event: Event): void {
  if (!props.dismissible) event.preventDefault()
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay v-if="overlay" class="fixed inset-0 z-40 bg-black/[.17]" />
      <DialogContent
        :class="[
          'fixed inset-0 z-50 flex h-dvh w-full flex-col bg-paper',
          'md:inset-auto md:left-1/2 md:max-h-[calc(100dvh-8rem)] md:w-[calc(100%-4rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:shadow-xl',
          widths[size],
          // Окна шага «Точки и графики» — точно по центру окна браузера (Figma 02/06/07).
          size === 'xl'
            ? 'md:top-[calc(50%+52px)] md:h-[800px]'
            : tabletAsDesktop
              ? 'md:top-1/2 md:h-auto'
              : 'md:top-[calc(50%+2.5rem)] md:h-auto',
          concealed ? 'invisible' : '',
        ]"
        @escape-key-down="guard"
        @interact-outside="guard"
        @open-auto-focus="focusInitial"
        @keydown.capture="keepTabInside"
      >
        <header
          :class="[
            'grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 pt-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-y-1',
            pad,
            footerFill ? 'md:pt-10' : 'md:pt-8',
          ]"
        >
          <span v-if="$slots.mark" class="row-span-2 hidden md:block"><slot name="mark" /></span>
          <DialogTitle
            :class="[
              'min-w-0 font-semibold text-ink',
              footerFill ? 'text-xl leading-7' : 'text-2xl',
            ]"
            >{{ title }}</DialogTitle
          >
          <DialogClose
            v-if="dismissible"
            class="col-start-2 flex size-8 shrink-0 items-center justify-center rounded-full bg-segment text-muted hover:text-ink md:col-start-3 mr-1.5 md:mr-[7px]"
            aria-label="Закрыть"
          >
            <UiIcon name="close" class="size-5" />
          </DialogClose>
          <DialogDescription
            v-if="description && !descriptionInBody"
            class="col-span-full row-start-2 text-sm text-secondary md:col-span-1 md:col-start-2"
            >{{ description }}</DialogDescription
          >
        </header>
        <div v-if="$slots.toolbar" :class="['shrink-0 pt-[30px]', pad]">
          <slot name="toolbar" />
        </div>
        <div
          :class="[
            'min-h-0 flex-1 overflow-y-auto pb-6',
            pad,
            footerFill ? (tabletAsDesktop ? 'md:pb-6' : 'md:pb-8') : 'md:pb-7',
            settingsForm ? 'lg:pb-6' : '',
            $slots.toolbar ? 'pt-4' : 'pt-[22px] md:pt-[30px]',
          ]"
        >
          <DialogDescription
            v-if="description && descriptionInBody"
            :class="[
              tabletAsDesktop
                ? 'mb-4 text-field leading-6 text-muted md:mb-6 md:text-sm md:leading-5'
                : 'mb-4 text-base leading-6 text-muted lg:text-sm lg:leading-5',
              settingsForm ? 'lg:mb-6' : '',
              descriptionStrong
                ? tabletAsDesktop
                  ? 'font-semibold md:font-normal'
                  : 'font-semibold lg:font-normal'
                : '',
            ]"
            >{{ description }}</DialogDescription
          >
          <slot />
        </div>
        <footer
          v-if="$slots.footer"
          :class="[
            'flex shrink-0 flex-col gap-3 border-t border-hairline py-4 md:flex-row md:items-center md:justify-between',
            footerFill ? (tabletAsDesktop ? 'mx-4 md:mx-8' : 'mx-4 md:mx-6 lg:mx-8') : pad,
            size === 'xl' ? 'md:py-[13px]' : footerFill ? 'md:pt-6 md:pb-8' : 'md:py-5',
          ]"
        >
          <p v-if="$slots.note" class="text-xs text-secondary"><slot name="note" /></p>
          <div
            :class="[
              'flex gap-3 md:flex-row',
              settingsForm ? 'lg:grid lg:grid-cols-2 lg:gap-4' : '',
              footerFill ? 'flex-col md:w-full md:[&>*]:flex-1' : 'flex-col-reverse md:ml-auto',
            ]"
          >
            <slot name="footer" />
          </div>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
