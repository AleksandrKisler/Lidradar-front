<script lang="ts">
/*
 * Обход Tab внутри окна — общий для `UiDialog` и `UiSheetDialog`. Ловушка фокуса reka-ui замыкает
 * только простой Tab на крайнем элементе, а WebKit/Safari по Tab пропускает кнопки и ссылки (их
 * обходит Option+Tab): с последнего поля фокус уходил из окна. Поэтому окно само переводит фокус по
 * своим доступным элементам в порядке документа.
 * Верхний уровень модуля — без вызовов (список селекторов — литерал, а не `[...].join()`): вызов
 * считается побочным эффектом, и Rolldown затягивал модуль вместе с общим чанком `ui` в критическую
 * загрузку (бюджет `audit:release`, 329 691 B > 304 800).
 * Вложенное окно открывается в своём портале, вне DOM родителя: его Tab родитель не видит.
 */
const CANDIDATES =
  'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),' +
  'select:not([disabled]),textarea:not([disabled]),iframe,summary,' +
  '[contenteditable=""],[contenteditable="true"],[tabindex]'

function isVisible(element: HTMLElement): boolean {
  if (element.closest('[hidden], [inert]')) return false
  // jsdom не умеет checkVisibility: там видимость не проверяется.
  if (typeof element.checkVisibility !== 'function') return true
  return element.checkVisibility({ visibilityProperty: true } as Parameters<
    HTMLElement['checkVisibility']
  >[0])
}

/** Доступные по Tab элементы окна; из группы радиокнопок — только отмеченная (или первая). */
function tabbables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(CANDIDATES)].filter((element) => {
    if (element.tabIndex < 0 || !isVisible(element)) return false
    if (element instanceof HTMLInputElement && element.type === 'radio' && element.name) {
      const group = [
        ...container.querySelectorAll<HTMLInputElement>(
          `input[type="radio"][name="${CSS.escape(element.name)}"]:not([disabled])`,
        ),
      ]
      return element === (group.find((radio) => radio.checked) ?? group[0])
    }
    return true
  })
}

/**
 * Обработчик keydown окна в фазе захвата: Tab/Option+Tab вперёд, с Shift — назад, по кругу.
 * Ctrl/Cmd+Tab остаются командами браузера.
 */
export function keepTabInside(event: KeyboardEvent): void {
  if (event.key !== 'Tab' || event.ctrlKey || event.metaKey) return
  const container = event.currentTarget as HTMLElement
  const items = tabbables(container)
  event.preventDefault()
  event.stopPropagation()
  if (items.length === 0) {
    container.focus()
    return
  }
  const current = items.indexOf(document.activeElement as HTMLElement)
  const step = event.shiftKey ? -1 : 1
  const next =
    current === -1
      ? event.shiftKey
        ? items[items.length - 1]!
        : items[0]!
      : items[(current + step + items.length) % items.length]!
  next.focus()
  // Как при обычном Tab: текст поля выделяется целиком.
  if (next instanceof HTMLInputElement) next.select()
}
</script>

<script setup lang="ts">
/**
 * Модальное окно на Reka UI: ловушка фокуса, возврат фокуса, Escape и
 * портал обеспечены библиотекой. Заголовок обязателен для доступного имени.
 * `dismissible: false` запрещает закрытие Escape, кликом снаружи и крестиком —
 * на время неделимой отправки, чтобы черновик с ключом не потерялся.
 * Tab и Option+Tab окно обходит само по кругу (`keepTabInside`), Ctrl/Cmd+Tab не перехватывает.
 * `initialFocus` — CSS-селектор элемента внутри окна, который получает фокус при открытии вместо
 * первого доступного (кнопки «Закрыть»): окну с единственным полем ввода удобнее начинать с него.
 */
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

const props = withDefaults(
  defineProps<{
    title: string
    description?: string | undefined
    /** `full` — экран целиком (мобильное меню); `md` и `lg` — окно по центру. */
    size?: 'md' | 'lg' | 'full' | undefined
    /** Тёмная поверхность для окон, продолжающих тёмное боковое меню. */
    tone?: 'light' | 'dark' | 'panel' | undefined
    dismissible?: boolean | undefined
    initialFocus?: string | undefined
  }>(),
  {
    description: '',
    size: 'md',
    tone: 'light',
    dismissible: true,
    initialFocus: undefined,
  },
)

const contentClasses = {
  md: 'top-1/2 left-1/2 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card p-6 shadow-xl',
  lg: 'top-1/2 left-1/2 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-card p-6 shadow-xl',
  full: 'inset-0 h-dvh w-full px-5 pt-3 pb-8',
} as const

const toneClasses = {
  light: {
    surface: 'bg-paper',
    title: 'text-ink',
    close: 'text-muted hover:bg-canvas hover:text-ink',
  },
  panel: {
    surface: 'bg-panel text-ink',
    title: 'text-ink',
    close: 'text-muted hover:bg-segment hover:text-ink',
  },
  dark: {
    surface: 'bg-nav text-white',
    title: 'text-white',
    close: 'text-nav-text hover:bg-nav-active hover:text-white',
  },
} as const

/** Переносит начальный фокус на запрошенный элемент; без совпадения остаётся поведение библиотеки. */
function focusInitial(event: Event): void {
  if (!props.initialFocus) return
  const container = event.target instanceof Element ? event.target : null
  const target = container?.querySelector<HTMLElement>(props.initialFocus)
  if (!target) return
  event.preventDefault()
  target.focus()
}

/** Блокирует закрытие, пока диалог нельзя отпускать. */
function guard(event: Event): void {
  if (!props.dismissible) event.preventDefault()
}

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-nav/60" />
      <DialogContent
        :class="['fixed z-50 overflow-y-auto', contentClasses[size], toneClasses[tone].surface]"
        @escape-key-down="guard"
        @interact-outside="guard"
        @open-auto-focus="focusInitial"
        @keydown.capture="keepTabInside"
      >
        <div
          :class="[
            'flex items-center justify-between gap-4',
            size === 'full' ? 'min-h-12' : 'items-start',
          ]"
        >
          <DialogTitle :class="['text-xl font-medium', toneClasses[tone].title]">{{
            title
          }}</DialogTitle>
          <DialogClose
            v-if="dismissible"
            :class="[
              'flex size-10 shrink-0 items-center justify-center rounded-full',
              size === 'full' ? '-mr-2' : '-mt-1 -mr-2',
              toneClasses[tone].close,
            ]"
            aria-label="Закрыть"
          >
            <UiIcon name="close" class="size-6" />
          </DialogClose>
        </div>
        <DialogDescription v-if="description" class="mt-2 text-sm text-muted">{{
          description
        }}</DialogDescription>
        <div :class="size === 'full' ? 'mt-4' : 'mt-5'"><slot /></div>
        <div v-if="$slots.footer" class="mt-6 flex flex-wrap justify-end gap-3">
          <slot name="footer" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
