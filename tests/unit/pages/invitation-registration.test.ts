import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiError } from '@/shared/api'
import { routes } from '@/app/router/routes'
import { installGuards } from '@/app/router/guards'
import App from '@/app/App.vue'
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
  deletionDueAt: null,
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

  /** Регистрация гостем: `fetch` отвечает на режим и проверку кода, остальное — ошибка теста. */
  function registrationApi(mode: 'open' | 'invite_only' = 'invite_only') {
    const calls: string[] = []
    const fetchMock = vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname
      calls.push(`${request.method} ${path}`)
      if (path === '/api/v1/auth/registration') return jsonResponse({ mode })
      if (path === '/api/v1/auth/registration/invitation/check') {
        return new Response(null, { status: 204 })
      }
      throw new Error(`неожиданный запрос ${path}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    return calls
  }

  async function mountRegister(location: string) {
    vi.mocked(fetchMe).mockRejectedValue(new ApiError({ httpStatus: 401, code: 'UNAUTHENTICATED' }))
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(location)
    await router.isReady()
    const wrapper = mount(RegisterPage, {
      attachTo: document.body,
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

  it('код из ссылки проверяется сервером один раз и убирается из адреса; flow и прочие параметры остаются', async () => {
    const calls = registrationApi()
    const { wrapper, router } = await mountRegister(`/register?code=${CODE}&utm=x`)
    expect(router.currentRoute.value.query).toEqual({ utm: 'x', flow: 'invite' })
    expect(router.currentRoute.value.fullPath).not.toContain(CODE)
    expect(calls).toEqual(['POST /api/v1/auth/registration/invitation/check'])
    // После успеха — B3: данные аккаунта без поля кода, повторный ввод не нужен.
    expect(wrapper.find('input[name="invite-code"]').exists()).toBe(false)
    expect(wrapper.text()).toContain(
      'Приглашение проверено. Заполните данные для создания аккаунта.',
    )
    expect(wrapper.text()).toContain('Использовать другое приглашение')
    wrapper.unmount()
  })

  it('обычный /register в open: A — пояснение и ссылка на код, без warning, кода и «Приглашение проверено»', async () => {
    registrationApi('open')
    const { wrapper, router } = await mountRegister('/register')
    expect(router.currentRoute.value.fullPath).toBe('/register')
    expect(wrapper.text()).toContain(
      'Заполните имя, электронную почту и пароль, чтобы создать аккаунт.',
    )
    const link = wrapper.get('a[href="/register?flow=invite"]')
    expect(link.text()).toBe('Использовать код приглашения')
    expect(wrapper.text()).not.toContain('Приглашение проверено')
    expect(wrapper.text()).not.toContain('Регистрация закрыта')
    expect(wrapper.find('input[name="invite-code"]').exists()).toBe(false)
    expect(wrapper.get('input[name="name"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('обычный /register в invite_only: warning над карточкой, форма недоступна, ссылки активны', async () => {
    registrationApi('invite_only')
    const { wrapper } = await mountRegister('/register')
    const warning = wrapper.get('[role="alert"]')
    expect(warning.text()).toContain('Регистрация закрыта')
    expect(warning.text()).toContain('Доступ только по приглашению.')
    // Warning — сосед карточки и стоит перед ней, а не внутри формы.
    const card = wrapper.get('h1').element.closest('.rounded-card')!
    expect(card.contains(warning.element)).toBe(false)
    expect(
      warning.element.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(wrapper.text()).not.toContain('Заполните имя')
    expect(wrapper.text()).not.toContain('Приглашение проверено')
    for (const name of ['name', 'email', 'new-password']) {
      expect(wrapper.get(`input[name="${name}"]`).attributes('disabled')).toBeDefined()
    }
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('a[href="/register?flow=invite"]').text()).toBe(
      'Использовать код приглашения',
    )
    expect(wrapper.get('a[href="/login"]').text()).toBe('Войти')
    wrapper.unmount()
  })

  it('B2 по flow=invite: заголовок, подсказки; режим не запрашивается', async () => {
    const calls = registrationApi()
    const { wrapper } = await mountRegister('/register?flow=invite')
    expect(wrapper.get('h1').text()).toBe('Регистрация по приглашению')
    expect(wrapper.get('input[name="invite-code"]').attributes('placeholder')).toBe(
      'Вставьте код приглашения',
    )
    expect(calls).toEqual([])
    wrapper.unmount()
  })

  it('каркас до загрузки сессии не создаёт модель: нет запросов, адрес и контекст не тронуты', async () => {
    const calls = registrationApi()
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
    window.history.replaceState(null, '', `/register?flow=invite&code=${CODE}`)
    const router = createRouter({ history: createMemoryHistory(), routes })
    const replace = vi.spyOn(router, 'replace')
    const wrapper = mount(RegisterPage, {
      props: { loading: true },
      global: {
        plugins: [router, [VueQueryPlugin, { queryClient: new QueryClient() }]],
      },
    })
    await settle()
    expect(calls).toEqual([])
    expect(replace).not.toHaveBeenCalled()
    expect(window.location.search).toContain(CODE)
    const touched = [...getItem.mock.calls, ...setItem.mock.calls, ...removeItem.mock.calls].map(
      ([key]) => key,
    )
    expect(touched.filter((key) => String(key).includes('invitation'))).toEqual([])
    // Каркас B2 по адресу: подпись поля и «Загружаем форму…», без поля ввода.
    expect(wrapper.text()).toContain('Регистрация по приглашению')
    expect(wrapper.text()).toContain('Загружаем форму…')
    expect(wrapper.find('input').exists()).toBe(false)
    wrapper.unmount()

    window.history.replaceState(null, '', '/register')
    const ordinary = mount(RegisterPage, {
      props: { loading: true },
      global: { plugins: [router, [VueQueryPlugin, { queryClient: new QueryClient() }]] },
    })
    expect(ordinary.text()).toContain('Загружаем форму регистрации…')
    expect(ordinary.find('input').exists()).toBe(false)
    expect(calls).toEqual([])
    ordinary.unmount()
    window.history.replaceState(null, '', '/')
  })

  it('App: каркас до bootstrap без побочных действий, затем настоящая страница проверяет ссылку ровно один раз', async () => {
    const calls = registrationApi()
    window.history.replaceState(null, '', `/register?flow=invite&code=${CODE}`)
    let finishBoot!: (error: unknown) => void
    vi.mocked(fetchMe).mockReturnValue(
      new Promise((_resolve, reject) => {
        finishBoot = reject
      }),
    )
    const router = createRouter({ history: createMemoryHistory(), routes })
    installGuards(router)
    const wrapper = mount(App, {
      attachTo: document.body,
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
    const navigation = router.push(`/register?flow=invite&code=${CODE}`)
    await settle()
    await settle()
    // Каркас B2: запросов режима и проверки нет, адрес с кодом не тронут.
    expect(wrapper.text()).toContain('Загружаем форму…')
    expect(calls).toEqual([])
    finishBoot(new ApiError({ httpStatus: 401, code: 'UNAUTHENTICATED' }))
    await navigation
    await settle()
    await settle()
    expect(calls).toEqual(['POST /api/v1/auth/registration/invitation/check'])
    expect(router.currentRoute.value.fullPath).not.toContain(CODE)
    expect(router.currentRoute.value.query.flow).toBe('invite')
    expect(wrapper.text()).toContain('Приглашение проверено')
    wrapper.unmount()
    window.history.replaceState(null, '', '/')
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
