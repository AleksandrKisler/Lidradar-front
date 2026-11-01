<script setup lang="ts">
/** Информационная подсказка в портале: не обрезается таблицей или телом диалога. */
import { onBeforeUnmount, ref, useId, watch, type CSSProperties } from 'vue'

const props = defineProps<{
  text: string
  hoverOnly?: boolean
  disabled?: boolean
  above?: boolean
  alignEnd?: boolean
  width?: number | undefined
  mobileFull?: boolean
  /** Information attached to document content follows its anchor beyond the viewport. */
  documentRelative?: boolean
  toggleOnClick?: boolean
  inverted?: boolean
}>()
const id = useId()
const anchor = ref<HTMLElement>()
const open = ref(false)
const position = ref<CSSProperties>({
  left: '0px',
  top: '0px',
  transform: '',
  width: '',
  position: 'fixed',
})
let timer: ReturnType<typeof setTimeout> | undefined
const touch = ref(false)
function hover() {
  if (
    !props.toggleOnClick ||
    typeof matchMedia === 'undefined' ||
    matchMedia('(hover: hover)').matches
  )
    show()
}
function activate() {
  if (!props.hoverOnly) {
    if (props.toggleOnClick && touch.value && open.value) hide()
    else show()
  }
  touch.value = false
}

function cancelHide() {
  clearTimeout(timer)
}
function hide() {
  cancelHide()
  open.value = false
  window.removeEventListener('scroll', place, true)
  window.removeEventListener('resize', place)
  window.removeEventListener('keydown', escape, true)
}
function escape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // A tooltip left behind a modal must not consume that dialog's Escape.
  if (anchor.value?.closest('[aria-hidden="true"], [inert]')) {
    hide()
    return
  }
  event.preventDefault()
  event.stopPropagation()
  hide()
}
function place() {
  const rect = anchor.value!.getBoundingClientRect()
  if (
    props.disabled ||
    anchor.value?.closest('[aria-hidden="true"], [inert]') ||
    (!props.documentRelative && (rect.bottom < 0 || rect.top > window.innerHeight))
  ) {
    hide()
    return false
  }
  const mobile = props.mobileFull && window.innerWidth < 768
  const width = mobile
    ? window.innerWidth - 32
    : Math.min(props.width ?? 280, window.innerWidth - 32)
  const gap = props.inverted ? 4 : 8
  const above = props.above || (!props.documentRelative && rect.bottom + 180 > window.innerHeight)
  position.value = {
    left: `${(mobile ? 16 : Math.max(8, Math.min(props.alignEnd ? rect.right - width : rect.left - (props.mobileFull ? 80 : 0), window.innerWidth - width - 8))) + (props.documentRelative ? scrollX : 0)}px`,
    top: `${(above ? rect.top - gap : rect.bottom + gap) + (props.documentRelative ? scrollY : 0)}px`,
    width: `${width}px`,
    transform: above ? 'translateY(-100%)' : '',
    position: props.documentRelative ? 'absolute' : 'fixed',
  }
  return true
}
function show() {
  cancelHide()
  if (!place()) return
  open.value = true
  window.addEventListener('scroll', place, true)
  window.addEventListener('resize', place)
  window.addEventListener('keydown', escape, true)
}
function scheduleHide() {
  cancelHide()
  timer = setTimeout(hide, 120)
}
onBeforeUnmount(hide)
watch(
  () => [props.width, props.above],
  () => {
    if (open.value) place()
  },
)
</script>

<template>
  <span
    ref="anchor"
    class="inline-flex items-center"
    @pointerdown="touch = $event.pointerType === 'touch'"
    @pointercancel="touch = false"
    @mouseenter="hover"
    @mouseleave="scheduleHide"
    @focusin="!props.hoverOnly && !touch && show()"
    @focusout="hide"
    @click="activate"
  >
    <slot :described-by="open ? id : undefined" />
    <Teleport to="body">
      <span
        v-if="open"
        :id="id"
        role="tooltip"
        class="ui-tooltip fixed z-[100] text-sm leading-5"
        :class="
          inverted
            ? 'rounded-[18px] bg-ink px-4 py-3 text-white'
            : 'rounded-field border border-line bg-paper p-3 text-ink'
        "
        :style="position"
        @mouseenter="cancelHide"
        @mouseleave="scheduleHide"
        >{{ text }}</span
      >
    </Teleport>
  </span>
</template>

<style>
.ui-tooltip {
  box-shadow: 0 4px 16px #0002;
}
</style>
