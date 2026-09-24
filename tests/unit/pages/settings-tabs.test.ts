import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { fetchMe, useSessionStore, type Role } from '@/entities/session'
import { routes } from '@/app/router/routes'
import SettingsTabs from '@/pages/settings/ui/SettingsTabs.vue'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

async function signIn(role: Role) {
  vi.mocked(fetchMe).mockResolvedValue({
    user: {
      id: 'u',
      email: 'a@b.c',
      displayName: 'A',
      status: 'ACTIVE',
      createdAt: '',
      updatedAt: '',
    },
    memberships: [{ tenantId: 'tenant-a', organizationName: 'A', role }],
  })
  const session = useSessionStore()
  await session.bootstrap()
  session.selectTenant('tenant-a')
}

describe('вкладки настроек', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('владелец видит разделы организации и уведомления', async () => {
    await signIn('OWNER')
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/settings/company')
    const wrapper = mount(SettingsTabs, { global: { plugins: [router] } })
    const labels = wrapper.findAll('a').map((link) => link.text())
    expect(labels).toEqual(['Компания и график', 'Услуги', 'Уведомления', 'Команда'])
    expect(wrapper.get('a[aria-current="page"]').text()).toBe('Компания и график')
    wrapper.unmount()
  })

  it('менеджеру доступны только личные уведомления, туда же ведёт /settings', async () => {
    await signIn('MANAGER')
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/settings')
    expect(router.currentRoute.value.name).toBe('settings-notifications')
    const wrapper = mount(SettingsTabs, { global: { plugins: [router] } })
    expect(wrapper.findAll('a').map((link) => link.text())).toEqual(['Уведомления'])
    wrapper.unmount()
  })
})
