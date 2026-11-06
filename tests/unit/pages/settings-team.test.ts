import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import { fetchMe, useSessionStore } from '@/entities/session'
import { teamKeys } from '@/entities/team'
import SettingsTeamPage from '@/pages/settings/ui/SettingsTeamPage.vue'
vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))
const member = {
  membershipId: 'm1',
  userId: 'u1',
  email: 'maria@example.test',
  displayName: 'Мария',
  role: 'OWNER',
  status: 'ACTIVE',
  revokedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
}
const user = {
  id: 'u1',
  email: 'maria@example.test',
  displayName: 'Мария',
  status: 'ACTIVE' as const,
  createdAt: '',
  updatedAt: '',
  emailVerifiedAt: null,
  deletionDueAt: null,
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const wrappers: Array<{ unmount(): void }> = []
async function setup(role: 'OWNER' | 'MANAGER' = 'OWNER', invitationsFail = false) {
  const pinia = createPinia()
  setActivePinia(pinia)
  localStorage.clear()
  vi.mocked(fetchMe).mockResolvedValue({
    user,
    memberships: [{ tenantId: 't1', organizationName: 'Студия', role }],
    canCreateOrganization: false,
  })
  await useSessionStore().bootstrap()
  const requests: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname
      requests.push(path)
      if (path.endsWith('/members')) return json({ items: [member] })
      if (path.endsWith('/invitations'))
        return json(
          invitationsFail ? { error: { code: 'INTERNAL_ERROR' } } : { items: [] },
          invitationsFail ? 500 : 200,
        )
      return json({
        id: 't1',
        name: 'Студия',
        defaultTimezone: 'Europe/Moscow',
        defaultCurrency: 'RUB',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      })
    }),
  )
  const names = [
    'settings',
    'settings-company',
    'settings-services',
    'settings-notifications',
    'settings-team',
    'settings-privacy',
    'settings-account',
    'radar',
  ]
  const router = createRouter({
    history: createMemoryHistory(),
    routes: names.map((name) => ({ name, path: `/${name}`, component: { template: '<div />' } })),
  })
  await router.push('/settings-team')
  await router.isReady()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = mount(SettingsTeamPage, {
    global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient: client }]] },
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  await settle()
  return { wrapper, requests, client, router }
}
async function settle() {
  await flushPromises()
  await vi.dynamicImportSettled()
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
}
beforeEach(() => vi.mocked(fetchMe).mockReset())
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})
describe('R54 страница команды', () => {
  it('self demotion перечитывает сессию и переводит на разрешённый Radar', async () => {
    const { wrapper, client, router } = await setup()
    client.setQueryData(teamKeys.members('t1'), [
      member,
      { ...member, membershipId: 'm2', userId: 'u2', displayName: 'Анна' },
    ])
    await settle()
    await wrapper.get('button[aria-label="Изменить доступ: Мария"]').trigger('click')
    await settle()
    const dialog = () => new DOMWrapper(document.body).get('[role=dialog]')
    const click = async (text: string) => {
      await dialog()
        .findAll('button')
        .find((button) => button.text() === text)!
        .trigger('click')
      await settle()
    }
    await dialog().get('input[value=MANAGER]').setValue()
    await click('Сохранить роль')
    expect(dialog().text()).toContain('Вы станете менеджером')
    expect(fetchMe).toHaveBeenCalledTimes(1)
    vi.mocked(fetchMe).mockResolvedValue({
      user,
      memberships: [{ tenantId: 't1', organizationName: 'Студия', role: 'MANAGER' }],
      canCreateOrganization: false,
    })
    await click('Стать менеджером')
    expect(useSessionStore().role).toBe('MANAGER')
    expect(useSessionStore().can('member.manage')).toBe(false)
    expect(router.currentRoute.value.name).toBe('radar')
  })

  it('ACK self demotion + session500 блокирует команды и предлагает только GET retry', async () => {
    const { wrapper, client, router } = await setup()
    client.setQueryData(teamKeys.members('t1'), [
      member,
      { ...member, membershipId: 'm2', userId: 'u2', displayName: 'Анна' },
    ])
    await settle()
    await wrapper.get('button[aria-label="Изменить доступ: Мария"]').trigger('click')
    await settle()
    const dialog = () => new DOMWrapper(document.body).get('[role=dialog]')
    const click = async (text: string) => {
      await dialog()
        .findAll('button')
        .find((button) => button.text() === text)!
        .trigger('click')
      await settle()
    }
    await dialog().get('input[value=MANAGER]').setValue()
    await click('Сохранить роль')
    vi.mocked(fetchMe).mockRejectedValueOnce(new Error('session unavailable'))
    await click('Стать менеджером')
    expect(wrapper.text()).toContain('Доступ изменён. Не удалось обновить сессию')
    expect(wrapper.find('button[aria-label="Пригласить участника"]').exists()).toBe(false)
    const patches = vi
      .mocked(fetch)
      .mock.calls.filter(([request]) => (request as Request).method === 'PATCH').length
    expect(patches).toBe(1)
    vi.mocked(fetchMe).mockResolvedValue({
      user,
      memberships: [{ tenantId: 't1', organizationName: 'Студия', role: 'MANAGER' }],
      canCreateOrganization: false,
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Повторить')!
      .trigger('click')
    await settle()
    expect(
      vi.mocked(fetch).mock.calls.filter(([request]) => (request as Request).method === 'PATCH'),
    ).toHaveLength(1)
    expect(router.currentRoute.value.name).toBe('radar')
    expect(useSessionStore().can('member.manage')).toBe(false)
  })
  it('Manager не инициирует organization/team запросы, скрывает список и команды', async () => {
    const { wrapper, requests } = await setup('MANAGER')
    expect(wrapper.text()).toContain('Раздел доступен владельцу')
    expect(requests).toEqual([])
    expect(wrapper.find('button[aria-label="Пригласить участника"]').exists()).toBe(false)
  })
  it('отказ приглашений не стирает успешно загруженных участников', async () => {
    const { wrapper } = await setup('OWNER', true)
    expect(wrapper.text()).toContain('Мария · Вы')
    expect(wrapper.text()).toContain('Не удалось загрузить приглашения')
    expect(wrapper.text()).not.toContain('Ожидающих приглашений нет')
  })
  it('refresh error сохраняет прежние строки участников и независимую секцию приглашений', async () => {
    const { wrapper, client } = await setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: { code: 'INTERNAL_ERROR' } }, 500)),
    )
    await client.refetchQueries({ queryKey: teamKeys.members('t1') })
    await settle()
    expect(wrapper.text()).toContain('Не удалось обновить команду')
    expect(wrapper.text()).toContain('Мария · Вы')
    expect(wrapper.text()).toContain('Ожидающих приглашений нет')
  })
})
