/** Подключение Telegram без сохранения write-only токена в mutation cache. */
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { organizationKeys } from '@/entities/organization'
import { useSessionStore } from '@/entities/session'
import {
  connectChannel,
  integrationKeys,
  type ConnectChannelRequest,
  type ConnectedChannel,
} from '@/entities/integration'

export function useConnectChannel(tenantId: () => string) {
  const queryClient = useQueryClient()
  const session = useSessionStore()
  const isPending = ref(false)
  const error = shallowRef<unknown>(null)
  const canSubmit = computed(
    () => !!tenantId() && session.tenantId === tenantId() && session.can('integration.manage'),
  )
  const contextKey = computed(() =>
    JSON.stringify([
      tenantId(),
      session.tenantId,
      session.user?.id,
      session.role,
      session.can('integration.manage'),
    ]),
  )
  let generation = 0
  let disposed = false

  function reset(): void {
    generation++
    error.value = null
    isPending.value = false
  }

  watch(contextKey, reset, { flush: 'sync' })
  onScopeDispose(() => {
    disposed = true
    reset()
  })

  async function mutateAsync(body: ConnectChannelRequest): Promise<ConnectedChannel | null> {
    // Getter и права могут измениться после открытия формы: проверяем перед самой командой.
    if (disposed || isPending.value || !canSubmit.value) return null
    const capturedTenant = tenantId()
    const capturedContext = contextKey.value
    const requestGeneration = ++generation
    const current = () =>
      !disposed && generation === requestGeneration && contextKey.value === capturedContext
    error.value = null
    isPending.value = true
    try {
      // Тело существует только в стеке команды/API, не в TanStack variables или data.
      const created = await connectChannel(capturedTenant, 'CONNECTED_BUSINESS_BOT', body)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: integrationKeys.list(capturedTenant) }),
        queryClient.invalidateQueries({ queryKey: organizationKeys.onboarding(capturedTenant) }),
      ])
      return current() ? created : null
    } catch (cause) {
      if (current()) error.value = cause
      throw cause
    } finally {
      if (current()) isPending.value = false
    }
  }

  return { mutateAsync, reset, error, isPending, canSubmit, contextKey }
}
