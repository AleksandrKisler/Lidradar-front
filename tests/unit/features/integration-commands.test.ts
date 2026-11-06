import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { ApiError } from '@/shared/api'
import { useSessionStore } from '@/entities/session'
import {
  checkConnectionHealth,
  disconnectChannel,
  integrationKeys,
  type ChannelConnection,
  type ConnectionHealth,
  type HealthCheck,
} from '@/entities/integration'
import { organizationKeys } from '@/entities/organization'
import { useCheckChannelHealth } from '@/features/check-channel-health'
import { useDisconnectChannel } from '@/features/disconnect-channel'

vi.mock('@/entities/integration', async (original) => ({
  ...(await original<typeof import('@/entities/integration')>()),
  checkConnectionHealth: vi.fn(),
  disconnectChannel: vi.fn(),
}))

const connection: ChannelConnection = {
  id: 'connection-a',
  locationId: null,
  provider: 'CONNECTED_BUSINESS_BOT',
  name: 'Telegram',
  status: 'ACTIVE',
  capabilities: ['CAN_RECEIVE_MESSAGES'],
  lastEventAt: null,
  lastSuccessAt: '2026-11-01T10:00:00Z',
  lastErrorAt: null,
  lastErrorCode: null,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
}
const health: ConnectionHealth = {
  status: 'ACTIVE',
  lastEventAt: null,
  lastSuccessAt: connection.lastSuccessAt,
  lastErrorAt: null,
  lastErrorCode: null,
  checkedAt: '2026-11-03T10:00:00Z',
}
const unavailable = () => new ApiError({ httpStatus: 503, code: 'CONNECTOR_UNAVAILABLE' })
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

let queryClient: QueryClient
let session: ReturnType<typeof useSessionStore>
const tenant = ref('tenant-a')
const connectionId = ref('connection-a')
let wrappers: VueWrapper[] = []
function harness<T>(composable: () => T) {
  let command!: T
  const wrapper = mount(
    defineComponent({
      setup() {
        command = composable()
        return () => h('div')
      },
    }),
    {
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    },
  )
  wrappers.push(wrapper)
  return { command, wrapper }
}
const check = () =>
  harness(() =>
    useCheckChannelHealth(
      () => tenant.value,
      () => connectionId.value,
    ),
  )
const disconnect = () =>
  harness(() =>
    useDisconnectChannel(
      () => tenant.value,
      () => connectionId.value,
    ),
  )
function seed() {
  queryClient.setQueryData(integrationKeys.list('tenant-a'), [connection])
  queryClient.setQueryData(integrationKeys.health('tenant-a', 'connection-a'), health)
}
function cachedStatus() {
  return queryClient.getQueryData<ConnectionHealth>(
    integrationKeys.health('tenant-a', 'connection-a'),
  )?.status
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  setActivePinia(createPinia())
  session = useSessionStore()
  session.$patch({
    status: 'authenticated',
    tenantId: 'tenant-a',
    user: {
      id: 'user-a',
      email: 'test@example.test',
      displayName: 'Test',
      status: 'ACTIVE',
      emailVerifiedAt: null,
      deletionDueAt: null,
      createdAt: '',
      updatedAt: '',
    },
    memberships: [
      { tenantId: 'tenant-a', organizationName: 'A', role: 'OWNER' },
      { tenantId: 'tenant-b', organizationName: 'B', role: 'OWNER' },
    ],
  })
  tenant.value = 'tenant-a'
  connectionId.value = 'connection-a'
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers = []
  queryClient.clear()
  vi.restoreAllMocks()
})

