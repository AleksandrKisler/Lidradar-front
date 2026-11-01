/** Synthetic API fixture for the 47 approved team states. Codes are demo-only. */
import type { Page, Route } from '@playwright/test'
type Member = {
  membershipId: string
  userId: string
  email: string
  displayName: string
  role: 'OWNER' | 'MANAGER'
  status: 'ACTIVE' | 'INVITED' | 'DISABLED'
  revokedAt: string | null
  createdAt: string
  updatedAt: string
}
type Invitation = {
  id: string
  role: Member['role']
  note: string | null
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
  createdAt: string
  createdBy: string
  expiresAt: string
  acceptedAt: string | null
  acceptedBy: string | null
  revokedAt: string | null
  revokedBy: string | null
}
import { mockOwner, TENANT_ID } from './api'
import { deferred } from './settings-company'
export const TEAM_NOW = '2026-11-01T08:45:00Z'
export const TEAM_USER = '01990000-0000-7000-8000-000000000101'
export const TEAM_CODE = 'demo_'.padEnd(43, 'x')
type Endpoint = 'members' | 'invitations' | 'create' | 'role' | 'revokeMember' | 'revokeInvitation'
export type TeamCall = {
  endpoint: Endpoint
  method: string
  path: string
  body: unknown
  tenant: string | undefined
}
const stamp = '2026-10-01T08:45:00Z'
export function teamMember(
  index: number,
  displayName: string,
  role: Member['role'] = 'MANAGER',
  status: Member['status'] = 'ACTIVE',
): Member {
  return {
    membershipId: `member-${index}`,
    userId:
      index === 1 ? TEAM_USER : `01990000-0000-7000-8000-${String(index + 100).padStart(12, '0')}`,
    displayName,
    email:
      [
        '',
        'maria.belova@example.test',
        'anna.smirnova@example.test',
        'alexandra.konstantinova.volkova@example.test',
        'igor.melnikov@example.test',
        'petr.orlov@example.test',
        '',
      ][index] ?? `member${index}@example.test`,
    role,
    status,
    revokedAt: status === 'DISABLED' ? TEAM_NOW : null,
    createdAt: stamp,
    updatedAt: stamp,
  }
}
export function teamInvitation(index = 1, status: Invitation['status'] = 'PENDING'): Invitation {
  return {
    id: `01990000-0000-7000-8000-${String(index + 700).padStart(12, '0')}`,
    role: 'MANAGER',
    note: index === 1 ? 'Для менеджера вечерней смены' : 'Для резервной смены',
    status,
    createdAt: index === 1 ? TEAM_NOW : '2026-10-25T07:00:00Z',
    createdBy: TEAM_USER,
    expiresAt: index === 1 ? '2026-11-08T08:45:00Z' : '2026-11-01T07:00:00Z',
    acceptedAt: status === 'ACCEPTED' ? TEAM_NOW : null,
    acceptedBy: status === 'ACCEPTED' ? TEAM_USER : null,
    revokedAt: status === 'REVOKED' ? TEAM_NOW : null,
    revokedBy: status === 'REVOKED' ? TEAM_USER : null,
  }
}
export async function settingsTeamFixture(page: Page, options: { manager?: boolean } = {}) {
  await mockOwner(page, { events: 'silent', role: options.manager ? 'MANAGER' : 'OWNER' })
  await page.clock.setFixedTime(new Date(TEAM_NOW))
  const members = [
    teamMember(1, 'Мария Белова', 'OWNER'),
    teamMember(2, 'Анна Смирнова'),
    teamMember(3, 'Александра Константиновна Волкова-Соколовская'),
    teamMember(4, 'Игорь Мельников'),
    teamMember(5, 'Пётр Орлов', 'MANAGER', 'DISABLED'),
    teamMember(6, 'Удалён', 'MANAGER', 'DISABLED'),
  ]
  members[5]!.revokedAt = '2026-10-31T08:45:00Z'
  const invitations = [teamInvitation(), teamInvitation(2, 'EXPIRED')]
  const calls: TeamCall[] = [],
    failures = new Map<Endpoint, { status: number; code: string }>(),
    holds = new Map<Endpoint, ReturnType<typeof deferred>>()
  let manager = !!options.manager,
    removed = false
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      json: {
        user: {
          id: TEAM_USER,
          email: 'maria.belova@example.test',
          displayName: 'Мария Белова',
          status: 'ACTIVE',
          createdAt: stamp,
          updatedAt: stamp,
          emailVerifiedAt: stamp,
          deletionDueAt: null,
        },
        memberships: removed
          ? []
          : [
              {
                tenantId: TENANT_ID,
                organizationName: 'Студия «Блик»',
                role: manager ? 'MANAGER' : 'OWNER',
              },
            ],
        canCreateOrganization: false,
      },
    }),
  )
  await page.route('**/api/v1/organization', (route) =>
    route.fulfill({
      json: {
        id: TENANT_ID,
        name: 'Студия «Блик»',
        defaultTimezone: 'Europe/Moscow',
        defaultCurrency: 'RUB',
        status: 'ACTIVE',
        createdAt: stamp,
        updatedAt: stamp,
      },
    }),
  )
  await page.route('**/api/v1/locations', (route) =>
    route.fulfill({
      json: {
        items: [{ id: '01990000-0000-7000-8000-000000000201', name: 'Студия', active: true }],
      },
    }),
  )
  const handler = async (route: Route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname,
      method = request.method()
    const endpoint: Endpoint = path.includes('/members')
      ? method === 'GET'
        ? 'members'
        : method === 'PATCH'
          ? 'role'
          : 'revokeMember'
      : method === 'GET'
        ? 'invitations'
        : method === 'POST'
          ? 'create'
          : 'revokeInvitation'
    const body =
      method === 'POST' || method === 'PATCH'
        ? (request.postDataJSON() as Record<string, string | null>)
        : null
    calls.push({ endpoint, method, path, body, tenant: request.headers()['x-tenant-id'] })
    const hold = holds.get(endpoint)
    if (hold) await hold.promise
    const failure = failures.get(endpoint)
    if (failure?.code === 'LAST_OWNER')
      members
        .filter((member) => member.userId !== TEAM_USER)
        .forEach((member) => {
          member.role = 'MANAGER'
        })
    if (failure?.code === 'MEMBER_DISABLED') {
      const target = members.find((member) => path.endsWith(member.userId))
      if (target) {
        target.status = 'DISABLED'
        target.revokedAt = TEAM_NOW
      }
    }
    if (failure?.code === 'INVITATION_USED') {
      const target = invitations.find((invitation) => path.endsWith(invitation.id))
      if (target) {
        target.status = 'ACCEPTED'
        target.acceptedAt = TEAM_NOW
        target.acceptedBy = TEAM_USER
      }
    }
    if (failure)
      return route.fulfill({
        status: failure.status,
        json: { error: { code: failure.code, message: '', traceId: '' } },
      })
    if (endpoint === 'members') return route.fulfill({ json: { items: members } })
    if (endpoint === 'invitations') return route.fulfill({ json: { items: invitations } })
    if (endpoint === 'create') {
      const invitation = {
        ...teamInvitation(3),
        createdAt: TEAM_NOW,
        expiresAt: '2026-11-08T08:45:00Z',
        note: body?.note ?? null,
        role: body?.role as Invitation['role'],
      }
      invitations.unshift(invitation)
      return route.fulfill({ status: 201, json: { invitation, code: TEAM_CODE } })
    }
    if (endpoint === 'role' || endpoint === 'revokeMember') {
      const target = members.find((member) => path.endsWith(member.userId))
      if (!target) return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } })
      if (endpoint === 'role') target.role = body?.role as Member['role']
      else {
        target.status = 'DISABLED'
        target.revokedAt = TEAM_NOW
      }
      if (target.userId === TEAM_USER) {
        manager = target.role === 'MANAGER'
        removed = target.status === 'DISABLED'
      }
      return route.fulfill(
        endpoint === 'role'
          ? {
              json: {
                id: target.membershipId,
                tenantId: TENANT_ID,
                userId: target.userId,
                role: target.role,
                status: target.status,
                createdAt: stamp,
                updatedAt: TEAM_NOW,
              },
            }
          : { status: 204 },
      )
    }
    const target = invitations.find((invitation) => path.endsWith(invitation.id))
    if (target) {
      target.status = 'REVOKED'
      target.revokedAt = TEAM_NOW
      target.revokedBy = TEAM_USER
    }
    return route.fulfill({ status: 204 })
  }
  await page.route(/\/api\/v1\/organization\/(members|invitations)(\/[^/?]+)?$/, handler)
  // The event stream is local and silent; fixtures never contact a backend.
  await page.addInitScript(() => {
    const fetchNetwork = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : null
      const url = new URL(request?.url ?? String(input), location.origin)
      if (url.pathname !== '/api/v1/events') return fetchNetwork(input, init)
      const signal = init?.signal ?? request?.signal
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(': connected\n\n'))
            signal?.addEventListener(
              'abort',
              () => {
                try {
                  controller.close()
                } catch {
                  /* closed */
                }
              },
              { once: true },
            )
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      )
    }
  })
  return {
    members,
    invitations,
    calls,
    failures,
    hold(endpoint: Endpoint) {
      holds.set(endpoint, deferred())
    },
    release(endpoint: Endpoint) {
      holds.get(endpoint)?.release()
      holds.delete(endpoint)
    },
    writes() {
      return calls.filter((call) => call.method !== 'GET')
    },
    dispose() {
      holds.forEach((hold) => hold.release())
      holds.clear()
    },
  }
}
export type SettingsTeamFixture = Awaited<ReturnType<typeof settingsTeamFixture>>
