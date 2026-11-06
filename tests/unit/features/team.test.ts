import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore } from '@/entities/session'
import { useMembersQuery, type Invitation, type Member } from '@/entities/team'
import { MembersTable } from '@/widgets/team'
import { InviteMemberDialog } from '@/features/team/invite-member'
import { MemberActions } from '@/features/team/manage-member'
import { RevokeInvitationButton } from '@/features/team/revoke-invitation'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

function member(overrides: Partial<Member>): Member {
  return {
    membershipId: 'm-1',
    userId: 'u',
    email: 'owner@example.test',
    displayName: 'Мария Владелец',
    role: 'OWNER',
    status: 'ACTIVE',
    revokedAt: null,
    createdAt: '2026-09-01T09:00:00Z',
    updatedAt: '2026-09-01T09:00:00Z',
    ...overrides,
  }
}
const me = member({})
const anna = member({
  membershipId: 'm-2',
  userId: 'u-2',
  role: 'MANAGER',
  displayName: 'Анна Смирнова',
  email: 'manager@example.test',
})
const boris = member({
  membershipId: 'm-3',
  userId: 'u-3',
  displayName: 'Борис',
  email: 'b@example.test',
})

const invitation: Invitation = {
  id: 'inv-1',
  role: 'MANAGER',
  note: 'для Ивана',
  status: 'PENDING',
  createdBy: 'u',
  createdAt: '2026-09-24T10:00:00Z',
  expiresAt: '2026-10-01T10:00:00Z',
  acceptedAt: null,
  acceptedBy: null,
  revokedAt: null,
  revokedBy: null,
}

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
  await vi.dynamicImportSettled()
  await flushPromises()
}

const body = () => new DOMWrapper(document.body)
const dialog = () => body().get('[role="dialog"]')
const buttonNamed = (root: { findAll: (s: string) => DOMWrapper<Element>[] }, text: string) =>
  root.findAll('button').find((button) => button.text() === text)!

