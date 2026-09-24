import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore } from '@/entities/session'
import AdminLayout from '@/app/layouts/AdminLayout.vue'
import { ADMIN_SECTIONS } from '@/widgets/admin-shell'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

function meResponse(platformAdmin: boolean): Response {
  return new Response(JSON.stringify({ userId: 'u', platformAdmin }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('AdminLayout', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.mocked(fetchMe).mockResolvedValue({
      user: {
        id: 'u',
        email: 'a@b.c',
        displayName: 'Мария',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [{ tenantId: 'tenant-a', organizationName: 'A', role: 'OWNER' }],
    })
    await useSessionStore().bootstrap()
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  async function mountLayout() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/radar', name: 'radar', component: { template: '<div />' } },
        { path: '/login', name: 'login', component: { template: '<div />' } },
        {
          path: '/admin',
          component: AdminLayout,
          // Оболочка ссылается на все разделы: маршрутизатору нужны их имена.
          children: ADMIN_SECTIONS.map((section, index) => ({
            path: index === 0 ? '' : section.name.replace('admin-', ''),
            name: section.name,
            component: { template: '<p>Секретные очереди</p>' },
          })),
        },
      ],
    })
    await router.push('/admin')
    const wrapper = mount(AdminLayout, {
      global: { plugins: [router, [VueQueryPlugin, { queryClient: new QueryClient() }]] },
    })
    await flushPromises()
    return wrapper
  }

  it('без права показывает нейтральный экран и не запрашивает данные', async () => {
    fetchMock.mockImplementation(async () => meResponse(false))
    const wrapper = await mountLayout()
    expect(wrapper.text()).toContain('Раздел недоступен')
    expect(wrapper.text()).not.toContain('Секретные очереди')
    expect(wrapper.text()).not.toContain('Мёртвые письма')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(new URL(fetchMock.mock.calls[0]![0].url).pathname).toBe('/api/v1/admin/me')
    wrapper.unmount()
  })

  it('с правом открывает оболочку с разделами', async () => {
    fetchMock.mockImplementation(async () => meResponse(true))
    const wrapper = await mountLayout()
    expect(wrapper.text()).toContain('Администрирование платформы')
    expect(wrapper.text()).toContain('Мёртвые письма')
    wrapper.unmount()
  })
})
