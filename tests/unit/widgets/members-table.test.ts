import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { Member } from '@/entities/team'
import { MembersTable } from '@/widgets/team'
const owner: Member = {
  membershipId: 'm1',
  userId: 'u1',
  email: 'owner@example.test',
  displayName: 'Мария',
  role: 'OWNER',
  status: 'ACTIVE',
  revokedAt: null,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
}
const manager: Member = {
  ...owner,
  membershipId: 'm2',
  userId: 'u2',
  displayName: 'Анна',
  role: 'MANAGER',
  email: 'long.email.for-layout@example-organization.test',
}
function render(members: Member[] = [manager, owner]) {
  return mount(MembersTable, {
    props: {
      tenantId: 't1',
      members,
      currentUserId: 'u1',
      timeZone: 'Europe/Moscow',
      headings: true,
    },
    global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] as never },
  })
}
beforeEach(() => setActivePinia(createPinia()))
describe('R54 участники', () => {
  it('показывает владельца первым, «Вы», защиту и доступные имена иконок менеджера', async () => {
    const wrapper = render()
    await vi.dynamicImportSettled()
    const rows = wrapper.findAll('li')
    expect(wrapper.get('ul').attributes('aria-label')).toBe('Участники компании')
    expect(rows[0]!.text()).toContain('Мария · Вы')
    expect(rows[0]!.text()).toContain('Последний владелец')
    expect(rows[0]!.findAll('button')).toHaveLength(0)
    expect(rows[1]!.get('button').attributes('aria-label')).toBe('Изменить доступ: Анна')
    expect(rows[1]!.findAll('button')[1]!.attributes('aria-label')).toBe('Отозвать доступ: Анна')
    expect(rows[1]!.text()).toContain(manager.email)
    expect(rows[1]!.findAll('wbr').length).toBeGreaterThan(4)
    expect(rows[1]!.get('button').classes()).toEqual(expect.arrayContaining(['h-11', 'w-12']))
    wrapper.unmount()
  })
  it('отозванное членство и закрытая учётная запись сохраняются без команд с подтверждённой датой', () => {
    const wrapper = render([
      {
        ...manager,
        status: 'DISABLED',
        revokedAt: '2026-10-14T09:00:00Z',
        email: '',
        displayName: 'Удалён',
      },
    ])
    expect(wrapper.text()).toContain('Отозван')
    expect(wrapper.text()).toContain('14 октября')
    expect(wrapper.get('[data-testid=member-closed-account]').text()).toBe('Учётная запись закрыта')
    expect(wrapper.findAll('button')).toHaveLength(0)
    wrapper.unmount()
  })
})
