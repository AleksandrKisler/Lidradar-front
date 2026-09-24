import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { fetchMe, useSessionStore } from '@/entities/session'
import { AcceptInvitationForm } from '@/features/team/accept-invitation'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

const CODE = 'e2e-invitation-code-'.padEnd(43, 'x')

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

describe('AcceptInvitationForm', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/workspaces', name: 'workspaces', component: { template: '<div />' } }],
  })

  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.mocked(fetchMe).mockResolvedValue({
      user: {
        id: 'u',
        email: 'new@b.c',
        displayName: 'Новый',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [],
    })
    await useSessionStore().bootstrap()
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  function mountForm() {
    return mount(AcceptInvitationForm, { global: { plugins: [router] } })
  }

  it('короткий код не уходит на сервер', async () => {
    const wrapper = mountForm()
    await wrapper.get('input[name="code"]').setValue('short')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Код состоит из 43 символов')
    wrapper.unmount()
  })

  it('неизвестный код объясняется нейтрально, без серверного текста', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'NOT_FOUND', message: 'no such code', traceId: 't-4' } }, 404),
    )
    const wrapper = mountForm()
    await wrapper.get('input[name="code"]').setValue(CODE)
    await wrapper.get('form').trigger('submit')
    await settle()
    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('Код не найден')
    expect(alert.text()).not.toContain('no such code')
    expect(wrapper.emitted('accepted')).toBeUndefined()
    wrapper.unmount()
  })

  it('успех: код нормализован, запрос без заголовка организации, сессия перечитана', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        membership: { tenantId: 't-9', organizationName: 'Студия', role: 'MANAGER' },
      }),
    )
    vi.mocked(fetchMe).mockResolvedValue({
      user: {
        id: 'u',
        email: 'new@b.c',
        displayName: 'Новый',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [{ tenantId: 't-9', organizationName: 'Студия', role: 'MANAGER' }],
    })
    const wrapper = mountForm()
    await wrapper.get('input[name="code"]').setValue(`  ${CODE.slice(0, 20)} ${CODE.slice(20)}\n`)
    await wrapper.get('form').trigger('submit')
    await settle()
    const request = fetchMock.mock.calls[0]![0]
    expect(new URL(request.url).pathname).toBe('/api/v1/invitations/accept')
    expect(request.headers.get('X-Tenant-ID')).toBeNull()
    expect(await request.json()).toEqual({ code: CODE })
    expect(wrapper.emitted('accepted')?.[0]).toEqual([
      { tenantId: 't-9', organizationName: 'Студия', role: 'MANAGER' },
    ])
    expect(useSessionStore().memberships).toHaveLength(1)
    wrapper.unmount()
  })

  it('уже участник: подпись по коду и ссылка на рабочие пространства', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'ALREADY_MEMBER', message: 'raw', traceId: 't-5' } }, 409),
    )
    const wrapper = mountForm()
    await wrapper.get('input[name="code"]').setValue(CODE)
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toContain('Вы уже участник')
    expect(wrapper.get('[role="alert"] a').attributes('href')).toBe('/workspaces')
    wrapper.unmount()
  })
})
