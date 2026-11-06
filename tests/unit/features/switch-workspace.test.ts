import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, type VNode } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, useQuery, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore } from '@/entities/session'
import { useSwitchWorkspace, useWorkspaceSwitchGuard } from '@/features/select-workspace'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

function mountProbe(queryClient: QueryClient, setup: () => () => VNode) {
  return mount(defineComponent({ setup }), {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
}

describe('смена рабочего пространства', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('отменяет и удаляет запросы прежней организации, затем выбирает новую', async () => {
    vi.mocked(fetchMe).mockResolvedValue({
      canCreateOrganization: false,
      user: {
        emailVerifiedAt: null,
        deletionDueAt: null,
        id: 'u',
        email: 'a@b.c',
        displayName: 'A',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [
        { tenantId: 'tenant-a', organizationName: 'A', role: 'OWNER' },
        { tenantId: 'tenant-b', organizationName: 'B', role: 'MANAGER' },
      ],
    })
    const session = useSessionStore()
    await session.bootstrap()
    session.selectTenant('tenant-a')

    const queryClient = new QueryClient()
    queryClient.setQueryData(['tenant', 'tenant-a', 'radar', {}], { openRisks: 1 })
    queryClient.setQueryData(['tenant', 'tenant-b', 'radar', {}], { openRisks: 2 })
    queryClient.setQueryData(['auth', 'me'], { user: 'kept' })
    const cancel = vi.spyOn(queryClient, 'cancelQueries')

    let switcher!: ReturnType<typeof useSwitchWorkspace>
    const wrapper = mountProbe(queryClient, () => {
      switcher = useSwitchWorkspace()
      return () => h('div')
    })

    expect(await switcher.switchTo('tenant-b')).toBe(true)
    expect(cancel).toHaveBeenCalledWith({ queryKey: ['tenant', 'tenant-a'] })
    expect(queryClient.getQueryData(['tenant', 'tenant-a', 'radar', {}])).toBeUndefined()
    expect(queryClient.getQueryData(['tenant', 'tenant-b', 'radar', {}])).toEqual({ openRisks: 2 })
    expect(queryClient.getQueryData(['auth', 'me'])).toEqual({ user: 'kept' })
    expect(session.tenantId).toBe('tenant-b')

    expect(await switcher.switchTo('tenant-foreign')).toBe(false)
    expect(session.tenantId).toBe('tenant-b')
    expect(await switcher.switchTo('tenant-b')).toBe(true)
    wrapper.unmount()
  })

  it('поздний ответ A после переключения на B не возвращается в экран или кеш', async () => {
    vi.mocked(fetchMe).mockResolvedValue({
      canCreateOrganization: false,
      user: {
        emailVerifiedAt: null,
        deletionDueAt: null,
        id: 'u',
        email: 'a@b.c',
        displayName: 'A',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [
        { tenantId: 'tenant-a', organizationName: 'A', role: 'OWNER' },
        { tenantId: 'tenant-b', organizationName: 'B', role: 'MANAGER' },
      ],
    })
    const session = useSessionStore()
    await session.bootstrap()
    session.selectTenant('tenant-a')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let deliverA!: (data: { openRisks: number }) => void
    const replyA = new Promise<{ openRisks: number }>((resolve) => (deliverA = resolve))
    let signalA: AbortSignal | undefined
    let deliveredA = false
    let switcher!: ReturnType<typeof useSwitchWorkspace>
    const wrapper = mountProbe(queryClient, () => {
      switcher = useSwitchWorkspace()
      const query = useQuery({
        queryKey: computed(() => ['tenant', session.tenantId, 'radar']),
        queryFn: async ({ queryKey, signal }) => {
          if (queryKey[1] === 'tenant-a') {
            signalA = signal
            // Транспорт намеренно игнорирует abort и всё равно отдаёт ответ позже.
            const data = await replyA
            deliveredA = true
            return data
          }
          return { openRisks: 2 }
        },
      })
      return () => h('output', String(query.data.value?.openRisks ?? 'loading'))
    })
    await vi.waitFor(() => expect(signalA).toBeDefined())
    expect(await switcher.switchTo('tenant-b')).toBe(true)
    expect(signalA!.aborted).toBe(true)
    await vi.waitFor(() => expect(wrapper.text()).toBe('2'))

    deliverA({ openRisks: 999 })
    await vi.waitFor(() => expect(deliveredA).toBe(true))
    await flushPromises()
    expect(session.tenantId).toBe('tenant-b')
    expect(wrapper.text()).toBe('2')
    expect(queryClient.getQueryData(['tenant', 'tenant-a', 'radar'])).toBeUndefined()
    expect(queryClient.getQueryData(['tenant', 'tenant-b', 'radar'])).toEqual({ openRisks: 2 })
    wrapper.unmount()
    queryClient.clear()
  })
  it('подтверждение страницы предшествует очистке кеша; отмена и busy сохраняют организацию', async () => {
    vi.mocked(fetchMe).mockResolvedValue({
      canCreateOrganization: false,
      user: {
        emailVerifiedAt: null,
        deletionDueAt: null,
        id: 'u',
        email: 'a@b.c',
        displayName: 'A',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [
        { tenantId: 'tenant-a', organizationName: 'A', role: 'OWNER' },
        { tenantId: 'tenant-b', organizationName: 'B', role: 'OWNER' },
      ],
    })
    const session = useSessionStore()
    await session.bootstrap()
    session.selectTenant('tenant-a')
    const queryClient = new QueryClient()
    queryClient.setQueryData(['tenant', 'tenant-a', 'radar'], 'kept')
    const cancel = vi.spyOn(queryClient, 'cancelQueries')
    let decide!: (value: boolean) => void
    const guard = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          decide = resolve
        }),
    )
    const page = mountProbe(queryClient, () => {
      useWorkspaceSwitchGuard(guard)
      return () => h('div')
    })
    let switcher!: ReturnType<typeof useSwitchWorkspace>
    const shell = mountProbe(queryClient, () => {
      switcher = useSwitchWorkspace()
      return () => h('div')
    })
    const first = switcher.switchTo('tenant-b')
    expect(guard).toHaveBeenCalledTimes(1)
    expect(cancel).not.toHaveBeenCalled()
    expect(session.tenantId).toBe('tenant-a')
    decide(false)
    expect(await first).toBe(false)
    expect(queryClient.getQueryData(['tenant', 'tenant-a', 'radar'])).toBe('kept')
    expect(cancel).not.toHaveBeenCalled()
    const second = switcher.switchTo('tenant-b')
    decide(true)
    expect(await second).toBe(true)
    expect(cancel).toHaveBeenCalledOnce()
    expect(session.tenantId).toBe('tenant-b')
    page.unmount()
    // Guard removed with the page: unrelated consumers have their former switching behavior.
    expect(await switcher.switchTo('tenant-a')).toBe(true)
    expect(guard).toHaveBeenCalledTimes(2)
    shell.unmount()
  })
})
