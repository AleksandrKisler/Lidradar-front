import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient } from '@tanstack/vue-query'
import {
  ApiError,
  RealtimeConnection,
  resetApiContext,
  setApiContext,
  type RealtimeHandlers,
} from '@/shared/api'
import { fetchMe, useSessionStore } from '@/entities/session'
import { installRealtime } from '@/app/config'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

function fakeConnectionFactory() {
  let handlers!: RealtimeHandlers
  const connection = {
    start: vi.fn(),
    stop: vi.fn(),
    notifyOnline: vi.fn(),
    notifyOffline: vi.fn(),
    notifyVisibility: vi.fn(),
  }
  const createConnection = (options: ConstructorParameters<typeof RealtimeConnection>[0]) => {
    handlers = options.handlers
    return connection as unknown as RealtimeConnection
  }
  return { createConnection, connection, handlers: () => handlers }
}

const fakeWindow = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
const fakeDocument = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  visibilityState: 'visible' as DocumentVisibilityState,
}

describe('installRealtime', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetApiContext()
    vi.mocked(fetchMe).mockReset()
  })

  it('открывает поток после выбора организации и закрывает при выходе', async () => {
    vi.mocked(fetchMe).mockResolvedValue({
      user: {
        id: 'u',
        email: 'a@b.c',
        displayName: 'A',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [{ tenantId: 'tenant-a', organizationName: 'A', role: 'OWNER' }],
    })
    const session = useSessionStore()
    const queryClient = new QueryClient()
    const fake = fakeConnectionFactory()
    const realtime = installRealtime({
      session,
      queryClient,
      createConnection: fake.createConnection,
      window: fakeWindow,
      document: fakeDocument,
    })
    expect(fake.connection.stop).toHaveBeenCalledTimes(1)
    await session.bootstrap()
    await nextTick()
    expect(fake.connection.start).toHaveBeenCalledWith('tenant-a')

    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    fake.handlers().onSignal({ type: 'risk.changed', resourceId: 'risk-9' })
    await Promise.resolve()
    const keys = invalidate.mock.calls.map(
      ([filters]) => (filters as { queryKey?: readonly unknown[] } | undefined)?.queryKey,
    )
    expect(keys).toContainEqual(['tenant', 'tenant-a', 'risk', 'risk-9'])
    expect(keys).toContainEqual(['tenant', 'tenant-a', 'risks'])
    expect(keys).toContainEqual(['tenant', 'tenant-a', 'radar'])
    invalidate.mockClear()
    fake.handlers().onResync('RECONNECTED')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tenant', 'tenant-a'] })

    fake.handlers().onStateChange?.('open')
    expect(realtime.state.value).toBe('open')

    session.markExpired()
    await nextTick()
    expect(fake.connection.stop).toHaveBeenCalledTimes(2)
    realtime.dispose()
    expect(fakeWindow.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function))
  })

  it('401 потока передаётся обработчику потери сессии, 403 — нет', () => {
    const onSessionLost = vi.fn()
    setApiContext({ tenantId: () => 'tenant-a', onSessionLost })
    const fake = fakeConnectionFactory()
    installRealtime({
      session: useSessionStore(),
      queryClient: new QueryClient(),
      createConnection: fake.createConnection,
      window: fakeWindow,
      document: fakeDocument,
    })
    fake.handlers().onStop?.(new ApiError({ httpStatus: 403, code: 'FORBIDDEN' }))
    expect(onSessionLost).not.toHaveBeenCalled()
    fake.handlers().onStop?.(new ApiError({ httpStatus: 401, code: 'UNAUTHENTICATED' }))
    expect(onSessionLost).toHaveBeenCalledTimes(1)
  })
})