describe('US-M04-04 health command', () => {
  it('locks synchronously and publishes the exact REMOTE error health without turning it green', async () => {
    seed()
    const pending = deferred<HealthCheck>()
    vi.mocked(checkConnectionHealth).mockReturnValue(pending.promise)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { command } = check()
    const first = command.run()
    const second = command.run()
    expect(command.isPending.value).toBe(true)
    expect(checkConnectionHealth).toHaveBeenCalledExactlyOnceWith('tenant-a', 'connection-a')
    const checked: HealthCheck = {
      verification: 'REMOTE',
      health: { ...health, status: 'ERROR', lastErrorCode: 'TELEGRAM_WEBHOOK_MISMATCH' },
    }
    pending.resolve(checked)
    await Promise.all([first, second])
    expect(command.result.value).toEqual(checked)
    expect(cachedStatus()).toBe('ERROR')
    expect(
      queryClient.getQueryData<ChannelConnection[]>(integrationKeys.list('tenant-a'))?.[0]
        ?.lastErrorCode,
    ).toBe('TELEGRAM_WEBHOOK_MISMATCH')
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({
      queryKey: integrationKeys.list('tenant-a'),
      exact: true,
    })
    expect(command.isPending.value).toBe(false)
  })

  it('keeps LOCAL verification and the command result across a failed list refresh', async () => {
    seed()
    const checked: HealthCheck = {
      verification: 'LOCAL',
      health: { ...health, status: 'DISCONNECTED' },
    }
    vi.mocked(checkConnectionHealth).mockResolvedValue(checked)
    vi.spyOn(queryClient, 'invalidateQueries').mockRejectedValue(new Error('refresh offline'))
    const { command } = check()
    await command.run()
    expect(command.result.value).toEqual(checked)
    expect(command.error.value).toBeNull()
    expect(cachedStatus()).toBe('DISCONNECTED')
  })

  it('a POST 503 is only a command error and never a local disconnect', async () => {
    seed()
    const cause = unavailable()
    vi.mocked(checkConnectionHealth).mockRejectedValue(cause)
    const { command } = check()
    await command.run()
    expect(command.error.value).toBe(cause)
    expect(command.result.value).toBeNull()
    expect(cachedStatus()).toBe('ACTIVE')
    expect(disconnect().command.outcome.value).toBeNull()
  })

  it('cancels an older health GET before publishing the POST result', async () => {
    seed()
    const oldGet = deferred<ConnectionHealth>()
    const old = queryClient.fetchQuery({
      queryKey: integrationKeys.health('tenant-a', 'connection-a'),
      queryFn: () => oldGet.promise,
    })
    void old.catch(() => undefined)
    const checked: HealthCheck = { verification: 'REMOTE', health: { ...health, status: 'ERROR' } }
    vi.mocked(checkConnectionHealth).mockResolvedValue(checked)
    const { command } = check()
    await command.run()
    oldGet.resolve(health)
    await Promise.resolve()
    expect(cachedStatus()).toBe('ERROR')
    expect(command.result.value).toEqual(checked)
  })
})

