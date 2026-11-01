import { watch, type Ref } from 'vue'

/** External v-model dialogs have no DialogTrigger; retain the actual invoking control. */
export function useDialogReturnFocus(
  open: Ref<boolean>,
  fallback?: () => HTMLElement | null | undefined,
) {
  let origin: HTMLElement | null = null
  watch(
    open,
    (value) => {
      if (!value || typeof document === 'undefined') return
      const active = document.activeElement
      origin = active instanceof HTMLElement && active !== document.body ? active : null
    },
    { immediate: true, flush: 'sync' },
  )
  return (event: Event) => {
    if (event.defaultPrevented) return
    const target =
      origin?.isConnected && (!fallback || origin.getClientRects().length) ? origin : fallback?.()
    if (!target?.isConnected) return
    event.preventDefault()
    target.focus({ preventScroll: true })
  }
}
