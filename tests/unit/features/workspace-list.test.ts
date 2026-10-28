import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore, type MembershipSummary } from '@/entities/session'
import { WorkspaceList } from '@/features/select-workspace'

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

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
}

async function mountList(
  memberships: MembershipSummary[],
  props: { loading?: boolean; open?: (id: string) => Promise<unknown>; reload?: () => void } = {},
) {
  vi.mocked(fetchMe).mockResolvedValue({ user, memberships, canCreateOrganization: false })
  const session = useSessionStore()
  await session.bootstrap()
  const wrapper = mount(WorkspaceList, {
    props,
    global: {
      plugins: [
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
      ],
    },
  })
  return { wrapper, session }
}

describe('WorkspaceList: выбор рабочего пространства', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.mocked(fetchMe).mockReset()
  })

  it('показывает организации с ролями и отмечает только текущую', async () => {
    const { wrapper, session } = await mountList([first, second])
    session.selectTenant('t-2')
    await settle()
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Студия «Блик»')
    expect(items[0]!.text()).toContain('Владелец')
    expect(items[0]!.text()).not.toContain('Текущее')
    expect(items[1]!.text()).toContain('Кофейня')
    expect(items[1]!.text()).toContain('Менеджер')
    expect(items[1]!.text()).toContain('Текущее')
    expect(items[1]!.get('button').attributes('aria-current')).toBe('true')
    wrapper.unmount()
  })

  it('выбор запоминается и передаётся переходу; список блокируется и объявляет открытие в живой области', async () => {
    let finish: () => void = () => {}
    const open = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    const { wrapper, session } = await mountList([first, second], { open })
    await wrapper.findAll('button')[1]!.trigger('click')
    await settle()
    expect(open).toHaveBeenCalledWith('t-2')
    expect(session.tenantId).toBe('t-2')
    expect(wrapper.get('[role="status"]').text()).toContain('Открываем пространство…')
    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('disabled')).toBeDefined()
    }
    // Пока пространство открывается, все кнопки заблокированы и второй выбор невозможен.
    expect(open).toHaveBeenCalledTimes(1)
    finish()
    await settle()
    expect(wrapper.emitted('selected')).toEqual([['t-2']])
    expect(wrapper.get('[role="status"]').text()).toBe('')
    wrapper.unmount()
  })

  it('страница не открылась: список остаётся, «Повторить» загружает страницу заново, членства не трогает', async () => {
    const open = vi.fn().mockRejectedValue(new Error('chunk'))
    const reload = vi.fn()
    const { wrapper } = await mountList([first, second], { open, reload })
    await wrapper.findAll('button')[0]!.trigger('click')
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось загрузить пространства')
    expect(wrapper.findAll('li')).toHaveLength(2)
    expect(wrapper.emitted('selected')).toBeUndefined()
    const reads = vi.mocked(fetchMe).mock.calls.length
    await wrapper.get('button:not(li button)').trigger('click')
    await settle()
    // Не загрузившийся модуль браузер повторно не запрашивает: нужна полная перезагрузка.
    expect(reload).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetchMe).mock.calls.length).toBe(reads)
    expect(open).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('первичная загрузка: каркас без данных организации и без кнопок выбора', async () => {
    const { wrapper } = await mountList([first, second], { loading: true })
    expect(wrapper.find('ul').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Студия')
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Загрузка')
    wrapper.unmount()
  })
})
