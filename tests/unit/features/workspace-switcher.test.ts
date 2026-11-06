import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore, type MembershipSummary } from '@/entities/session'
import { locationKeys, type Location } from '@/entities/location'
import { WorkspaceSwitcher } from '@/features/select-workspace'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

const user = {
  id: 'user-1',
  email: 'a@b.c',
  displayName: 'Мария Владелец',
  status: 'ACTIVE' as const,
  createdAt: '2026-10-13T00:00:00Z',
  updatedAt: '2026-10-13T00:00:00Z',
  emailVerifiedAt: null,
  deletionDueAt: null,
}
const first = { tenantId: 't-1', organizationName: 'Студия «Блик»', role: 'OWNER' as const }
const second = { tenantId: 't-2', organizationName: 'Кофейня', role: 'MANAGER' as const }

async function mountSwitcher(
  memberships: MembershipSummary[],
  variant: 'default' | 'sidebar' | 'card',
  locations?: number,
) {
  vi.mocked(fetchMe).mockResolvedValue({ user, memberships, canCreateOrganization: false })
  const session = useSessionStore()
  await session.bootstrap()
  session.selectTenant('t-1')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (locations !== undefined) {
    queryClient.setQueryData(
      locationKeys.list('t-1'),
      Array.from({ length: locations }, (_, index) => ({ id: `l-${index}` }) as Location),
    )
  }
  const wrapper = mount(WorkspaceSwitcher, {
    props: { variant },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
  return wrapper
}

describe('WorkspaceSwitcher: компактные варианты оболочки Radar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each(['sidebar', 'card'] as const)(
    '%s: одно членство — название, число точек и подпись без роли и списка',
    async (variant) => {
      const wrapper = await mountSwitcher([first], variant, 3)
      expect(wrapper.find('select').exists()).toBe(false)
      expect(wrapper.text()).toContain('Студия «Блик»')
      expect(wrapper.text()).toContain('3 точки')
      expect(wrapper.text()).toContain('Рабочее пространство')
      expect(wrapper.text()).not.toContain('Владелец')
      expect(wrapper.classes().includes('bg-paper')).toBe(variant === 'card')
      wrapper.unmount()
    },
  )

  it('пока список точек не получен или не загрузился, не выдумывает «0 точек»', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
    const wrapper = await mountSwitcher([first], 'sidebar')
    expect(wrapper.text()).toContain('Студия «Блик»')
    expect(wrapper.text()).not.toMatch(/\d+ точ/)
    wrapper.unmount()
  })

  it('несколько членств — подписанный список с прежним переключением', async () => {
    const wrapper = await mountSwitcher([first, second], 'card', 1)
    const select = wrapper.get('select')
    expect(select.attributes('aria-label')).toBe('Рабочее пространство')
    expect(select.findAll('option').map((option) => option.text())).toEqual([
      'Студия «Блик» · Владелец',
      'Кофейня · Менеджер',
    ])
    expect(wrapper.text()).toContain('1 точка')
    wrapper.unmount()
  })

  it('прежний вариант по умолчанию без числа точек показывает роль', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
    const wrapper = await mountSwitcher([first], 'default')
    expect(wrapper.text()).toContain('Владелец')
    wrapper.unmount()
  })
})
