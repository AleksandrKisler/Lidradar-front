import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, QueryObserver } from '@tanstack/vue-query'
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
  it('без сигналов SSE получает новый REST snapshot и восстанавливается после ошибки', async () => {
    vi.useFakeTimers()
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
    await session.bootstrap()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    })
    let revision = 1
    let unavailable = false
    const read = vi.fn(async () => {
      if (unavailable) throw new Error('REST unavailable')
      return revision
    })
    const observer = new QueryObserver(queryClient, {
      queryKey: ['tenant', 'tenant-a', 'radar'],
      queryFn: read,
      staleTime: Infinity,
    })
    const otherTenantRead = vi.fn(async () => 1)
    const other = new QueryObserver(queryClient, {
      queryKey: ['tenant', 'tenant-b', 'radar'],
      queryFn: otherTenantRead,
      staleTime: Infinity,
    })
    const unsubscribe = observer.subscribe(() => {})
    const unsubscribeOther = other.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    const fake = fakeConnectionFactory()
    const realtime = installRealtime({
      session,
      queryClient,
      createConnection: fake.createConnection,
      window: fakeWindow,
      document: fakeDocument,
    })
    fake.handlers().onStateChange?.('open')
    expect(observer.getCurrentResult().data).toBe(1)
    revision = 2 // Commit was not followed by a signal to this connected client.
    await vi.advanceTimersByTimeAsync(15_000)
    expect(observer.getCurrentResult().data).toBe(2)
    expect(otherTenantRead).toHaveBeenCalledTimes(1)
    unavailable = true
    await vi.advanceTimersByTimeAsync(15_000)
    expect(observer.getCurrentResult().isError).toBe(true)
    expect(observer.getCurrentResult().data).toBe(2)
    unavailable = false
    revision = 3
    await vi.advanceTimersByTimeAsync(15_000)
    expect(observer.getCurrentResult().data).toBe(3)
    expect(observer.getCurrentResult().isError).toBe(false)
    expect(read).toHaveBeenCalledTimes(4)
    realtime.dispose()
    unsubscribe()
    unsubscribeOther()
    queryClient.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })
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
    const realtime = installRealtime({
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
    realtime.dispose()
  })

  it('живой SSE без событий: сверяет видимые данные, останавливается offline/hidden/logout', async () => {
    vi.useFakeTimers()
    const session = useSessionStore()
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
    await session.bootstrap()
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const fake = fakeConnectionFactory()
    const targetWindow = new EventTarget()
    const targetDocument = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    const realtime = installRealtime({
      session,
      queryClient,
      createConnection: fake.createConnection,
      window: targetWindow,
      document: targetDocument as Document,
    })
    fake.handlers().onStateChange?.('open')
    await vi.advanceTimersByTimeAsync(15_000)
    expect(invalidate).toHaveBeenCalledWith(
      { queryKey: ['tenant', 'tenant-a'], refetchType: 'active' },
      { cancelRefetch: false },
    )
    expect(invalidate).toHaveBeenCalledTimes(1)
    targetDocument.visibilityState = 'hidden'
    targetDocument.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(invalidate).toHaveBeenCalledTimes(1)
    targetDocument.visibilityState = 'visible'
    targetDocument.dispatchEvent(new Event('visibilitychange'))
    expect(invalidate).toHaveBeenCalledTimes(2)
    targetWindow.dispatchEvent(new Event('offline'))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(invalidate).toHaveBeenCalledTimes(2)
    targetWindow.dispatchEvent(new Event('online'))
    expect(invalidate).toHaveBeenCalledTimes(3)
    session.markExpired()
    await nextTick()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(invalidate).toHaveBeenCalledTimes(3)
    realtime.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })
})
