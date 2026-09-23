import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore } from '@/entities/session'
import { useSwitchWorkspace } from '@/features/select-workspace'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

describe('смена рабочего пространства', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('отменяет и удаляет запросы прежней организации, затем выбирает новую', async () => {
    vi.mocked(fetchMe).mockResolvedValue({
      user: {
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
    const wrapper = mount(
      defineComponent({
        setup() {
          switcher = useSwitchWorkspace()
          return () => h('div')
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    )

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
})
