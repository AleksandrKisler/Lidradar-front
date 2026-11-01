<script setup lang="ts">
/**
 * Окно-«лист» диалогов подключения (Figma «Подключить Telegram», «Уведомления в Telegram»,
 * «Подробная инструкция»): знак источника слева от заголовка, подзаголовок, прокручиваемое тело и
 * нижняя панель с разделителем. На телефоне занимает весь экран, кнопки панели идут столбцом
 * (основное сверху), знак скрыт; от планшета — карточка по центру с радиусом 24.
 *
 * Ограничение закрытия, начальный фокус и обход Tab по кругу (`keepTabInside`) — как у `UiDialog`.
 */
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
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
import { useDialogReturnFocus } from './dialog-return-focus'
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
    /** Только полный набор диалогов точки в настройках; остальные consumers сохраняют layout. */
    locationForm?: boolean | undefined
    /** Тот же responsive каркас для форм каталога; остальные consumers прежние. */
    entityForm?: boolean | undefined
    returnFocus?: (() => HTMLElement | null) | undefined
    success?: boolean | undefined
    successHeight?: number | undefined
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
    locationForm: false,
    entityForm: false,
    returnFocus: undefined,
    success: false,
    successHeight: 575,
  },
)

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ closeAutoFocus: [event: Event] }>()
const restoreFocus = useDialogReturnFocus(open, props.returnFocus)
function closeAutoFocus(event: Event) {
  emit('closeAutoFocus', event)
  restoreFocus(event)
}
const pad = computed(() =>
  props.footerFill
    ? props.tabletAsDesktop
      ? 'px-4 md:px-8'
      : 'px-4 md:px-6 lg:px-8'
    : 'px-6 md:px-8',
)
const widths = { sm: 640, md: 760, lg: 960, xl: 1120 } as const
const formLayout = computed(() => props.locationForm || props.entityForm)
const viewport = ref<[height: string, top: string]>(['100dvh', '0px'])
onMounted(() => {
  const view = formLayout.value && window.visualViewport
  if (!view) return
  const update = () => {
    viewport.value = [`${view.height}px`, `${view.offsetTop}px`]
  }
  const events = ['resize', 'scroll']
  update()
  events.forEach((event) => view.addEventListener(event, update))
  onBeforeUnmount(() => events.forEach((event) => view.removeEventListener(event, update)))
})

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
      <DialogOverlay
        v-if="overlay"
        class="fixed inset-0 z-40 bg-black/[.17]"
        :style="entityForm ? { backgroundColor: 'rgb(29 29 31 / 18%)' } : undefined"
        @click="entityForm && dismissible && (open = false)"
      />
      <DialogContent
        :class="[
          'fixed inset-0 z-50 flex h-dvh w-full flex-col bg-paper',
          entityForm ? '' : 'shadow-xl',
          'lr-sc',
          concealed ? 'invisible' : '',
          formLayout ? 'lr-sl md:border md:border-line' : '',
          success ? 'lr-ss' : '',
        ]"
        :style="{
          '--sw': `${widths[size]}px`,
          '--st':
            size === 'xl' ? 'calc(50% + 52px)' : tabletAsDesktop ? '50%' : 'calc(50% + 2.5rem)',
          '--sh': size === 'xl' ? '800px' : 'auto',
          '--ss-h': `${successHeight}px`,
          '--vh': viewport[0],
          '--vt': viewport[1],
        }"
        @escape-key-down="guard"
        @interact-outside="guard"
        @open-auto-focus="focusInitial"
        @close-auto-focus="closeAutoFocus"
        @keydown.capture="keepTabInside"
      >
        <header
          :class="[
            formLayout
              ? 'flex h-16 shrink-0 items-center justify-between gap-4 pl-4 pr-[7px] md:h-auto md:px-8 md:pt-8'
              : [
                  'grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 pt-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-y-1',
                  pad,
                  footerFill ? 'md:pt-10' : 'md:pt-8',
                ],
          ]"
        >
          <span v-if="$slots.mark" class="row-span-2 hidden md:block"><slot name="mark" /></span>
          <DialogTitle
            :class="[
              'min-w-0 font-semibold text-ink',
              footerFill ? 'text-xl leading-7' : 'text-2xl',
              success ? 'sr-only' : '',
            ]"
            >{{ title }}</DialogTitle
          >
          <DialogClose
            v-if="dismissible || formLayout"
            :disabled="!dismissible"
            :class="[
              'flex shrink-0 items-center justify-center rounded-full text-muted hover:text-ink',
              formLayout
                ? 'h-input w-input'
                : 'col-start-2 size-8 bg-segment md:col-start-3 mr-1.5 md:mr-[7px]',
              success ? 'ml-auto' : '',
              formLayout && !dismissible ? 'opacity-45' : '',
            ]"
            aria-label="Закрыть"
          >
            <UiIcon
              name="close"
              :class="formLayout ? 'size-7 rounded-full bg-segment p-1' : 'size-5'"
            />
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
          class="sheet-body"
          :class="[
            'min-h-0 flex-1 overflow-y-auto',
            formLayout
              ? success
                ? 'flex px-4 text-sm leading-5 font-normal md:px-8 md:pb-3'
                : 'px-4 py-4 md:px-8 md:py-6'
              : [
                  'pb-6',
                  pad,
                  footerFill ? (tabletAsDesktop ? 'md:pb-6' : 'md:pb-8') : 'md:pb-7',
                  settingsForm ? 'lg:pb-6' : '',
                  $slots.toolbar ? 'pt-4' : 'pt-[22px] md:pt-[30px]',
                ],
          ]"
        >
          <DialogDescription
            v-if="description && descriptionInBody"
            :class="[
              entityForm && settingsForm ? 'md:pr-4' : '',
              formLayout
                ? 'mb-4 text-sm leading-5 font-normal text-muted md:mb-6'
                : [
                    tabletAsDesktop
                      ? 'mb-4 text-field leading-6 text-muted md:mb-6 md:text-sm md:leading-5'
                      : 'mb-4 text-base leading-6 text-muted lg:text-sm lg:leading-5',
                    settingsForm ? 'lg:mb-6' : '',
                    descriptionStrong
                      ? tabletAsDesktop
                        ? 'font-semibold md:font-normal'
                        : 'font-semibold lg:font-normal'
                      : '',
                  ],
            ]"
            >{{ description }}</DialogDescription
          >
          <slot />
        </div>
        <footer
          v-if="$slots.footer"
          :class="[
            'flex shrink-0 flex-col gap-3 border-t md:flex-row md:items-center md:justify-between',
            formLayout ? 'border-line' : 'border-hairline',
            formLayout
              ? 'p-4 md:mx-8 md:px-0 md:pt-6 md:pb-8'
              : [
                  'py-4',
                  footerFill ? (tabletAsDesktop ? 'mx-4 md:mx-8' : 'mx-4 md:mx-6 lg:mx-8') : pad,
                  size === 'xl' ? 'md:py-[13px]' : footerFill ? 'md:pt-6 md:pb-8' : 'md:py-5',
                ],
          ]"
        >
          <p v-if="$slots.note" class="text-xs text-secondary"><slot name="note" /></p>
          <div
            :class="[
              formLayout
                ? 'flex w-full flex-col-reverse gap-3 md:flex-row md:gap-4 md:[&>*]:flex-1'
                : [
                    'flex gap-3 md:flex-row',
                    settingsForm ? 'lg:grid lg:grid-cols-2 lg:gap-4' : '',
                    footerFill
                      ? 'flex-col md:w-full md:[&>*]:flex-1'
                      : 'flex-col-reverse md:ml-auto',
                  ],
            ]"
          >
            <slot name="footer" />
          </div>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
.lr-sl {
  top: var(--vt);
  height: var(--vh);
}
@media (min-width: 768px) {
  .lr-sc {
    inset: auto;
    left: 50%;
    top: var(--st);
    width: min(100% - 4rem, var(--sw));
    height: var(--sh);
    max-height: calc(100dvh - 8rem);
    translate: -50% -50%;
    border-radius: var(--radius-3xl);
  }
  .lr-sl {
    top: calc(var(--vt) + var(--vh) / 2);
    border-radius: 18px;
    max-height: calc(var(--vh) - 48px);
  }
  .lr-sl.lr-ss {
    height: var(--ss-h);
  }
  /* Keep the 20px help glyph in place while its transparent hit area is 44px. */
  .lr-sl button:has(img) {
    box-sizing: content-box;
    padding: 12px;
    margin: -12px;
  }
}
</style>
