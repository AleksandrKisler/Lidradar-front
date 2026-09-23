/**
 * Права ролей.
 *
 * Карта повторяет `backend/internal/tenant/application/service.go` и нужна
 * только для интерфейса: скрыть недоступные разделы и действия. Контроль
 * доступа выполняет сервер; скрытая кнопка не заменяет `403`.
 */
import type { Role } from './types'

export const PERMISSIONS = [
  'risks.read',
  'risks.manage',
  'conversation.read',
  'opportunity.manage',
  'action.manage',
  'outcome.manage',
  'revenue.confirm',
  'revenue.read',
  'analytics.read',
  'integration.manage',
  'organization.manage',
  'location.manage',
  'service.manage',
  'notification.manage',
  'member.manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const managerPermissions: ReadonlySet<Permission> = new Set<Permission>([
  'risks.read',
  'risks.manage',
  'conversation.read',
  'opportunity.manage',
  'action.manage',
  'outcome.manage',
  'revenue.confirm',
])

const ownerPermissions: ReadonlySet<Permission> = new Set<Permission>(PERMISSIONS)

const empty: ReadonlySet<Permission> = new Set()

/** Набор прав роли; для неизвестной роли — пустой набор. */
export function permissionsForRole(role: Role | null | undefined): ReadonlySet<Permission> {
  switch (role) {
    case 'OWNER':
      return ownerPermissions
    case 'MANAGER':
      return managerPermissions
    default:
      return empty
  }
}

/** Подпись роли для интерфейса. */
export function roleLabel(role: Role): string {
  return role === 'OWNER' ? 'Владелец' : 'Менеджер'
}
