import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '@/app/router/routes'
import { fetchMe, useSessionStore } from '@/entities/session'
import { RegisterPage } from '@/pages/register'
import { AcceptInvitationPage } from '@/pages/invitations'
import { CompanyPage } from '@/pages/onboarding'
import { WorkspacesPage } from '@/pages/workspaces'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

/**
 * Страницы закрытой регистрации (ADR 0057): код из ссылки не остаётся в адресе, а создание
 * организации предлагается только тому, у кого есть право.
 */

const CODE = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0UvW'
const user = {
  id: 'user-1',
  email: 'a@b.c',
  displayName: 'А',
  status: 'ACTIVE' as const,
  createdAt: '2026-10-13T00:00:00Z',
  updatedAt: '2026-10-13T00:00:00Z',
  emailVerifiedAt: null,
}
const membership = { tenantId: 't-1', organizationName: 'Студия', role: 'OWNER' as const }

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

describe('страницы регистрации по приглашениям', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetchMe).mockReset()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ mode: 'invite_only' })),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function mountPage(
    component: object,
    location: string,
    me: { memberships: (typeof membership)[]; canCreateOrganization: boolean },
  ) {
    vi.mocked(fetchMe).mockResolvedValue({ user, ...me })
    await useSessionStore().bootstrap()
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(location)
    await router.isReady()
    const wrapper = mount(component, {
      global: {
        plugins: [
          router,
          [
            VueQueryPlugin,
            { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          ],
        ],
      },
    })
    await settle()
    return { wrapper, router }
  }

  it('код из ссылки подставляется в поле и сразу убирается из адреса', async () => {
    // Регистрация доступна гостю: сессию в этом сценарии не создаём.
    vi.mocked(fetchMe).mockRejectedValue(Object.assign(new Error('401'), { httpStatus: 401 }))
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(`/register?code=${CODE}&utm=x`)
    await router.isReady()
    const wrapper = mount(RegisterPage, {
      global: {
        plugins: [
          router,
          [
            VueQueryPlugin,
            { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          ],
        ],
      },
    })
    await settle()
    expect((wrapper.get('input[name="invite-code"]').element as HTMLInputElement).value).toBe(CODE)
    expect(router.currentRoute.value.query.code).toBeUndefined()
    expect(router.currentRoute.value.query.utm).toBe('x') // прочие параметры остаются
    expect(router.currentRoute.value.fullPath).not.toContain(CODE)
    expect(wrapper.text()).toContain('Регистрация по приглашению')
    wrapper.unmount()
  })

  it('без ссылки поле кода пустое, а адрес не меняется', async () => {
    vi.mocked(fetchMe).mockRejectedValue(Object.assign(new Error('401'), { httpStatus: 401 }))
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/register')
    await router.isReady()
    const wrapper = mount(RegisterPage, {
      global: {
        plugins: [
          router,
          [
            VueQueryPlugin,
            { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          ],
        ],
      },
    })
    await settle()
    expect((wrapper.get('input[name="invite-code"]').element as HTMLInputElement).value).toBe('')
    expect(router.currentRoute.value.fullPath).toBe('/register')
    wrapper.unmount()
  })

  it('без права на организацию страница создания объясняет причину и не показывает форму', async () => {
    const { wrapper } = await mountPage(CompanyPage, '/onboarding/company', {
      memberships: [membership],
      canCreateOrganization: false,
    })
    expect(wrapper.text()).toContain('Организацию создают по приглашению платформы')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Принять приглашение')
    wrapper.unmount()
  })

  it('с правом страница создания показывает форму', async () => {
    const { wrapper } = await mountPage(CompanyPage, '/onboarding/company', {
      memberships: [],
      canCreateOrganization: true,
    })
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Организацию создают по приглашению платформы')
    wrapper.unmount()
  })

  // Создание организации тратит право: после перечитывания /auth/me оно уже ложно. Форма не должна
  // исчезнуть раньше, чем сообщит об успехе, иначе пользователь застрянет на первом шаге
  // (дефект найден проверкой в браузере).
  it('создание организации доходит до следующего шага, хотя право при этом тратится', async () => {
    vi.mocked(fetchMe).mockResolvedValueOnce({ user, memberships: [], canCreateOrganization: true })
    await useSessionStore().bootstrap()
    vi.mocked(fetchMe).mockResolvedValueOnce({
      user,
      memberships: [membership],
      canCreateOrganization: false,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          id: 't-1',
          name: 'Студия',
          defaultTimezone: 'Europe/Moscow',
          defaultCurrency: 'RUB',
          status: 'ACTIVE',
          createdAt: '2026-10-13T00:00:00Z',
          updatedAt: '2026-10-13T00:00:00Z',
        }),
      ),
    )
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/onboarding/company')
    await router.isReady()
    const wrapper = mount(CompanyPage, {
      global: {
        plugins: [
          router,
          [
            VueQueryPlugin,
            { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          ],
        ],
      },
    })
    await wrapper.get('input[name="organization"]').setValue('Студия')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(useSessionStore().canCreateOrganization).toBe(false)
    expect(router.currentRoute.value.name).toBe('onboarding-location')
    wrapper.unmount()
  })

  it('приём кода без членств и без права не предлагает создать организацию', async () => {
    const { wrapper } = await mountPage(AcceptInvitationPage, '/invitations/accept', {
      memberships: [],
      canCreateOrganization: false,
    })
    expect(wrapper.text()).not.toContain('Создать свою организацию')
    expect(wrapper.text()).toContain('Своя организация создаётся по приглашению платформы')
    wrapper.unmount()
  })

  it('приём кода при наличии права по-прежнему предлагает создать организацию', async () => {
    const { wrapper } = await mountPage(AcceptInvitationPage, '/invitations/accept', {
      memberships: [],
      canCreateOrganization: true,
    })
    expect(wrapper.text()).toContain('Создать свою организацию')
    wrapper.unmount()
  })

  it('список пространств предлагает новую организацию только при наличии права', async () => {
    const withRight = await mountPage(WorkspacesPage, '/workspaces', {
      memberships: [membership, { ...membership, tenantId: 't-2', organizationName: 'Вторая' }],
      canCreateOrganization: true,
    })
    expect(withRight.wrapper.text()).toContain('Создать организацию')
    withRight.wrapper.unmount()
    setActivePinia(createPinia())
    const without = await mountPage(WorkspacesPage, '/workspaces', {
      memberships: [membership, { ...membership, tenantId: 't-2', organizationName: 'Вторая' }],
      canCreateOrganization: false,
    })
    expect(without.wrapper.text()).not.toContain('Создать организацию')
    expect(without.wrapper.text()).toContain('Принять приглашение')
    without.wrapper.unmount()
  })
})
