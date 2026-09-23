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

const props = withDefaults(
  defineProps<{
    title: string
    description?: string | undefined
    size?: 'md' | 'lg' | undefined
    dismissible?: boolean | undefined
  }>(),
  {
    description: '',
    size: 'md',
    dismissible: true,
  },
)

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
        :class="[
          'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-paper p-6 shadow-xl',
          size === 'lg' ? 'max-w-2xl' : 'max-w-md',
        ]"
        @escape-key-down="guard"
        @interact-outside="guard"
      >
        <div class="flex items-start justify-between gap-4">
          <DialogTitle class="text-xl font-bold text-ink">{{ title }}</DialogTitle>
          <DialogClose
            v-if="dismissible"
            class="-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-field text-muted hover:bg-canvas hover:text-ink"
            aria-label="Закрыть"
          >
            <svg
              class="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
            </svg>
          </DialogClose>
        </div>
        <DialogDescription v-if="description" class="mt-2 text-sm text-muted">{{
          description
        }}</DialogDescription>
        <div class="mt-5"><slot /></div>
        <div v-if="$slots.footer" class="mt-6 flex flex-wrap justify-end gap-3">
          <slot name="footer" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
