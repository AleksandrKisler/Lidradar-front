import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ROLE_CAPABILITIES,
  acceptInvitation,
  activeOwnerCount,
  changeMemberRole,
  createInvitation,
  fetchMembers,
  invitationStatusLabel,
  invitationStatusTone,
  isLastActiveOwner,
  memberActionAvailability,
  memberInitials,
  memberStatusLabel,
  memberStatusTone,
  normalizeInvitationCode,
  otherRole,
  revokeInvitation,
  revokeMember,
  sortMembers,
  teamKeys,
  type Member,
} from '@/entities/team'

function member(overrides: Partial<Member>): Member {
  return {
    membershipId: 'm-1',
    userId: 'u-1',
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

const owner = member({})
const manager = member({
  membershipId: 'm-2',
  userId: 'u-2',
  role: 'MANAGER',
  displayName: 'Анна Смирнова',
  email: 'a@example.test',
})
const secondOwner = member({
  membershipId: 'm-3',
  userId: 'u-3',
  displayName: 'Борис Второй',
  email: 'b@example.test',
})
const disabledOwner = member({
  membershipId: 'm-4',
  userId: 'u-4',
  status: 'DISABLED',
  revokedAt: '2026-09-10T00:00:00Z',
  displayName: 'Пётр Бывший',
  email: 'p@example.test',
})

describe('подписи команды', () => {
  it('переводят статусы участников и приглашений, неизвестное возвращают как есть', () => {
    expect(memberStatusLabel('ACTIVE')).toBe('Активен')
    expect(memberStatusLabel('DISABLED')).toBe('Доступ отозван')
    expect(memberStatusTone('INVITED')).toBe('info')
    expect(memberStatusLabel('X')).toBe('X')
    expect(invitationStatusLabel('PENDING')).toBe('Ожидает')
    expect(invitationStatusTone('ACCEPTED')).toBe('success')
    expect(invitationStatusTone('EXPIRED')).toBe('neutral')
    expect(invitationStatusLabel('Y')).toBe('Y')
    expect(ROLE_CAPABILITIES.OWNER.can.length).toBeGreaterThan(ROLE_CAPABILITIES.MANAGER.can.length)
    expect(ROLE_CAPABILITIES.MANAGER.cannot).toHaveLength(1)
  })
})

describe('правила команды', () => {
  it('считает только активных владельцев и защищает единственного', () => {
    expect(activeOwnerCount([owner, manager, disabledOwner])).toBe(1)
    expect(isLastActiveOwner(owner, [owner, manager, disabledOwner])).toBe(true)
    expect(isLastActiveOwner(owner, [owner, secondOwner])).toBe(false)
    expect(isLastActiveOwner(manager, [owner, manager])).toBe(false)
  })

  it('не предлагает действия над единственным владельцем и над отозванным участником', () => {
    expect(memberActionAvailability(owner, [owner, manager])).toEqual({
      changeRole: false,
      revoke: false,
      reason: expect.stringContaining('Единственный активный владелец'),
    })
    expect(memberActionAvailability(owner, [owner, secondOwner])).toEqual({
      changeRole: true,
      revoke: true,
      reason: null,
    })
    expect(memberActionAvailability(disabledOwner, [owner, disabledOwner])).toEqual({
      changeRole: false,
      revoke: false,
      reason: null,
    })
    expect(otherRole('OWNER')).toBe('MANAGER')
    expect(otherRole('MANAGER')).toBe('OWNER')
  })

  it('строит инициалы и сортирует: активные владельцы, менеджеры, отозванные', () => {
    expect(memberInitials('Анна Смирнова', 'a@example.test')).toBe('АС')
    expect(memberInitials('madonna', 'm@example.test')).toBe('M')
    expect(memberInitials('Разработчик · Студия Линия', 'd@example.test')).toBe('РС')
    expect(memberInitials('  ', 'zed@example.test')).toBe('Z')
    expect(memberInitials('', '')).toBe('?')
    const sorted = sortMembers([disabledOwner, manager, secondOwner, owner])
    expect(sorted.map((item) => item.displayName)).toEqual([
      'Борис Второй',
      'Мария Владелец',
      'Анна Смирнова',
      'Пётр Бывший',
    ])
  })

  it('убирает пробелы и переводы строк из вставленного кода', () => {
    expect(normalizeInvitationCode('  abc\n def \t')).toBe('abcdef')
  })
})

describe('запросы команды', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
  const respond = (body: unknown, status = 200) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  beforeEach(() => {
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('ключи лежат в области организации', () => {
    expect(teamKeys.members('t-1')).toEqual(['tenant', 't-1', 'members'])
    expect(teamKeys.invitations('t-1')).toEqual(['tenant', 't-1', 'invitations'])
  })

  it('участники: список, смена роли и отзыв адресуют пользователя с заголовком организации', async () => {
    fetchMock
      .mockResolvedValueOnce(respond({ items: [owner] }))
      .mockResolvedValueOnce(
        respond({
          id: 'm-2',
          tenantId: 't-1',
          userId: 'u-2',
          role: 'OWNER',
          status: 'ACTIVE',
          createdAt: '',
          updatedAt: '',
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect(await fetchMembers('t-1')).toEqual([owner])
    const list = fetchMock.mock.calls[0]![0]
    expect(new URL(list.url).pathname).toBe('/api/v1/organization/members')
    expect(list.headers.get('X-Tenant-ID')).toBe('t-1')
    const changed = await changeMemberRole('t-1', 'u-2', 'OWNER')
    expect(changed.role).toBe('OWNER')
    const patch = fetchMock.mock.calls[1]![0]
    expect(patch.method).toBe('PATCH')
    expect(new URL(patch.url).pathname).toBe('/api/v1/organization/members/u-2')
    expect(await patch.json()).toEqual({ role: 'OWNER' })
    await revokeMember('t-1', 'u-2')
    const del = fetchMock.mock.calls[2]![0]
    expect(del.method).toBe('DELETE')
    expect(new URL(del.url).pathname).toBe('/api/v1/organization/members/u-2')
  })

  it('приглашения: выпуск с заметкой, отзыв и приём кода сеансом без заголовка организации', async () => {
    const invitation = {
      id: 'inv-1',
      role: 'MANAGER',
      note: 'для Ивана',
      status: 'PENDING',
      createdBy: 'u-1',
      createdAt: '2026-09-24T10:00:00Z',
      expiresAt: '2026-10-01T10:00:00Z',
      acceptedAt: null,
      acceptedBy: null,
      revokedAt: null,
      revokedBy: null,
    }
    fetchMock
      .mockResolvedValueOnce(respond({ invitation, code: 'c'.repeat(43) }, 201))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        respond({ membership: { tenantId: 't-1', organizationName: 'A', role: 'MANAGER' } }),
      )
    const issued = await createInvitation('t-1', { role: 'MANAGER', note: 'для Ивана' })
    expect(issued.code).toHaveLength(43)
    const post = fetchMock.mock.calls[0]![0]
    expect(new URL(post.url).pathname).toBe('/api/v1/organization/invitations')
    expect(await post.json()).toEqual({ role: 'MANAGER', note: 'для Ивана' })
    await revokeInvitation('t-1', 'inv-1')
    expect(new URL(fetchMock.mock.calls[1]![0].url).pathname).toBe(
      '/api/v1/organization/invitations/inv-1',
    )
    const accepted = await acceptInvitation('c'.repeat(43))
    expect(accepted.membership.tenantId).toBe('t-1')
    const accept = fetchMock.mock.calls[2]![0]
    expect(new URL(accept.url).pathname).toBe('/api/v1/invitations/accept')
    expect(accept.headers.get('X-Tenant-ID')).toBeNull()
    expect(await accept.json()).toEqual({ code: 'c'.repeat(43) })
  })
})
