import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { routes } from '@/app/router/routes'
import { fetchMe, useSessionStore } from '@/entities/session'

vi.mock('@/entities/session/api/auth-api', () => ({ fetchMe: vi.fn(), logout: vi.fn() }))
const user = {
  id: 'a',
  email: 'a@example.test',
  displayName: 'A',
  status: 'ACTIVE' as const,
  emailVerifiedAt: null,
  deletionDueAt: null,
  createdAt: '2026-11-02T00:00:00Z',
  updatedAt: '2026-11-02T00:00:00Z',
}
const organization = {
  id: 't-1',
  name: 'Компания',
  defaultTimezone: 'Europe/Moscow',
  defaultCurrency: 'RUB',
  status: 'ACTIVE',
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
}
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
async function settle() {
  await vi.dynamicImportSettled()
  await flushPromises()
  await vi.dynamicImportSettled()
  await flushPromises()
}

describe('QA-R1-01: изоляция форм мастера при смене пользователя в том же tenant', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.mocked(fetchMe).mockResolvedValue({
      user,
      memberships: [
        { tenantId: organization.id, organizationName: organization.name, role: 'OWNER' },
      ],
      canCreateOrganization: false,
    })
    await useSessionStore().bootstrap()
  })
  afterEach(() => vi.unstubAllGlobals())

  for (const page of ['company', 'services']) {
    const input = page === 'company' ? 'input[name="organization"]' : 'input[name="serviceName"]'
    const serverValue = page === 'company' ? organization.name : ''
    async function open(hold = false) {
      let complete: ((response: Response) => void) | undefined
      const fetch = vi.fn(async (request: Request): Promise<Response> => {
        const path = new URL(request.url).pathname
        if (request.method !== 'GET' && hold)
          return new Promise<Response>((resolve) => {
            complete = resolve
          })
        if (path.endsWith('/organization/onboarding'))
          return json({ complete: false, nextStep: 'SERVICES', steps: [], facts: {} })
        if (path.endsWith('/services')) return json({ items: [] })
        if (path.endsWith('/locations')) return json({ items: [] })
        return json(organization)
      })
      vi.stubGlobal('fetch', fetch)
      const router = createRouter({ history: createMemoryHistory(), routes })
      await router.push(`/onboarding/${page}`)
      const wrapper = mount(RouterView, {
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
      return {
        wrapper,
        fetch,
        router,
        finish: () =>
          complete!(
            json(
              page === 'company'
                ? { ...organization, name: 'A' }
                : { id: 's-1', name: 'A', active: true },
            ),
          ),
      }
    }
    it(`${page}: draft A не наследуется B, обратная смена также чистая`, async () => {
      const { wrapper, fetch } = await open()
      await wrapper.get(input).setValue('Черновик A')
      useSessionStore().user = { ...user, id: 'b', displayName: 'B' }
      await settle()
      expect(wrapper.get(input).element).toHaveProperty('value', serverValue)
      await wrapper.get(input).setValue('Черновик B')
      useSessionStore().user = user
      await settle()
      expect(wrapper.get(input).element).toHaveProperty('value', serverValue)
      expect(fetch.mock.calls.every(([request]) => request.method === 'GET')).toBe(true)
      wrapper.unmount()
    })
    it(`${page}: поздний ответ команды A не очищает draft B и не переводит шаг`, async () => {
      const { wrapper, fetch, finish, router } = await open(true)
      await wrapper.get(input).setValue('A')
      await wrapper.get('form').trigger('submit')
      await settle()
      await vi.waitFor(() =>
        expect(fetch.mock.calls.filter(([request]) => request.method !== 'GET')).toHaveLength(1),
      )
      useSessionStore().user = { ...user, id: 'b', displayName: 'B' }
      await settle()
      expect(wrapper.get(input).element).toHaveProperty('value', serverValue)
      await wrapper.get(input).setValue('Черновик B')
      finish()
      await settle()
      expect(wrapper.get(input).element).toHaveProperty('value', 'Черновик B')
      expect(router.currentRoute.value.path).toBe(`/onboarding/${page}`)
      expect(useSessionStore().user?.id).toBe('b')
      wrapper.unmount()
    })
  }
})
