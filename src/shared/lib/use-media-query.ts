import { onScopeDispose, ref } from 'vue'

/** Reactive layout selection, including browser zoom and a resize while a dialog is open. */
export function useMediaQuery(query: string) {
  const media = typeof matchMedia === 'function' ? matchMedia(query) : null
  const matches = ref(media?.matches ?? false)
  const update = (event: MediaQueryListEvent) => {
    matches.value = event.matches
  }
  media?.addEventListener('change', update)
  onScopeDispose(() => media?.removeEventListener('change', update))
  return matches
}
