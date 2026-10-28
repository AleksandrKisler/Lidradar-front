import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { routes } from '@/app/router/routes'
import PlainLayout from '@/app/layouts/PlainLayout.vue'
import { fetchMe, useSessionStore, type AuthMeResponse, type Role } from '@/entities/session'
import { AccountPage } from '@/pages/account'
import { SettingsAccountPage, SettingsPrivacyPage } from '@/pages/settings'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

/**
 * Страницы выгрузки данных и закрытия аккаунта (ADR 0059): личные карточки доступны любой роли и пользователю
 * без организации, выгрузка организации — только владельцу, напоминание о закрытии видно в обоих каркасах.
 */

function meResponse(role: Role | null, deletionDueAt: string | null = null): AuthMeResponse {
  return {
    canCreateOrganization: false,
    user: {
      id: 'u-1',
      email: 'maria@example.test',
      displayName: 'Мария',
      status: 'ACTIVE',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      emailVerifiedAt: '2026-10-02T00:00:00Z',
      deletionDueAt,
    },
    memberships: role ? [{ tenantId: 'tenant-a', organizationName: 'Салон', role }] : [],
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>

async function signIn(role: Role | null, deletionDueAt: string | null = null) {
  vi.mocked(fetchMe).mockResolvedValue(meResponse(role, deletionDueAt))
  const session = useSessionStore()
  await session.bootstrap()
  if (role) session.selectTenant('tenant-a')
}

async function mountAt(component: object, path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
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
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  localStorage.clear()
  fetchMock = vi.fn<(request: Request) => Promise<Response>>(async (request) => {
    const path = new URL(request.url).pathname
    if (path === '/api/v1/organization') {
      return jsonResponse({
        id: 'tenant-a',
        name: 'Салон',
        defaultTimezone: 'Europe/Moscow',
        defaultCurrency: 'RUB',
        status: 'ACTIVE',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      })
    }
    if (path === '/api/v1/organization/ml-consent') {
      return jsonResponse({ scope: 'DATASETS', active: false, consent: null })
    }
    if (path === '/api/v1/admin/me') return jsonResponse({ userId: 'u-1', platformAdmin: false })
    return jsonResponse({ error: { code: 'NOT_FOUND', message: 'x', traceId: 't' } }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('Настройки → Аккаунт', () => {
  it.each(['OWNER', 'MANAGER'] as const)(
    '%s видит выгрузку личных данных и закрытие аккаунта',
    async (role) => {
      await signIn(role)
      const { wrapper } = await mountAt(SettingsAccountPage, '/settings/account')
      expect(wrapper.text()).toContain('Смена пароля')
      expect(wrapper.find('[data-testid="export-account-open"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="deletion-open"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Удаление аккаунта')
      wrapper.unmount()
    },
  )

  it('при назначенном закрытии вместо кнопки удаления — срок и отмена', async () => {
    await signIn('OWNER', '2026-11-13T09:00:00Z')
    const { wrapper } = await mountAt(SettingsAccountPage, '/settings/account')
    expect(wrapper.find('[data-testid="deletion-open"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="deletion-scheduled"]').text()).toContain(
      '13 ноября 2026, 09:00 (UTC)',
    )
    expect(wrapper.find('[data-testid="deletion-cancel"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('Настройки → Данные', () => {
  it('владелец видит выгрузку данных организации', async () => {
    await signIn('OWNER')
    const { wrapper } = await mountAt(SettingsPrivacyPage, '/settings/privacy')
    expect(wrapper.text()).toContain('Выгрузка данных организации')
    expect(wrapper.find('[data-testid="export-organization"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('менеджеру выгрузка организации не предлагается', async () => {
    await signIn('MANAGER')
    const { wrapper } = await mountAt(SettingsPrivacyPage, '/settings/privacy')
    expect(wrapper.text()).toContain('Данные и согласие на обучение')
    expect(wrapper.text()).not.toContain('Выгрузка данных организации')
    expect(wrapper.find('[data-testid="export-organization"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('страница «Аккаунт и данные» без организации', () => {
  it('показывает адрес, выгрузку и закрытие и ведёт назад к пространствам', async () => {
    await signIn(null)
    const { wrapper } = await mountAt(AccountPage, '/account')
    expect(wrapper.get('[data-testid="account-email"]').text()).toBe('maria@example.test')
    expect(wrapper.find('[data-testid="export-account-open"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deletion-open"]').exists()).toBe(true)
    expect(wrapper.get('a[href="/workspaces"]').text()).toContain('Назад к рабочим пространствам')
    expect(wrapper.find('[data-testid="export-organization"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('каркас без боковой панели', () => {
  it('ведёт на страницу аккаунта, а баннер закрытия виден только при назначенном сроке', async () => {
    await signIn(null)
    const quiet = await mountAt(PlainLayout, '/workspaces')
    expect(quiet.wrapper.get('[data-testid="account-link"]').attributes('href')).toBe('/account')
    expect(quiet.wrapper.find('[data-testid="account-deletion-banner"]').exists()).toBe(false)
    quiet.wrapper.unmount()

    setActivePinia(createPinia())
    await signIn(null, '2026-11-13T09:00:00Z')
    const scheduled = await mountAt(PlainLayout, '/workspaces')
    expect(scheduled.wrapper.get('[data-testid="account-deletion-banner"]').text()).toContain(
      '13 ноября 2026, 09:00 (UTC)',
    )
    scheduled.wrapper.unmount()
  })

  it('шапка по макету: имя, «Аккаунт», «Выйти»; право администратора запрашивается только при известной сессии', async () => {
    await signIn(null)
    const known = await mountAt(PlainLayout, '/workspaces')
    const header = known.wrapper.get('header')
    expect(header.text()).toContain('Мария')
    expect(header.text()).toContain('Аккаунт')
    expect(header.text()).toContain('Выйти')
    expect(fetchMock.mock.calls.some(([r]) => new URL(r.url).pathname === '/api/v1/admin/me')).toBe(
      true,
    )
    known.wrapper.unmount()

    fetchMock.mockClear()
    const loading = mount(PlainLayout, {
      props: { loading: true },
      slots: { default: '<p data-testid="skeleton">каркас</p>' },
      global: {
        plugins: [
          known.router,
          [
            VueQueryPlugin,
            { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          ],
        ],
      },
    })
    await flushPromises()
    // Сессия ещё неизвестна: остаётся бренд и слот, без действий и без запроса к API.
    expect(loading.find('[data-testid="skeleton"]').exists()).toBe(true)
    expect(loading.find('[data-testid="account-link"]').exists()).toBe(false)
    expect(loading.text()).not.toContain('Выйти')
    expect(fetchMock).not.toHaveBeenCalled()
    loading.unmount()
  })
})
