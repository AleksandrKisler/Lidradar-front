import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiError } from '@/shared/api'
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
      canCreateOrganization: false,
      user: {
        emailVerifiedAt: null,
        deletionDueAt: null,
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

  it('неизвестный код объясняется нейтрально под полем, без серверного текста и без плашки', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'NOT_FOUND', message: 'no such code', traceId: 't-4' } }, 404),
    )
    const wrapper = mountForm()
    await wrapper.get('input[name="code"]').setValue(CODE)
    await wrapper.get('form').trigger('submit')
    await settle()
    const input = wrapper.get('input[name="code"]')
    const message =
      'Код недействителен или срок его действия истёк. Попросите владельца прислать новый.'
    expect(wrapper.text()).toContain(message)
    expect(wrapper.text()).not.toContain('no such code')
    expect(input.attributes('aria-invalid')).toBe('true')
    // Подсказка о формате остаётся рядом с ошибкой, обе связаны с полем.
    const described = input.attributes('aria-describedby')!.split(' ')
    expect(described).toHaveLength(2)
    expect(wrapper.get(`[id="${described[1]}"]`).text()).toBe(message)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.emitted('accepted')).toBeUndefined()
    wrapper.unmount()
  })

  it('отправка: поле заблокировано, кнопка «Проверяем…» сохраняет имя «Присоединиться»', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    const wrapper = mountForm()
    await wrapper.get('input[name="code"]').setValue(CODE)
    await wrapper.get('form').trigger('submit')
    await settle()
    const button = wrapper.get('button[type="submit"]')
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.get('span[aria-hidden="true"]').text()).toBe('Проверяем…')
    expect(button.get('.sr-only').text()).toBe('Присоединиться')
    expect(wrapper.get('input[name="code"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('сбой сервера объясняется плашкой с идентификатором запроса; код остаётся в поле', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'INTERNAL', message: 'boom', traceId: 't-77' } }, 500),
    )
    const wrapper = mountForm()
    await wrapper.get('input[name="code"]').setValue(CODE)
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toContain('t-77')
    expect((wrapper.get('input[name="code"]').element as HTMLInputElement).value).toBe(CODE)
    wrapper.unmount()
  })

  it('код принят, а перечитать членства не удалось: код не отправляется повторно, обновляется только список', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        membership: { tenantId: 't-9', organizationName: 'Студия', role: 'MANAGER' },
      }),
    )
    vi.mocked(fetchMe).mockRejectedValueOnce(
      new ApiError({ httpStatus: 503, code: 'UNAVAILABLE', message: 'down', traceId: 't-8' }),
    )
    const wrapper = mountForm()
    await wrapper.get('input[name="code"]').setValue(CODE)
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.emitted('accepted')).toBeUndefined()
    expect(wrapper.get('[role="alert"], [role="status"]').text()).toContain(
      'Приглашение принято, список пространств не обновился',
    )
    const retry = wrapper.findAll('button').find((b) => b.text() === 'Обновить список')!
    expect(retry.exists()).toBe(true)
    vi.mocked(fetchMe).mockResolvedValueOnce({
      canCreateOrganization: false,
      user: {
        emailVerifiedAt: null,
        deletionDueAt: null,
        id: 'u',
        email: 'new@b.c',
        displayName: 'Новый',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [{ tenantId: 't-9', organizationName: 'Студия', role: 'MANAGER' }],
    })
    await retry.trigger('click')
    await settle()
    // Запрос на принятие ушёл один раз: приглашение одноразовое.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('accepted')?.[0]).toEqual([
      { tenantId: 't-9', organizationName: 'Студия', role: 'MANAGER' },
    ])
    wrapper.unmount()
  })

  it('после сбоя чтения членств новый код не наследует предупреждение о принятом приглашении; фокус — на «Обновить список»', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        membership: { tenantId: 't-9', organizationName: 'Студия', role: 'MANAGER' },
      }),
    )
    vi.mocked(fetchMe).mockRejectedValueOnce(
      new ApiError({ httpStatus: 503, code: 'UNAVAILABLE', message: 'down', traceId: 't-8' }),
    )
    const wrapper = mount(AcceptInvitationForm, {
      global: { plugins: [router] },
      attachTo: document.body,
    })
    await wrapper.get('input[name="code"]').setValue(CODE)
    await wrapper.get('form').trigger('submit')
    await settle()
    const retry = wrapper.get('button[data-retry-refresh]')
    expect(document.activeElement).toBe(retry.element)
    // Пользователь вводит другой код, сервер отвечает сбоем: показывается он, а не прежнее предупреждение.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: 'INTERNAL', message: 'boom', traceId: 't-55' } }, 500),
    )
    await wrapper.get('input[name="code"]').setValue(`${CODE.slice(0, 40)}abc`)
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toContain('t-55')
    expect(wrapper.text()).not.toContain('Приглашение принято')
    expect(wrapper.find('button[data-retry-refresh]').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each([
    ['INVITATION_USED', 409, 'Приглашение уже использовано'],
    ['INVITATION_EXPIRED', 410, 'Срок приглашения истёк'],
    ['INVITATION_REVOKED', 409, 'Приглашение отозвано'],
  ])(
    '%s объясняется по коду плашкой, а не подписью неизвестного кода',
    async (code, status, title) => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: { code, message: 'raw', traceId: 't-6' } }, status),
      )
      const wrapper = mountForm()
      await wrapper.get('input[name="code"]').setValue(CODE)
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(wrapper.get('[role="alert"]').text()).toContain(title)
      expect(wrapper.text()).not.toContain('Код недействителен или срок его действия истёк')
      expect(wrapper.get('input[name="code"]').attributes('aria-invalid')).toBeUndefined()
      wrapper.unmount()
    },
  )

  it('после неудачи фокус возвращается в поле кода', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'NOT_FOUND', message: 'x', traceId: 't-1' } }, 404),
    )
    const wrapper = mount(AcceptInvitationForm, {
      global: { plugins: [router] },
      attachTo: document.body,
    })
    await wrapper.get('input[name="code"]').setValue(CODE)
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(document.activeElement).toBe(wrapper.get('input[name="code"]').element)
    wrapper.unmount()
  })

  it('первичная загрузка: каркас без полей и кнопок', () => {
    const wrapper = mount(AcceptInvitationForm, {
      props: { loading: true },
      global: { plugins: [router] },
    })
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Загрузка')
    wrapper.unmount()
  })

  it('успех: код нормализован, запрос без заголовка организации, сессия перечитана', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        membership: { tenantId: 't-9', organizationName: 'Студия', role: 'MANAGER' },
      }),
    )
    vi.mocked(fetchMe).mockResolvedValue({
      canCreateOrganization: false,
      user: {
        emailVerifiedAt: null,
        deletionDueAt: null,
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