describe('US-M04-05 disconnect command', () => {
  it('clears a visible marker synchronously when permissions are revoked', async () => {
    vi.mocked(disconnectChannel).mockRejectedValue(unavailable())
    const { command } = disconnect()
    await command.run()
    expect(command.outcome.value).toBe('partial')
    session.memberships[0]!.role = 'MANAGER'
    expect(command.outcome.value).toBeNull()
    session.memberships[0]!.role = 'OWNER'
    expect(command.outcome.value).toBeNull()
  })

  it('DELETE503 confirms local status, survives remount, and retry204 keeps the remote uncertainty', async () => {
    seed()
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockRejectedValue(new Error('refresh offline'))
    vi.mocked(disconnectChannel)
      .mockRejectedValueOnce(unavailable())
      .mockResolvedValueOnce(undefined)
    const first = disconnect()
    await first.command.run()
    expect(first.command.outcome.value).toBe('partial')
    expect(first.command.error.value).toBeNull()
    expect(cachedStatus()).toBe('DISCONNECTED')
    expect(
      queryClient.getQueryData<ChannelConnection[]>(integrationKeys.list('tenant-a'))?.[0]?.status,
    ).toBe('DISCONNECTED')
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: organizationKeys.onboarding('tenant-a'),
      exact: true,
    })
    first.wrapper.unmount()
    const second = disconnect()
    expect(second.command.outcome.value).toBe('partial')
    await second.command.run()
    expect(second.command.outcome.value).toBe('retried')
    second.wrapper.unmount()
    expect(disconnect().command.outcome.value).toBe('partial')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('plain204 confirms only local disconnect and synchronously prevents duplicate DELETE', async () => {
    seed()
    const pending = deferred<void>()
    vi.mocked(disconnectChannel).mockReturnValue(pending.promise)
    const { command } = disconnect()
    const first = command.run()
    const second = command.run()
    expect(disconnectChannel).toHaveBeenCalledExactlyOnceWith('tenant-a', 'connection-a')
    pending.resolve(undefined)
    await Promise.all([first, second])
    expect(command.outcome.value).toBe('disconnected')
    expect(cachedStatus()).toBe('DISCONNECTED')
  })

  it.each([
    ApiError.network(new Error('timeout')),
    new ApiError({ httpStatus: 500, code: 'INTERNAL' }),
  ])('a general error never invents a partial result (%s)', async (cause) => {
    seed()
    vi.mocked(disconnectChannel).mockRejectedValue(cause)
    const { command } = disconnect()
    await command.run()
    expect(command.error.value).toBe(cause)
    expect(command.outcome.value).toBeNull()
    expect(cachedStatus()).toBe('ACTIVE')
  })

  it('a marker belongs to the exact connection and disappears on identity changes while unmounted', async () => {
    vi.mocked(disconnectChannel).mockRejectedValue(unavailable())
    const first = disconnect()
    await first.command.run()
    connectionId.value = 'connection-b'
    expect(first.command.outcome.value).toBeNull()
    connectionId.value = 'connection-a'
    expect(first.command.outcome.value).toBe('partial')
    first.wrapper.unmount()
    session.user = { ...session.user!, id: 'user-b' }
    session.user = { ...session.user!, id: 'user-a' }
    expect(disconnect().command.outcome.value).toBeNull()
  })

  it.each(['tenant', 'permission'] as const)(
    'a marker resets after %s change even with no mounted card',
    async (change) => {
      vi.mocked(disconnectChannel).mockRejectedValue(unavailable())
      const first = disconnect()
      await first.command.run()
      first.wrapper.unmount()
      if (change === 'tenant') {
        session.tenantId = 'tenant-b'
        session.tenantId = 'tenant-a'
      } else {
        session.memberships[0]!.role = 'MANAGER'
        session.memberships[0]!.role = 'OWNER'
      }
      expect(disconnect().command.outcome.value).toBeNull()
    },
  )
})

for (const kind of ['check', 'disconnect'] as const) {
  describe(`${kind}: captured context`, () => {
    it.each(['tenant', 'connection', 'user', 'permission', 'unmount'] as const)(
      'ignores late response after %s changes',
      async (change) => {
        seed()
        const pendingCheck = deferred<HealthCheck>()
        const pendingDelete = deferred<void>()
        vi.mocked(checkConnectionHealth).mockReturnValue(pendingCheck.promise)
        vi.mocked(disconnectChannel).mockReturnValue(pendingDelete.promise)
        const handle = kind === 'check' ? check() : disconnect()
        const sent = handle.command.run()
        if (change === 'tenant') {
          tenant.value = 'tenant-b'
          session.tenantId = 'tenant-b'
        }
        if (change === 'connection') connectionId.value = 'connection-b'
        if (change === 'user') session.user = { ...session.user!, id: 'user-b' }
        if (change === 'permission') session.memberships[0]!.role = 'MANAGER'
        if (change === 'unmount') handle.wrapper.unmount()
        pendingCheck.resolve({ verification: 'REMOTE', health: { ...health, status: 'ERROR' } })
        pendingDelete.reject(unavailable())
        // Only the selected deferred is consumed by a command.
        if (kind === 'check') void pendingDelete.promise.catch(() => undefined)
        await sent
        expect(cachedStatus()).toBe('ACTIVE')
        expect(queryClient.getQueryData(integrationKeys.list('tenant-b'))).toBeUndefined()
        if ('result' in handle.command) expect(handle.command.result.value).toBeNull()
        else expect(handle.command.outcome.value).toBeNull()
      },
    )

    it('does not send requests without permission or for another active tenant', async () => {
      const handle = kind === 'check' ? check() : disconnect()
      session.memberships[0]!.role = 'MANAGER'
      await handle.command.run()
      session.memberships[0]!.role = 'OWNER'
      tenant.value = 'tenant-b'
      await handle.command.run()
      expect(checkConnectionHealth).not.toHaveBeenCalled()
      expect(disconnectChannel).not.toHaveBeenCalled()
    })
  })
}
