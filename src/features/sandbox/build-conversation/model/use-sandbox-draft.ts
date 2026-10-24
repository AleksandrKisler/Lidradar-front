/**
 * Черновик текущего пользователя в выбранной организации: читается при смене организации и сохраняется при
 * каждом изменении.
 */
import { computed, ref, watch } from 'vue'
import { useSessionStore } from '@/entities/session'
import { browserStorage, draftStorageKey, readDraft, writeDraft, type SandboxDraft } from './draft'

export function useSandboxDraft() {
  const session = useSessionStore()
  const key = computed(() =>
    session.user && session.tenantId ? draftStorageKey(session.user.id, session.tenantId) : null,
  )
  const draft = ref<SandboxDraft | null>(null)
  watch(
    key,
    (next) => {
      draft.value = next ? readDraft(browserStorage(), next) : null
    },
    { immediate: true },
  )
  function update(next: SandboxDraft | null): void {
    draft.value = next
    if (key.value) writeDraft(browserStorage(), key.value, next)
  }
  return { draft, update }
}