function plugins() {
  return [
    [
      VueQueryPlugin,
      { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
    ],
  ] as never
}

function mountMembersHost() {
  const Host = defineComponent({
    setup() {
      const query = useMembersQuery(() => 'tenant-a')
      return () =>
        h(MembersTable, {
          tenantId: 'tenant-a',
          members: (query.data.value ?? []).filter((member) => member.status === 'ACTIVE'),
          allMembers: query.data.value ?? [],
          currentUserId: 'u',
          timeZone: 'Europe/Moscow',
        })
    },
  })
  return mount(Host, { global: { plugins: plugins() }, attachTo: document.body })
}

describe('команда', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.mocked(fetchMe).mockResolvedValue({
      canCreateOrganization: false,
      user: {
        emailVerifiedAt: null,
        deletionDueAt: null,
        id: 'u',
        email: 'owner@example.test',
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
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  describe('InviteMemberDialog', () => {
    function mountDialog() {
      return mount(InviteMemberDialog, {
        props: { tenantId: 'tenant-a', timeZone: 'Europe/Moscow', open: true },
        global: { plugins: plugins() },
        attachTo: document.body,
      })
    }

    it('длинная заметка не уходит, пустая превращается в null, код показывается один раз', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ invitation, code: 'e2e-invitation-code-'.padEnd(43, 'x') }, 201),
      )
      const wrapper = mountDialog()
      await settle()
      await dialog().get('textarea[name="note"]').setValue('x'.repeat(501))
      await dialog().get('form').trigger('submit')
      await settle()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(dialog().text()).toContain('не длиннее 500')

      await dialog().get('textarea[name="note"]').setValue('')
      await dialog().get('input[value="OWNER"]').setValue()
      await dialog().get('form').trigger('submit')
      await settle()
      const request = fetchMock.mock.calls[0]![0]
      expect(new URL(request.url).pathname).toBe('/api/v1/organization/invitations')
      expect(await request.json()).toEqual({ role: 'OWNER', note: null })
      expect(dialog().get('[data-testid="invitation-code"]').text()).toBe(
        'e2e-invitation-code-'.padEnd(43, 'x'),
      )
      expect(dialog().text()).toContain('показывается один раз')
      expect(wrapper.emitted('issued')).toHaveLength(1)

      // Закрытие уничтожает код: повторное открытие показывает пустую форму.
      await wrapper.setProps({ open: false })
      await settle()
      await wrapper.setProps({ open: true })
      await settle()
      expect(dialog().find('[data-testid="invitation-code"]').exists()).toBe(false)
      expect(dialog().find('form').exists()).toBe(true)
      wrapper.unmount()
    })

    it('две отправки подряд выпускают один код', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ invitation, code: 'c'.repeat(43) }, 201))
      const wrapper = mountDialog()
      await settle()
      const form = dialog().get('form')
      await Promise.all([form.trigger('submit'), form.trigger('submit')])
      await settle()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      wrapper.unmount()
    })
  })

  describe('MemberActions', () => {
    function mountActions(target: Member, members: Member[]) {
      return mount(MemberActions, {
        props: { tenantId: 'tenant-a', member: target, members, currentUserId: 'u' },
        global: { plugins: plugins() },
        attachTo: document.body,
      })
    }

    it('единственный владелец не понижается и не отзывается, отозванный без действий', () => {
      const wrapper = mountActions(me, [me, anna])
      const buttons = wrapper.findAll('button')
      expect(buttons).toHaveLength(0)
      wrapper.unmount()
      const revoked = mountActions(member({ status: 'DISABLED', userId: 'u-9' }), [me])
      expect(revoked.findAll('button')).toHaveLength(0)
      revoked.unmount()
    })

    it('повышение подтверждается с именем и почтой и уходит PATCH', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          id: 'm-2',
          tenantId: 'tenant-a',
          userId: 'u-2',
          role: 'OWNER',
          status: 'ACTIVE',
          createdAt: '',
          updatedAt: '',
        }),
      )
      const wrapper = mountActions(anna, [me, anna])
      await settle()
      await wrapper.get('button[aria-label^="Изменить доступ"]').trigger('click')
      await settle()
      expect(dialog().text()).toContain('Анна Смирнова')
      expect(dialog().text()).toContain('manager@example.test')
      await dialog().get('input[value="OWNER"]').setValue()
      await buttonNamed(dialog(), 'Сохранить роль').trigger('click')
      await settle()
      const request = fetchMock.mock.calls[0]![0]
      expect(request.method).toBe('PATCH')
      expect(new URL(request.url).pathname).toBe('/api/v1/organization/members/u-2')
      expect(await request.json()).toEqual({ role: 'OWNER' })
      expect(wrapper.emitted('roleChanged')?.[0]).toEqual([anna, 'OWNER', false])
      wrapper.unmount()
    })

    it('редактирование после ACK убирает успех и использует подтверждённую роль при failed GET', async () => {
      let writes = 0
      fetchMock.mockImplementation(async (request) => {
        if (request.method === 'PATCH') {
          writes++
          const { role } = (await request.clone().json()) as { role: 'OWNER' | 'MANAGER' }
          return jsonResponse({
            id: anna.membershipId,
            tenantId: 'tenant-a',
            userId: anna.userId,
            role,
            status: 'ACTIVE',
            createdAt: anna.createdAt,
            updatedAt: '2026-11-01T08:45:00Z',
          })
        }
        return writes ? errorResponse(500, 'INTERNAL_ERROR') : jsonResponse({ items: [me, anna] })
      })
      const wrapper = mountMembersHost()
      await settle()
      await wrapper.get('button[aria-label="Изменить доступ: Анна Смирнова"]').trigger('click')
      await settle()
      await dialog().get('input[value=OWNER]').setValue()
      await buttonNamed(dialog(), 'Сохранить роль').trigger('click')
      await settle()
      expect(dialog().get('[role=status]').text()).toContain('Роль изменена')
      await dialog().get('input[value=MANAGER]').setValue()
      expect(dialog().find('[role=status]').exists()).toBe(false)
      expect(buttonNamed(dialog(), 'Сохранить роль').attributes('disabled')).toBeUndefined()
      expect(writes).toBe(1)
      await buttonNamed(dialog(), 'Сохранить роль').trigger('click')
      await settle()
      expect(writes).toBe(2)
      expect(dialog().get('[role=status]').text()).toContain('Роль изменена')
      expect(
        await Promise.all(
          fetchMock.mock.calls.filter(([r]) => r.method === 'PATCH').map(([r]) => r.clone().json()),
        ),
      ).toEqual([{ role: 'OWNER' }, { role: 'MANAGER' }])
      await buttonNamed(dialog(), 'Готово').trigger('click')
      await settle()
      expect(
        wrapper
          .findAll('li')
          .find((row) => row.text().includes(anna.displayName))!
          .text(),
      ).toContain('Менеджер')
      wrapper.unmount()
    })

    it('409 при гонке не заявляет успех: ошибка в диалоге, события нет', async () => {
      fetchMock.mockResolvedValue(errorResponse(409, 'LAST_OWNER'))
      const wrapper = mountActions(me, [me, boris])
      await settle()
      await wrapper.get('button[aria-label^="Изменить доступ"]').trigger('click')
      await settle()
      await dialog().get('input[value="MANAGER"]').setValue()
      await buttonNamed(dialog(), 'Сохранить роль').trigger('click')
      await settle()
      expect(dialog().text()).toContain('Вы станете менеджером')
      await buttonNamed(dialog(), 'Стать менеджером').trigger('click')
      await settle()
      expect(dialog().get('[role="alert"]').text()).toContain('Последний владелец')
      expect(dialog().text()).not.toContain('raw')
      expect(wrapper.emitted('roleChanged')).toBeUndefined()
      wrapper.unmount()
    })

    it('отзыв доступа объясняет последствия и сообщает о себе отдельно', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
      const wrapper = mountActions(me, [me, boris])
      await settle()
      await wrapper.get('button[aria-label^="Отозвать доступ"]').trigger('click')
      await settle()
      expect(dialog().text()).toContain('собственный доступ')
      await buttonNamed(dialog(), 'Отозвать доступ').trigger('click')
      await settle()
      expect(fetchMock.mock.calls[0]![0].method).toBe('DELETE')
      expect(wrapper.emitted('revoked')?.[0]).toEqual([me, true])
      wrapper.unmount()
    })
  })

  describe('concurrent member state refresh', () => {
    it.each(['LAST_OWNER', 'MEMBER_DISABLED'] as const)(
      '%s сохраняет mounted dialog, ошибку и выбор после GET, cancel завершает контекст',
      async (code) => {
        let changed = false
        const original = code === 'LAST_OWNER' ? [me, boris] : [me, anna]
        const target = code === 'LAST_OWNER' ? me : anna
        fetchMock.mockImplementation(async (request) => {
          if (request.method === 'PATCH') {
            changed = true
            return errorResponse(409, code)
          }
          const items = !changed
            ? original
            : code === 'LAST_OWNER'
              ? [me, { ...boris, role: 'MANAGER' }]
              : [me, { ...anna, status: 'DISABLED', revokedAt: '2026-11-01T08:45:00Z' }]
          return jsonResponse({ items })
        })
        const wrapper = mountMembersHost()
        await settle()
        await wrapper
          .get(`button[aria-label="Изменить доступ: ${target.displayName}"]`)
          .trigger('click')
        await settle()
        await dialog()
          .get(`input[value=${code === 'LAST_OWNER' ? 'MANAGER' : 'OWNER'}]`)
          .setValue()
        await buttonNamed(dialog(), 'Сохранить роль').trigger('click')
        await settle()
        if (code === 'LAST_OWNER') {
          await buttonNamed(dialog(), 'Стать менеджером').trigger('click')
          await settle()
        }
        expect(dialog().get('[role=alert]').text()).toContain(
          code === 'LAST_OWNER' ? 'Последний владелец' : 'Доступ участника отозван',
        )
        expect(
          (
            dialog().get(`input[value=${code === 'LAST_OWNER' ? 'MANAGER' : 'OWNER'}]`)
              .element as HTMLInputElement
          ).checked,
        ).toBe(true)
        expect(buttonNamed(dialog(), 'Сохранить роль').attributes('disabled')).toBeDefined()
        expect(fetchMock.mock.calls.filter(([request]) => request.method === 'PATCH')).toHaveLength(
          1,
        )
        expect(
          fetchMock.mock.calls.filter(([request]) => request.method === 'GET').length,
        ).toBeGreaterThan(1)
        await buttonNamed(dialog(), 'Отмена').trigger('click')
        await settle()
        expect(body().find('[role=dialog]').exists()).toBe(false)
        if (code === 'MEMBER_DISABLED') expect(wrapper.text()).not.toContain(anna.displayName)
        wrapper.unmount()
      },
    )
  })

  describe('RevokeInvitationButton', () => {
    it('отзывает после подтверждения, принятое приглашение объясняет по коду', async () => {
      // Список без наблюдателей не перечитывается, поэтому второй ответ — сразу 409.
      fetchMock
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(errorResponse(409, 'INVITATION_USED'))
      const wrapper = mount(RevokeInvitationButton, {
        props: { tenantId: 'tenant-a', invitation },
        global: { plugins: plugins() },
        attachTo: document.body,
      })
      await settle()
      await wrapper.get('button').trigger('click')
      await settle()
      expect(dialog().text()).toContain('для Ивана')
      await buttonNamed(dialog(), 'Отозвать приглашение').trigger('click')
      await settle()
      const request = fetchMock.mock.calls[0]![0]
      expect(request.method).toBe('DELETE')
      expect(new URL(request.url).pathname).toBe('/api/v1/organization/invitations/inv-1')
      expect(wrapper.emitted('revoked')).toHaveLength(1)

      await settle()
      await wrapper.get('button').trigger('click')
      await settle()
      await buttonNamed(dialog(), 'Отозвать приглашение').trigger('click')
      await settle()
      expect(dialog().get('[role="alert"]').text()).toContain('уже принято')
      wrapper.unmount()
    })
  })
})
