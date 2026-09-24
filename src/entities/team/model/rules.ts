/**
 * Правила экрана команды. Сервер — источник истины (`409 LAST_OWNER`,
 * `MEMBER_DISABLED`); здесь только то, что интерфейс обязан не предлагать
 * заведомо невозможное: понижение или отзыв единственного активного владельца.
 */
import type { Member, TeamRole } from './types'

export function activeOwnerCount(members: readonly Member[]): number {
  return members.filter((member) => member.status === 'ACTIVE' && member.role === 'OWNER').length
}

export function isLastActiveOwner(member: Member, members: readonly Member[]): boolean {
  return member.status === 'ACTIVE' && member.role === 'OWNER' && activeOwnerCount(members) === 1
}

export interface MemberActionAvailability {
  changeRole: boolean
  revoke: boolean
  /** Почему действия недоступны; `null`, если доступны или участник уже отозван. */
  reason: string | null
}

export function memberActionAvailability(
  member: Member,
  members: readonly Member[],
): MemberActionAvailability {
  if (member.status !== 'ACTIVE') return { changeRole: false, revoke: false, reason: null }
  if (isLastActiveOwner(member, members)) {
    return {
      changeRole: false,
      revoke: false,
      reason: 'Единственный активный владелец: сначала назначьте владельцем другого участника.',
    }
  }
  return { changeRole: true, revoke: true, reason: null }
}

export function otherRole(role: TeamRole): TeamRole {
  return role === 'OWNER' ? 'MANAGER' : 'OWNER'
}

/** Инициалы для аватара: до двух слов имени (разделители вроде «·» пропускаются), иначе первая буква почты. */
export function memberInitials(displayName: string, email: string): string {
  const words = displayName
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
  const letters = words.slice(0, 2).map((word) => word.match(/[\p{L}\p{N}]/u)![0].toUpperCase())
  if (letters.length > 0) return letters.join('')
  return email.trim().charAt(0).toUpperCase() || '?'
}

/** Активные участники впереди (владельцы первыми, затем по имени), отозванные — в конце. */
export function sortMembers(members: readonly Member[]): Member[] {
  const rank = (member: Member) =>
    member.status === 'ACTIVE'
      ? member.role === 'OWNER'
        ? 0
        : 1
      : member.status === 'INVITED'
        ? 2
        : 3
  return [...members].sort(
    (left, right) =>
      rank(left) - rank(right) ||
      left.displayName.localeCompare(right.displayName, 'ru') ||
      left.email.localeCompare(right.email),
  )
}

/** Код вводят вручную или вставляют: пробелы и переводы строк отбрасываются. */
export function normalizeInvitationCode(raw: string): string {
  return raw.replace(/\s+/g, '')
}
