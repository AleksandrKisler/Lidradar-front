<script setup lang="ts">
/**
 * Модальное окно на Reka UI: ловушка фокуса, возврат фокуса, Escape и
 * портал обеспечены библиотекой. Заголовок обязателен для доступного имени.
 * `dismissible: false` запрещает закрытие Escape, кликом снаружи и крестиком —
 * на время неделимой отправки, чтобы черновик с ключом не потерялся.
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
    tone?: 'light' | 'dark' | undefined
    dismissible?: boolean | undefined
  }>(),
  {
    description: '',
    size: 'md',
    tone: 'light',
    dismissible: true,
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
  dark: {
    surface: 'bg-nav text-white',
    title: 'text-white',
    close: 'text-nav-text hover:bg-nav-active hover:text-white',
  },
} as const

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
