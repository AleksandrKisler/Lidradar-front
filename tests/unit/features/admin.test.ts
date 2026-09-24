import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore } from '@/entities/session'
import type { PlatformAdmin } from '@/entities/admin'
import { GrantAdminForm } from '@/features/admin/grant-admin'
import { RevokeAdminButton } from '@/features/admin/revoke-admin'
import { RecoveryActions, availableActions } from '@/features/admin/recover-dead-letter'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
const errorResponse = (status: number, code: string) =>
  jsonResponse({ error: { code, message: 'raw', traceId: 't-1' } }, status)

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

const body = () => new DOMWrapper(document.body)
const dialog = () => body().get('[role="dialog"]')
const buttonNamed = (root: { findAll: (s: string) => DOMWrapper<Element>[] }, text: string) =>
  root.findAll('button').find((button) => button.text() === text)!

describe('администрирование', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
  let queryClient: QueryClient

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.mocked(fetchMe).mockResolvedValue({
      user: {
        id: 'u',
        email: 'admin@example.test',
        displayName: 'Админ',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [],
    })
    await useSessionStore().bootstrap()
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  const plugins = () => [[VueQueryPlugin, { queryClient }]] as never

  describe('availableActions', () => {
    it('предлагает команды только мёртвым и не отложенным объектам', () => {
      expect(availableActions({ kind: 'job', id: 'j', tenantId: 't', status: 'DEAD' })).toEqual([
        'retry',
        'discard',
      ])
      expect(availableActions({ kind: 'outbox', id: 'e', tenantId: 't', status: 'DEAD' })).toEqual([
        'replay',
        'discard',
      ])
      expect(
        availableActions({ kind: 'delivery', id: 'd', tenantId: 't', status: 'DEAD' }),
      ).toEqual(['discard'])
      expect(availableActions({ kind: 'job', id: 'j', tenantId: 't', status: 'PENDING' })).toEqual(
        [],
      )
      expect(
        availableActions({
          kind: 'job',
          id: 'j',
          tenantId: 't',
          status: 'DEAD',
          discardedAt: '2026-09-24T00:00:00Z',
        }),
      ).toEqual([])
    })
  })

  describe('RecoveryActions', () => {
    const target = {
      kind: 'job' as const,
      id: '01990000-0000-7000-8000-000000000901',
      tenantId: '01990000-0000-7000-8000-000000000001',
      status: 'DEAD',
    }

    it('подтверждение называет тип, объект и организацию; успех перечитывает очередь и мёртвые письма', async () => {
      fetchMock.mockImplementation(async () => jsonResponse({ ...target, status: 'PENDING' }))
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
      const wrapper = mount(RecoveryActions, {
        props: { target },
        global: { plugins: plugins() },
        attachTo: document.body,
      })
      await buttonNamed(wrapper, 'Повторить').trigger('click')
      await flushPromises()
      expect(dialog().text()).toContain('Задание')
      expect(dialog().text()).toContain(target.id)
      expect(dialog().text()).toContain(target.tenantId)
      await buttonNamed(dialog(), 'Повторить').trigger('click')
      await settle()
      expect(new URL(fetchMock.mock.calls[0]![0].url).pathname).toBe(
        `/api/v1/admin/jobs/${target.id}/retry`,
      )
      const keys = invalidate.mock.calls.map(
        ([filters]) => (filters as { queryKey?: readonly unknown[] })?.queryKey,
      )
      expect(keys).toContainEqual(['admin', 'queue'])
      expect(keys).toContainEqual(['admin', 'dead-letters'])
      expect(keys).toContainEqual(['admin', 'jobs'])
      expect(wrapper.emitted('done')?.[0]).toEqual(['retry'])
      wrapper.unmount()
    })

    it('409 объясняет, что состояние изменилось, без заявления успеха; 403 перечитывает право', async () => {
      fetchMock
        .mockImplementationOnce(async () => errorResponse(409, 'CONFLICT'))
        .mockImplementationOnce(async () => errorResponse(403, 'FORBIDDEN'))
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
      const wrapper = mount(RecoveryActions, {
        props: { target },
        global: { plugins: plugins() },
        attachTo: document.body,
      })
      await buttonNamed(wrapper, 'Отложить').trigger('click')
      await flushPromises()
      await buttonNamed(dialog(), 'Отложить').trigger('click')
      await settle()
      expect(dialog().text()).toContain('Состояние уже изменилось')
      expect(dialog().text()).not.toContain('raw')
      expect(wrapper.emitted('done')).toBeUndefined()
      await buttonNamed(dialog(), 'Отложить').trigger('click')
      await settle()
      const keys = invalidate.mock.calls.map(
        ([filters]) => (filters as { queryKey?: readonly unknown[] })?.queryKey,
      )
      expect(keys).toContainEqual(['admin', 'me'])
      wrapper.unmount()
    })

    it('не мёртвый объект команд не получает', () => {
      const wrapper = mount(RecoveryActions, {
        props: { target: { ...target, status: 'PENDING' } },
        global: { plugins: plugins() },
      })
      expect(wrapper.findAll('button')).toHaveLength(0)
      expect(wrapper.text()).toContain('Команд нет')
      wrapper.unmount()
    })
  })

  describe('GrantAdminForm', () => {
    it('проверяет почту, различает 201 и 200 и объясняет 404', async () => {
      const admin: PlatformAdmin = {
        id: 'a-2',
        userId: 'u-2',
        email: 'ops@example.test',
        grantedBy: 'u',
        grantedAt: '2026-09-24T10:00:00Z',
        note: '',
      }
      fetchMock
        .mockImplementationOnce(async () => jsonResponse(admin, 201))
        .mockImplementationOnce(async () => jsonResponse(admin, 200))
        .mockImplementationOnce(async () => errorResponse(404, 'NOT_FOUND'))
      const wrapper = mount(GrantAdminForm, { global: { plugins: plugins() } })
      await wrapper.get('input[name="adminEmail"]').setValue('not-an-email')
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('Проверьте адрес')

      await wrapper.get('input[name="adminEmail"]').setValue('ops@example.test')
      await wrapper.get('input[name="adminNote"]').setValue('дежурный')
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(await fetchMock.mock.calls[0]![0].json()).toEqual({
        email: 'ops@example.test',
        note: 'дежурный',
      })
      expect(wrapper.text()).toContain('Право выдано: ops@example.test')
      expect(wrapper.emitted('granted')).toHaveLength(1)

      await wrapper.get('input[name="adminEmail"]').setValue('ops@example.test')
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(wrapper.text()).toContain('уже действовало')

      await wrapper.get('input[name="adminEmail"]').setValue('nobody@example.test')
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(wrapper.get('[role="alert"]').text()).toContain('Пользователь не найден')
      wrapper.unmount()
    })
  })

  describe('RevokeAdminButton', () => {
    it('предупреждает об отзыве собственного права и перечитывает признак', async () => {
      fetchMock.mockImplementation(async () => new Response(null, { status: 204 }))
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
      const admin: PlatformAdmin = {
        id: 'a-1',
        userId: 'u',
        email: 'admin@example.test',
        grantedBy: null,
        grantedAt: '2026-09-01T10:00:00Z',
        note: '',
      }
      const wrapper = mount(RevokeAdminButton, {
        props: { admin, currentUserId: 'u' },
        global: { plugins: plugins() },
        attachTo: document.body,
      })
      await wrapper.get('button').trigger('click')
      await flushPromises()
      expect(dialog().text()).toContain('собственное право')
      expect(dialog().text()).toContain('останется в аудите')
      await buttonNamed(dialog(), 'Отозвать').trigger('click')
      await settle()
      expect(fetchMock.mock.calls[0]![0].method).toBe('DELETE')
      expect(new URL(fetchMock.mock.calls[0]![0].url).pathname).toBe('/api/v1/admin/admins/u')
      const keys = invalidate.mock.calls.map(
        ([filters]) => (filters as { queryKey?: readonly unknown[] })?.queryKey,
      )
      expect(keys).toContainEqual(['admin', 'me'])
      expect(wrapper.emitted('revoked')).toHaveLength(1)
      wrapper.unmount()
    })
  })
})
